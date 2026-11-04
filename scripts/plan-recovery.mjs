import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const roots = ["robots.txt", "sitemap.xml", "site.webmanifest", "404.html", "index.html"];
function fail(message) { throw new Error(`Recovery plan refused: ${message}`); }
function keyAllowed(key) {
  return typeof key === "string" && /^[a-zA-Z0-9_./-]+$/.test(key)
    && key.split("/").every(part => part && part !== "." && part !== "..")
    && (roots.includes(key) || key.startsWith("assets/"));
}
function sameHashes(a, b) {
  return a && b && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
}

// Validate a selected successfully deployed release against its retained artifact.
// This plans restoring that release, not blindly restoring a failed run's priors.
// No AWS calls or executable mutation commands are generated.
export async function planRecovery(record, directory) {
  const root = await lstat(resolve(directory));
  if (root.isSymbolicLink() || !root.isDirectory()) fail("artifact root must be a real directory, not a symbolic link");
  if (record.schema_version !== 1 || record.status !== "verified") fail("select a verified schema-1 deployment record");
  if (!/^[a-f0-9]{40}$/.test(record.commit)) fail("invalid source revision");
  if (record.bucket !== "elliottbarnes.ca" || record.distribution !== "E2SJR1NL1E5LJX"
    || record.account !== "247222972014") fail("unexpected infrastructure target");
  const hashes = record.artifact?.sha256;
  if (!sameHashes(hashes, record.live_verification?.sha256)) fail("release was not verified against its artifact hashes");
  const keys = Object.keys(hashes);
  if (record.artifact.files !== keys.length || !keys.every(keyAllowed)
    || !roots.every(key => keys.includes(key))) fail("invalid public file membership");
  if (!Array.isArray(record.objects) || record.objects.length !== keys.length
    || new Set(record.objects.map(object => object.key)).size !== keys.length
    || record.objects.some(object => !keys.includes(object.key))) fail("object records are missing, duplicated, or unexpected");
  const versions = [];
  for (const key of keys.sort()) {
    if (!/^[a-f0-9]{64}$/.test(hashes[key])) fail(`invalid checksum for ${key}`);
    let path = resolve(directory);
    for (const part of key.split("/")) {
      path = join(path, part);
      if ((await lstat(path)).isSymbolicLink()) fail(`symbolic link at ${key}`);
    }
    if (!(await lstat(path)).isFile()) fail(`not a regular file: ${key}`);
    const hash = createHash("sha256").update(await readFile(path)).digest("hex");
    if (hash !== hashes[key]) fail(`artifact checksum differs: ${key}`);
    const object = record.objects.find(object => object.key === key);
    if (object.sha256 !== hash) fail(`object checksum differs: ${key}`);
    const selected = object.skipped === true ? object.prior : object.uploaded;
    const version = selected?.version_id;
    if (typeof version !== "string" || !version || version === "null") fail(`missing selected release version: ${key}`);
    if (selected.checksum_sha256 !== Buffer.from(hash, "hex").toString("base64")) fail(`version checksum differs: ${key}`);
    versions.push({ key, version_id: version, sha256: hash,
      content_type: object.content_type, cache_control: object.cache_control });
  }
  return { schema_version: 1, mode: "local-dry-run", commit: record.commit,
    bucket: record.bucket, distribution: record.distribution,
    verified_local_files: keys.length,
    root_restore_order: roots.map(key => versions.find(object => object.key === key)),
    required_immutable_assets: versions.filter(object => object.key.startsWith("assets/")),
    invalidate_after_authorized_restore: ["/", ...roots.map(key => `/${key}`)],
    blockers: ["Remote object versions and currently served immutable assets have not been checked.",
      "Capture current root versions and ETags immediately before any approved restore; abort on concurrent changes.",
      "Compare the selected release CSP hashes with the current response-headers policy before restoring HTML.",
      "Production restore and invalidation require separate approval; validate live bytes against this retained artifact afterward."] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error("Usage: node scripts/plan-recovery.mjs <deployment-record.json> <retained-artifact-directory>");
  console.log(JSON.stringify(await planRecovery(JSON.parse(await readFile(resolve(process.argv[2]), "utf8")), resolve(process.argv[3])), null, 2));
}
