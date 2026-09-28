import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { packageTemplate, TEMPLATE_BODY_LIMIT } from "../scripts/package-live-demos.mjs";

const template = JSON.parse(readFileSync(new URL("../infra/live-demos.template.json", import.meta.url)));
const source = readFileSync(new URL("../backend/live_demos/app.py", import.meta.url));
const resources = template.Resources;
const props = name => resources[name].Properties;
const statements = name => props(name).Policies.flatMap(policy => policy.PolicyDocument.Statement);

test("live infrastructure defaults off with a required masked secret and fixed regional model", () => {
  assert.equal(template.Parameters.GenerationEnabled.Default, "false");
  assert.deepEqual(template.Parameters.GenerationEnabled.AllowedValues, ["false", "true"]);
  assert.equal(template.Parameters.PublicDemoAccess.Default, "false");
  assert.deepEqual(template.Parameters.PublicDemoAccess.AllowedValues, ["false", "true"]);
  assert.deepEqual(template.Conditions.PublicRoutesEnabled, { "Fn::Equals": [{ Ref: "PublicDemoAccess" }, "true"] });
  const secret = template.Parameters.IPHashSecret;
  assert.equal(secret.NoEcho, true);
  assert.ok(secret.MinLength >= 32);
  assert.equal(secret.Default, undefined);
  assert.equal(template.Parameters.AllowedOrigin.Default, "https://elliottbarnes.ca");
  assert.deepEqual(template.Mappings.SupportedRegion, { "us-west-2": { ImageModel: "stability.stable-image-core-v1:1" } });
  for (const name of ["ApiFunction", "WorkerFunction"]) {
    assert.deepEqual(props(name).Environment.Variables.GENERATION_ENABLED, { Ref: "GenerationEnabled" });
    assert.deepEqual(props(name).Environment.Variables.IP_HASH_SECRET, { Ref: "IPHashSecret" });
    assert.deepEqual(props(name).Environment.Variables.MODEL_ID, { "Fn::FindInMap": ["SupportedRegion", { Ref: "AWS::Region" }, "ImageModel"] });
    assert.equal(props(name).Environment.Variables.MONTHLY_IMAGES, "75");
    assert.equal(props(name).Environment.Variables.DAILY_IMAGES, "5");
    assert.equal(props(name).Environment.Variables.IP_DAILY_IMAGES, "3");
  }
});

test("temporary image storage stays private, encrypted, expiring and separate from website hosting", () => {
  assert.equal(props("Images").BucketName, undefined);
  assert.deepEqual(props("Images").PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true,
  });
  assert.deepEqual(props("Images").BucketEncryption.ServerSideEncryptionConfiguration,
    [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }]);
  assert.equal(props("Images").WebsiteConfiguration, undefined);
  assert.equal(props("Images").VersioningConfiguration, undefined, "Ephemeral outputs must not leave versioned copies.");
  assert.deepEqual(props("Images").LifecycleConfiguration.Rules,
    [{ Id: "ExpireGeneratedImages", Status: "Enabled", Prefix: "generated/", ExpirationInDays: 1 }]);
  const policy = props("ImagesPolicy").PolicyDocument.Statement;
  assert.equal(policy.length, 1);
  assert.equal(policy[0].Effect, "Deny");
  assert.deepEqual(policy[0].Condition, { Bool: { "aws:SecureTransport": "false" } });
  for (const name of ["Images", "Jobs"]) {
    assert.equal(resources[name].DeletionPolicy, "Retain");
    assert.equal(resources[name].UpdateReplacePolicy, "Retain");
  }
  assert.equal(props("Jobs").BillingMode, "PAY_PER_REQUEST");
  assert.deepEqual(props("Jobs").TimeToLiveSpecification, { AttributeName: "expiresAt", Enabled: true });
  assert.deepEqual(props("Jobs").OnDemandThroughput, { MaxReadRequestUnits: 20, MaxWriteRequestUnits: 20 });
  assert.deepEqual(props("Jobs").KeySchema, [{ AttributeName: "pk", KeyType: "HASH" }]);
});

test("each Lambda role grants only its operations on this stack's resources", () => {
  const expectedActions = {
    ApiRole: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "lambda:InvokeFunction", "logs:CreateLogStream", "logs:PutLogEvents", "s3:GetObject"],
    WorkerRole: ["bedrock:InvokeModel", "dynamodb:UpdateItem", "logs:CreateLogStream", "logs:PutLogEvents", "s3:PutObject"],
  };
  for (const [role, expected] of Object.entries(expectedActions)) {
    const actual = statements(role);
    assert.deepEqual(actual.flatMap(item => item.Action).sort(), expected.sort());
    assert.ok(actual.every(item => item.Effect === "Allow" && item.Resource !== "*"));
    assert.equal(props(role).RoleName, undefined);
    assert.equal(props(role).ManagedPolicyArns, undefined);
    for (const item of actual.filter(item => item.Action[0].startsWith("dynamodb:"))) {
      assert.deepEqual(item.Resource, { "Fn::GetAtt": ["Jobs", "Arn"] });
    }
    const logStatement = actual.find(item => item.Sid === "WriteOwnLogs");
    const logGroup = role === "ApiRole" ? "ApiLogs" : "WorkerLogs";
    assert.equal(logStatement.Resource["Fn::Sub"], `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:\${${logGroup}}:log-stream:*`);
    const s3Statement = actual.find(item => item.Action[0].startsWith("s3:"));
    assert.deepEqual(s3Statement.Resource, { "Fn::Sub": "${Images.Arn}/generated/*" });
  }
  assert.deepEqual(statements("ApiRole").find(item => item.Sid === "ReserveAttemptsAtomically").Condition,
    { "ForAnyValue:StringEquals": { "dynamodb:EnclosingOperation": ["TransactWriteItems"] } });
  assert.deepEqual(statements("WorkerRole").find(item => item.Sid === "GenerateWithCoreOnly").Resource,
    { "Fn::Sub": "arn:${AWS::Partition}:bedrock:us-west-2::foundation-model/stability.stable-image-core-v1:1" });
});

test("public routes have bounded capacity, scoped invocation and one allowed browser origin", () => {
  assert.deepEqual(props("HttpApi").CorsConfiguration.AllowOrigins, [{ Ref: "AllowedOrigin" }]);
  assert.equal(props("HttpApi").CorsConfiguration.AllowCredentials, false);
  const routes = Object.values(resources).filter(resource => resource.Type === "AWS::ApiGatewayV2::Route");
  assert.deepEqual(routes.map(route => route.Properties.RouteKey).sort(), ["GET /generations/{jobId}", "GET /health", "POST /generations"]);
  for (const route of routes) assert.deepEqual(route.Properties.AuthorizationType, { "Fn::If": ["PublicRoutesEnabled", "NONE", "AWS_IAM"] });
  assert.equal(props("ApiStage").AccessLogSettings, undefined);
  assert.equal(props("ApiStage").DefaultRouteSettings.ThrottlingRateLimit, 1);
  assert.equal(props("ApiStage").DefaultRouteSettings.ThrottlingBurstLimit, 3);
  assert.equal(props("ApiStage").RouteSettings["POST /generations"].ThrottlingRateLimit, 0.1);
  assert.equal(props("ApiStage").RouteSettings["POST /generations"].ThrottlingBurstLimit, 1);
  for (const [name, suffix] of [["HealthPermission", "GET/health"], ["GeneratePermission", "POST/generations"], ["StatusPermission", "GET/generations/*"]]) {
    assert.deepEqual(props(name).SourceAccount, { Ref: "AWS::AccountId" });
    assert.equal(props(name).SourceArn["Fn::Sub"], `arn:\${AWS::Partition}:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${HttpApi}/$default/${suffix}`);
    assert.equal(props(name).Principal, "apigateway.amazonaws.com");
  }
  for (const [name, memory, timeout] of [["ApiFunction", 256, 15], ["WorkerFunction", 512, 120]]) {
    assert.equal(props(name).Runtime, "python3.13");
    assert.deepEqual(props(name).Architectures, ["arm64"]);
    assert.equal(props(name).MemorySize, memory);
    assert.equal(props(name).Timeout, timeout);
    assert.equal(props(name).ReservedConcurrentExecutions, 2);
    assert.equal(props(name).VpcConfig, undefined, "No NAT gateway or VPC fixed costs.");
  }
  assert.equal(props("WorkerInvocation").MaximumEventAgeInSeconds, 300);
  assert.equal(props("WorkerInvocation").MaximumRetryAttempts, 0);
  assert.equal(props("WorkerInvocation").Qualifier, "$LATEST");
  assert.equal(props("ApiLogs").RetentionInDays, 3);
  assert.equal(props("WorkerLogs").RetentionInDays, 3);
});

test("CloudFormation resource references resolve without dependency cycles", () => {
  const names = new Set(Object.keys(resources));
  function references(value, result = new Set()) {
    if (Array.isArray(value)) value.forEach(child => references(child, result));
    else if (value && typeof value === "object") {
      if (value.Ref && names.has(value.Ref)) result.add(value.Ref);
      if (value["Fn::GetAtt"]) result.add(value["Fn::GetAtt"][0]);
      if (typeof value["Fn::Sub"] === "string") {
        for (const [, ref] of value["Fn::Sub"].matchAll(/\$\{([^}]+)\}/g)) {
          const name = ref.split(".")[0];
          if (names.has(name)) result.add(name);
          else assert.ok(name.startsWith("AWS::") || name in template.Parameters, `Unknown reference: ${name}`);
        }
      }
      Object.values(value).forEach(child => references(child, result));
    }
    return result;
  }
  const visiting = new Set(), visited = new Set();
  function visit(name) {
    assert.ok(names.has(name), `Missing resource ${name}`);
    assert.ok(!visiting.has(name), `Dependency cycle at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    const resource = resources[name];
    const explicit = resource.DependsOn ? [].concat(resource.DependsOn) : [];
    for (const dependency of new Set([...references(resource), ...explicit])) visit(dependency);
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of names) visit(name);
});

test("packaging preserves the exact backend in both functions and stays below the inline limit", () => {
  const artifact = packageTemplate(template, source);
  assert.ok(artifact.bytes <= TEMPLATE_BODY_LIMIT);
  assert.equal(artifact.bytes, Buffer.byteLength(artifact.body));
  assert.equal(artifact.sourceHash, createHash("sha256").update(source).digest("hex"));
  const result = JSON.parse(artifact.body);
  assert.equal(result.Metadata.BackendSourceSHA256, artifact.sourceHash);
  for (const name of ["ApiFunction", "WorkerFunction"]) {
    const code = result.Resources[name].Properties.Code.ZipFile;
    const match = code.match(/b64decode\('([A-Za-z0-9+/=]+)'\)/);
    assert.ok(match);
    assert.deepEqual(inflateSync(Buffer.from(match[1], "base64")), source);
  }
  assert.match(props("ApiFunction").Code.ZipFile, /raise RuntimeError/, "Source template must not silently deploy a placeholder service.");
  assert.equal(packageTemplate(template, source).body, artifact.body, "Packaging must be reproducible.");
  const oversized = structuredClone(template);
  oversized.Metadata.Excess = "x".repeat(TEMPLATE_BODY_LIMIT);
  assert.throws(() => packageTemplate(oversized, source), /exceeds CloudFormation/);
});

test("packaged Python exports working handlers without installing SDKs or contacting AWS", () => {
  const code = JSON.parse(packageTemplate(template, source).body).Resources.ApiFunction.Properties.Code.ZipFile;
  const python = process.env.PYTHON || "python3";
  const script = [
    "import json, sys, types",
    "module = types.ModuleType('index')",
    "sys.modules['index'] = module",
    "exec(compile(sys.stdin.read(), 'index.py', 'exec'), module.__dict__)",
    "assert callable(module.api_handler) and callable(module.worker_handler)",
    "service = module.Service(module.Settings())",
    "event = {'requestContext': {'http': {'method': 'GET'}}, 'rawPath': '/health'}",
    "result = module.api_handler(event, None, service=service)",
    "assert result['statusCode'] == 200",
    "assert json.loads(result['body'])['enabled'] is False",
    "assert 'boto3' not in sys.modules",
  ].join("\n");
  const result = spawnSync(python, ["-B", "-c", script], { input: code, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
