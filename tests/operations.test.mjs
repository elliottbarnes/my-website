import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSecurityHeaders } from "../scripts/plan-security-headers.mjs";
import { planRecovery } from "../scripts/plan-recovery.mjs";
import { evaluateSnapshot } from "../scripts/audit-infra.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-operations-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "playground.html"), "<title>Playground fixture</title>");
  return directory;
}
async function recoveryFixture(t) {
  const directory = await fixture(t);
  const keys = ["index.html", "404.html", "robots.txt", "sitemap.xml", "site.webmanifest", "assets/test.abc123.js"];
  const hashes = {}, objects = [];
  for (const key of keys) {
    await writeFile(join(directory, key), key);
    const hash = createHash("sha256").update(key).digest("hex");
    hashes[key] = hash;
    objects.push({ key, sha256: hash, skipped: key.startsWith("assets/"),
      uploaded: { version_id: "uploaded-version", checksum_sha256: Buffer.from(hash, "hex").toString("base64") },
      prior: { version_id: "reused-version", checksum_sha256: Buffer.from(hash, "hex").toString("base64") } });
  }
  return { directory, record: { schema_version: 1, status: "verified", commit: "a".repeat(40),
    bucket: "elliottbarnes.ca", distribution: "E2SJR1NL1E5LJX", account: "247222972014",
    artifact: { files: keys.length, sha256: hashes }, live_verification: { sha256: { ...hashes } }, objects } };
}

test("security candidate hashes exact final inline JSON-LD and changes with it", async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, "404.html"), "<style>body{color:red}</style>");
  const body = '\n{"@type":"Person","name":"Elliott Barnes"}\n';
  await writeFile(join(directory, "index.html"), `<script type="application/ld+json">${body}</script><script src="/assets/app.js"></script>`);
  const first = await generateSecurityHeaders(directory);
  assert.ok(first.headers["Content-Security-Policy"].includes(`'sha256-${createHash("sha256").update(body).digest("base64")}'`));
  assert.equal(first.headers["Strict-Transport-Security"], "max-age=86400");
  await writeFile(join(directory, "index.html"), `<script type="application/ld+json"> ${body}</script>`);
  assert.notEqual((await generateSecurityHeaders(directory)).headers["Content-Security-Policy"], first.headers["Content-Security-Policy"]);
});

test("security planner refuses to silently allow executable inline script", async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, "404.html"), "404");
  await writeFile(join(directory, "index.html"), "<script>alert('unexpected')</script>");
  await assert.rejects(generateSecurityHeaders(directory), /executable inline/);
});

test("recovery dry run selects uploaded and reused release versions; HTML goes last", async t => {
  const { record, directory } = await recoveryFixture(t);
  const plan = await planRecovery(record, directory);
  assert.equal(plan.mode, "local-dry-run");
  assert.equal(plan.root_restore_order.at(-1).key, "index.html");
  assert.equal(plan.root_restore_order.at(-2).key, "404.html");
  assert.equal(plan.root_restore_order[0].version_id, "uploaded-version");
  assert.equal(plan.required_immutable_assets[0].version_id, "reused-version");
  assert.ok(plan.blockers.some(value => value.includes("CSP")));
});

test("recovery refuses incomplete deployment and wrong infrastructure target", async t => {
  const { record, directory } = await recoveryFixture(t);
  await assert.rejects(planRecovery({ ...record, status: "failed" }, directory), /verified/);
  await assert.rejects(planRecovery({ ...record, bucket: "other" }, directory), /target/);
});

test("recovery refuses changed bytes, missing version and conflicting recorded hash", async t => {
  const { record, directory } = await recoveryFixture(t);
  record.objects[0].uploaded.version_id = null;
  await assert.rejects(planRecovery(record, directory), /missing selected release version/);
  record.objects[0].uploaded.version_id = "restored";
  record.live_verification.sha256["index.html"] = "b".repeat(64);
  await assert.rejects(planRecovery(record, directory), /not verified/);
  record.live_verification.sha256["index.html"] = record.artifact.sha256["index.html"];
  await writeFile(join(directory, "index.html"), "different bytes");
  await assert.rejects(planRecovery(record, directory), /checksum differs/);
});

test("recovery refuses symlinks and traversal keys", async t => {
  const { record, directory } = await recoveryFixture(t);
  const links = await fixture(t);
  await symlink(directory, join(links, "artifact"));
  await assert.rejects(planRecovery(record, join(links, "artifact")), /artifact root.*symbolic link/);
  const invalid = structuredClone(record);
  invalid.artifact.sha256["../private.txt"] = "a".repeat(64);
  invalid.live_verification.sha256 = { ...invalid.artifact.sha256 };
  invalid.artifact.files++;
  await assert.rejects(planRecovery(invalid, directory), /membership/);
  await rm(join(directory, "index.html"));
  await symlink(join(directory, "404.html"), join(directory, "index.html"));
  await assert.rejects(planRecovery(record, directory), /symbolic link/);
});

test("infra denials remain unknown while accessible unsafe states report drift", () => {
  const checks = evaluateSnapshot({ public_access: { error: "AccessDenied" }, versioning: {} }, {}, {});
  assert.equal(checks.find(check => check.name === "S3 public access blocked").status, "unknown");
  assert.equal(checks.find(check => check.name === "S3 versioning enabled").status, "drift");
});
