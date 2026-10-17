import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helper = fileURLToPath(new URL("../scripts/snapshot-object.sh", import.meta.url));
const key = "assets/new-icon.png";
const listing = (contents = []) => JSON.stringify({ Name: "example-website-bucket", Prefix: key, MaxKeys: 1, IsTruncated: false, KeyCount: contents.length, Contents: contents });
function snapshot(overrides = {}, objectKey = key) {
  return spawnSync("bash", ["-c", `
    source "$1"
    bucket=example-website-bucket account=123456789012 region=ca-central-1
    aws() {
      case "$2" in
        head-object) printf '%s' "$TEST_HEAD"; return "$TEST_HEAD_STATUS" ;;
        list-objects-v2)
          [[ "$*" == *"--prefix assets/"* && "$*" == *"--no-fetch-owner"* ]] || return 99
          printf '%s' "$TEST_LIST"; return "$TEST_LIST_STATUS" ;;
        *) return 98 ;;
      esac
    }
    snapshot_public_object "$2"
  `, "test", helper, objectKey], { encoding: "utf8", env: { ...process.env, TEST_HEAD: "", TEST_HEAD_STATUS: "1", TEST_LIST: listing(), TEST_LIST_STATUS: "0", ...overrides } });
}

test("snapshot preserves an existing object's version without needing a listing", () => {
  const result = snapshot({ TEST_HEAD_STATUS: "0", TEST_HEAD: JSON.stringify({VersionId:"v1",ETag:"etag",LastModified:"date"}), TEST_LIST_STATUS: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {exists:true,version_id:"v1",etag:"etag",last_modified:"date",checksum_sha256:null,content_type:null,cache_control:null});
});
test("snapshot permits a new asset only after a successful absence check", () => {
  for (const contents of [[], [{Key:key+".backup"}]]) {
    const result = snapshot({TEST_LIST:listing(contents)});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {exists:false,version_id:null});
  }
});
test("snapshot fails closed for denied, malformed, existing, and unversioned objects", () => {
  const cases = [
    {TEST_LIST_STATUS:"1"}, {TEST_LIST:"{}"}, {TEST_LIST:"not json"},
    {TEST_LIST:listing([{Key:key}])}, {TEST_LIST:listing([{Key:"private/other"}])},
    {TEST_LIST:listing().replace('"IsTruncated":false','"IsTruncated":true')},
    {TEST_LIST:listing().replace('"KeyCount":0','"KeyCount":1')},
    {TEST_HEAD_STATUS:"0",TEST_HEAD:'{"VersionId":"null"}'},
    {TEST_HEAD_STATUS:"0",TEST_HEAD:'{}'},
  ];
  for (const fixture of cases) assert.notEqual(snapshot(fixture).status, 0, JSON.stringify(fixture));
  assert.notEqual(snapshot({}, "index.html").status, 0);
});
test("deployment policy permits only known entrypoints and the website assets prefix", () => {
  const policy = JSON.parse(readFileSync(new URL("../.github/aws/deploy-policy.json", import.meta.url)));
  assert.equal(policy.Statement.length, 4);
  const objects = policy.Statement.find(s => s.Sid === "DeployAndRecoverOnlyPublicFiles");
  assert.deepEqual(objects.Action, ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"]);
  assert.deepEqual(objects.Resource, ["index.html","404.html","styles.css","script.js","robots.txt","sitemap.xml","site.webmanifest","assets/*"].map(k=>`arn:aws:s3:::elliottbarnes.ca/${k}`));
  const list = policy.Statement.find(s => s.Sid === "CheckOnlyWebsiteAssetExistence");
  assert.equal(list.Action, "s3:ListBucket");
  assert.equal(list.Resource, "arn:aws:s3:::elliottbarnes.ca");
  assert.deepEqual(list.Condition, {StringLike:{"s3:prefix":"assets/*"}});
  const script = readFileSync(new URL("../scripts/deploy.sh", import.meta.url), "utf8");
  assert.match(script, /create_only=\(--if-none-match '\*'\)/);
  assert.match(script, /"\$\{create_only\[@\]\}"/);
});

// Exercise the actual deploy shell with an isolated Git repository and a strict
// fake AWS executable. No AWS calls or credentials are used by these tests.
const { deployFixture } = await import("./helpers/deploy-fixture.mjs");
test("unchanged release reuses all S3 versions without uploads or invalidation", async t => {
  const result = await deployFixture(t);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.record.status, "verified");
  assert.ok(result.record.objects.every(object => object.skipped && object.uploaded === null));
  assert.equal(result.record.invalidation, null);
  assert.ok(!result.state.events.some(event => ["put-object", "create-invalidation"].includes(event.op)));
  assert.ok(result.state.events.filter(event => event.op === "head-object").every(event => event.args.includes("--checksum-mode")));
});

test("changed bytes and cache metadata upload conditionally with exact invalidation", async t => {
  const result = await deployFixture(t, (state, manifest) => {
    state.objects["index.html"].ChecksumSHA256 = Buffer.from("older index").toString("base64");
    state.objects[manifest.assets["styles.css"].path].CacheControl = "max-age=300";
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const uploads = result.state.events.filter(event => event.op === "put-object");
  assert.deepEqual(uploads.map(event => event.key), [result.manifest.assets["styles.css"].path, "index.html"]);
  assert.ok(uploads.every(event => event.args.includes("--if-match")));
  assert.ok(result.record.objects.filter(object => !object.skipped).every(object => object.prior.version_id && object.uploaded.version_id));
  const invalidation = result.state.events.find(event => event.op === "create-invalidation");
  for (const path of ["/", "/index.html", "/" + result.manifest.assets["styles.css"].path]) assert.ok(invalidation.args.includes(path));
});

test("new immutable paths require confirmed absence and create-only writes", async t => {
  const result = await deployFixture(t, (state, manifest) => { delete state.objects[manifest.assets["assets/block-blast.js"].path]; });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const uploads = result.state.events.filter(event => event.op === "put-object");
  assert.equal(uploads.length, 1); assert.ok(uploads[0].args.includes("--if-none-match"));
  assert.ok(result.state.events.some(event => event.op === "list-objects-v2"));
  assert.equal(result.record.invalidation, null);
  const object = result.record.objects.find(object => !object.skipped);
  assert.equal(object.prior.exists, false); assert.ok(object.uploaded.version_id);
});

test("immutable checksum conflicts abort during snapshot before any upload", async t => {
  const result = await deployFixture(t, (state, manifest) => { state.objects[manifest.assets["assets/block-blast.js"].path].ChecksumSHA256 = "different"; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing mismatched or unverifiable immutable asset/);
  assert.ok(!result.state.events.some(event => event.op === "put-object"));
  assert.equal(result.record.status, "failed"); assert.equal(result.record.failure.stage, "snapshotting");
});

test("partial failures retain prior and successfully uploaded versions for recovery", async t => {
  const result = await deployFixture(t, (state, manifest) => {
    state.objects[manifest.assets["styles.css"].path].ContentType = "text/plain";
    state.objects["index.html"].ChecksumSHA256 = "older"; state.failKey = "index.html";
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.record.failure.stage, "uploading"); assert.equal(result.record.failure.key, "index.html");
  const css = result.record.objects.find(object => object.key === result.manifest.assets["styles.css"].path);
  assert.ok(css.prior.version_id); assert.ok(css.uploaded.version_id);
  const index = result.record.objects.find(object => object.key === "index.html");
  assert.ok(index.prior.version_id); assert.equal(index.uploaded, null);
  assert.ok(!result.state.events.some(event => event.op === "create-invalidation"));
});
