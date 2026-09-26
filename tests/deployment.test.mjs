import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helper = fileURLToPath(new URL("../scripts/snapshot-object.sh", import.meta.url));
const key = "assets/new-icon.png";
const listing = (contents = []) => JSON.stringify({ Name: "elliottbarnes.ca", Prefix: key, MaxKeys: 1, IsTruncated: false, KeyCount: contents.length, Contents: contents });
function snapshot(overrides = {}, objectKey = key) {
  return spawnSync("bash", ["-c", `
    source "$1"
    bucket=elliottbarnes.ca account=247222972014 region=ca-central-1
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
  assert.deepEqual(JSON.parse(result.stdout), {exists:true,version_id:"v1",etag:"etag",last_modified:"date"});
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
