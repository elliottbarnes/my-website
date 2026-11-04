import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const account = "247222972014", bucket = "elliottbarnes.ca";
const distributions = ["E2SJR1NL1E5LJX", "E3GONGN1BDK7M0"];
const root = fileURLToPath(new URL("..", import.meta.url));
const canonical = value => JSON.stringify(value && typeof value === "object"
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))]))
  : value);

export function evaluateSnapshot(snapshot, expectedTrust, expectedPolicy) {
  const checks = [];
  const check = (name, source, predicate) => checks.push({ name,
    status: snapshot[source]?.error ? "unknown" : predicate(snapshot[source]) ? "pass" : "drift",
    ...(snapshot[source]?.error ? { reason: snapshot[source].error } : {}) });
  check("S3 public access blocked", "public_access", value =>
    ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"]
      .every(key => value?.PublicAccessBlockConfiguration?.[key] === true));
  check("S3 versioning enabled", "versioning", value => value?.Status === "Enabled");
  check("S3 default AES256 encryption", "encryption", value => value?.ServerSideEncryptionConfiguration?.Rules
    ?.some(rule => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === "AES256"));
  check("S3 ACLs disabled", "ownership", value => value?.OwnershipControls?.Rules
    ?.some(rule => rule.ObjectOwnership === "BucketOwnerEnforced"));
  check("Deploy trust matches reviewed repository policy", "role", value => canonical(value?.Role?.AssumeRolePolicyDocument) === canonical(expectedTrust));
  check("Deploy permissions match reviewed repository policy", "policy", value => canonical(value?.PolicyDocument) === canonical(expectedPolicy));
  check("No extra managed deploy policies", "attached", value => value?.AttachedPolicies?.length === 0);
  check("Only reviewed inline deploy policy", "inline", value => canonical(value?.PolicyNames?.slice().sort()) === canonical(["PublicWebsiteDeployment"]));
  check("Both website distributions preserve delivery settings", "distributions", value => distributions.every(id => {
    const distribution = value?.DistributionList?.Items?.find(item => item.Id === id);
    return distribution?.Enabled === true && distribution?.DefaultCacheBehavior?.ViewerProtocolPolicy === "redirect-to-https"
      && distribution.DefaultCacheBehavior.Compress === true && distribution.ViewerCertificate?.MinimumProtocolVersion === "TLSv1.2_2021";
  }));
  return checks;
}

export async function auditInfra(profile) {
  if (!profile || profile.startsWith("-")) throw new Error("Pass the explicitly selected existing read-only AWS profile");
  const s3 = ["--bucket", bucket, "--expected-bucket-owner", account];
  const role = ["--role-name", "ElliottWebsiteGitHubDeploy"];
  // Fixed read-only operations. No shell, credential reads, login, Cost Explorer,
  // object enumeration, mutation, subscriber addresses, or broad workload inventory.
  const requests = [
    ["public_access", "ca-central-1", "s3api", "get-public-access-block", ...s3],
    ["versioning", "ca-central-1", "s3api", "get-bucket-versioning", ...s3],
    ["encryption", "ca-central-1", "s3api", "get-bucket-encryption", ...s3],
    ["ownership", "ca-central-1", "s3api", "get-bucket-ownership-controls", ...s3],
    ["role", "us-east-1", "iam", "get-role", ...role],
    ["policy", "us-east-1", "iam", "get-role-policy", ...role, "--policy-name", "PublicWebsiteDeployment"],
    ["attached", "us-east-1", "iam", "list-attached-role-policies", ...role],
    ["inline", "us-east-1", "iam", "list-role-policies", ...role],
    ["distributions", "us-east-1", "cloudfront", "list-distributions"],
    ["alarms_us", "us-east-1", "cloudwatch", "describe-alarms"],
    ["alarms_ca", "ca-central-1", "cloudwatch", "describe-alarms"],
    ["budgets", "us-east-1", "budgets", "describe-budgets", "--account-id", account],
  ];
  const observedAt = new Date().toISOString(); // Date captured before budget reads.
  const snapshot = {};
  for (let start = 0; start < requests.length; start += 4) {
    await Promise.all(requests.slice(start, start + 4).map(async ([name, region, ...args]) => {
      try {
        const { stdout } = await exec("aws", ["--profile", profile, "--region", region,
          "--cli-connect-timeout", "5", "--cli-read-timeout", "15", "--output", "json", ...args],
        { timeout: 25000, maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env, AWS_PAGER: "", AWS_CLI_AUTO_PROMPT: "off", AWS_MAX_ATTEMPTS: "1" } });
        snapshot[name] = JSON.parse(stdout);
      } catch (error) {
        // Record denial/timeout as unknown, never as missing/unsafe configuration.
        snapshot[name] = { error: error.killed ? "Timed out after 25 seconds"
          : error.stderr?.match(/An error occurred \(([^)]+)\)/)?.[1] || error.code || "AWS read failed" };
      }
    }));
  }
  const expectedTrust = JSON.parse(await readFile(resolve(root, ".github/aws/deploy-trust.json"), "utf8"));
  const expectedPolicy = JSON.parse(await readFile(resolve(root, ".github/aws/deploy-policy.json"), "utf8"));
  const checks = evaluateSnapshot(snapshot, expectedTrust, expectedPolicy);
  const siteAlarms = value => value?.error ? value : [...(value?.MetricAlarms || []), ...(value?.CompositeAlarms || [])]
    .filter(alarm => /elliott|website|E2SJR1NL1E5LJX|E3GONGN1BDK7M0/i.test(JSON.stringify(alarm)))
    .map(alarm => ({ name: alarm.AlarmName, state: alarm.StateValue }));
  return { schema_version: 1, observed_at: observedAt, mode: "read-only", checks,
    matched_alarms: { "us-east-1": siteAlarms(snapshot.alarms_us), "ca-central-1": siteAlarms(snapshot.alarms_ca) },
    budgets: snapshot.budgets.error ? snapshot.budgets : (snapshot.budgets.Budgets || []).map(budget => ({
      name: budget.BudgetName, limit: budget.BudgetLimit, time_unit: budget.TimeUnit,
      cost_filters: budget.CostFilters, health: budget.HealthStatus?.Status })),
    limitations: ["This is a bounded drift check, not a full security or IAM effective-permissions audit.",
      "No matching alarms does not rule out external, indirect, general, or other-region monitoring.",
      "Budget configuration does not prove notification delivery or website-attributable costs.",
      "Detailed CloudFront policies, OAC signing, certificate/DNS settings, logs, storage growth and recovery versions require separate inspection."] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/audit-infra.mjs <existing-read-only-profile>");
  const result = await auditInfra(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  if (result.checks.some(check => check.status !== "pass")) process.exitCode = 1;
}
