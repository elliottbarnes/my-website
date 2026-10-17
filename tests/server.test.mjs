import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { createPreviewServer } from "../server.mjs";

import { manifestPath, readArtifactManifest } from "../scripts/artifact.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));

async function preview(t) {
  const root = await mkdtemp(join(tmpdir(), "portfolio-server-test-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); await rm(manifestPath(root), { force: true }); });
  await buildSite({ root: source, destination: root });
  const server = createPreviewServer({ root });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const manifest = await readArtifactManifest(root);
  return { root, asset: source => manifest.assets[source].path, url: `http://127.0.0.1:${server.address().port}` };
}

test("preview serves the artifact and versioned assets with correct types and HEAD semantics", async (t) => {
  const { root, url, asset } = await preview(t);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /^text\/html/);
  const content = await page.text();
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(Buffer.byteLength(content)));
  assert.equal(await head.text(), "");
  const css = await fetch(`${url}/${asset("styles.css")}`);
  assert.match(css.headers.get("content-type"), /^text\/css/);
  await css.arrayBuffer();
  for (const [file, type] of [["styles.css", "text/css"], ["script.js", "text/javascript"]]) {
    const path = "/" + asset(file);
    assert.ok(content.includes(path));
    assert.ok(path, `HTML must reference versioned ${file}`);
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
    assert.equal(await response.text(), await readFile(join(root, asset(file)), "utf8"));
  }
});

test("preview serves the PNG favicon as unchanged binary bytes with the correct MIME type", async (t) => {
  const { root, url, asset } = await preview(t);
  const bytes = await readFile(join(root, asset("assets/dragon-ball.png")));
  const response = await fetch(`${url}/${asset("assets/dragon-ball.png")}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  const head = await fetch(`${url}/${asset("assets/dragon-ball.png")}`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-type"), "image/png");
  assert.equal(head.headers.get("content-length"), String(bytes.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("missing and private routes return the custom 404, without exposing source", async (t) => {
  const { root, url, asset } = await preview(t);
  const expected = await readFile(join(root, "404.html"), "utf8");
  await writeFile(join(root, "README.md"), "PRIVATE TEST CONTENT");
  for (const path of ["/not-a-page", "/README.md", "/.git/config", "/%2e%2e%2fREADME.md", "/dist.manifest.json", "/styles.css"]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), expected);
  }
  const head = await fetch(`${url}/missing`, { method: "HEAD" });
  assert.equal(head.status, 404);
  assert.equal(await head.text(), "");
});

test("preview refuses unsupported methods, malformed encodings, and symlink files", async (t) => {
  const { root, url, asset } = await preview(t);
  const post = await fetch(url, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  await post.text();
  const malformed = await fetch(`${url}/%ZZ`);
  assert.equal(malformed.status, 400);
  await malformed.text();
  await rm(join(root, asset("styles.css")));
  await symlink(join(source, "styles.css"), join(root, asset("styles.css")));
  const linked = await fetch(`${url}/${asset("styles.css")}`);
  assert.equal(linked.status, 404);
  await linked.text();
});

test("running preview refreshes its allowlist after a rebuild", async t => {
  const { root, url } = await preview(t);
  // Rebuild from the same source after inserting a valid historical artifact;
  // the manifest change is picked up without restarting the HTTP server.
  const before = await readArtifactManifest(root);
  const directory = await mkdtemp(join(tmpdir(), "portfolio-preview-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { PUBLIC_FILES } = await import("../scripts/public-files.mjs");
  const { copyFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  for (const file of PUBLIC_FILES) { await mkdir(dirname(join(directory, file)), { recursive: true }); await copyFile(join(source, file), join(directory, file)); }
  await writeFile(join(directory, "styles.css"), await readFile(join(directory, "styles.css"), "utf8") + "\n/* preview revision */");
  await buildSite({ root: directory, destination: root });
  const after = await readArtifactManifest(root);
  assert.notEqual(before.assets["styles.css"].path, after.assets["styles.css"].path);
  const response = await fetch(url + "/" + after.assets["styles.css"].path);
  assert.equal(response.status, 200); assert.match(await response.text(), /preview revision/);
});
