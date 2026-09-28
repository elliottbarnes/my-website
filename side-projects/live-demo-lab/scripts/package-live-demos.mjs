import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const templatePath = resolve(root, "infra/live-demos.template.json");
const sourcePath = resolve(root, "backend/live_demos/app.py");
const outputPath = resolve(root, ".aws-live/template.json");
export const TEMPLATE_BODY_LIMIT = 51_200;

export function packageTemplate(template, source) {
  if (!Buffer.isBuffer(source) || !source.length) throw new Error("Backend source must be a nonempty Buffer.");
  const result = structuredClone(template);
  const sourceHash = createHash("sha256").update(source).digest("hex");
  // Preserve every reviewed byte while keeping two inline functions below the
  // CloudFormation TemplateBody limit. Python's stdlib decodes at cold start.
  const encoded = deflateSync(source, { level: 9 }).toString("base64");
  const bootstrap = [
    `# Exact backend/live_demos/app.py; SHA256 ${sourceHash}`,
    "import base64 as _source_base64, zlib as _source_zlib",
    `exec(compile(_source_zlib.decompress(_source_base64.b64decode('${encoded}')), 'live_demos/app.py', 'exec'))`,
    "",
  ].join("\n");
  for (const [name, handler] of [["ApiFunction", "index.api_handler"], ["WorkerFunction", "index.worker_handler"]]) {
    const resource = result.Resources?.[name];
    if (resource?.Type !== "AWS::Lambda::Function" || resource.Properties.Handler !== handler) {
      throw new Error(`Unexpected ${name} handler; review packaging before proceeding.`);
    }
    resource.Properties.Code = { ZipFile: bootstrap };
  }
  result.Metadata = { ...result.Metadata, BackendSourceSHA256: sourceHash, BackendSourceBytes: source.length };
  const body = JSON.stringify(result) + "\n";
  const bytes = Buffer.byteLength(body);
  if (bytes > TEMPLATE_BODY_LIMIT) {
    throw new Error(`Packaged template is ${bytes} bytes; exceeds CloudFormation's ${TEMPLATE_BODY_LIMIT}-byte TemplateBody limit.`);
  }
  return { body, bytes, sourceHash };
}

export async function main() {
  const [template, source] = await Promise.all([readFile(templatePath, "utf8"), readFile(sourcePath)]);
  const artifact = packageTemplate(JSON.parse(template), source);
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, artifact.body, { mode: 0o600 });
  console.log(`Prepared ${outputPath} (${artifact.bytes} bytes). No AWS calls or deployment performed.`);
  console.log(`Backend SHA256: ${artifact.sourceHash}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
