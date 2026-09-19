import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { createPreviewServer } from "../server.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));

async function preview(t) {
  const root = await mkdtemp(join(tmpdir(), "portfolio-server-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await buildSite({ root: source, destination: root });
  const server = createPreviewServer({ root });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { root, url: `http://127.0.0.1:${server.address().port}` };
}

test("preview serves the artifact and versioned assets with correct types and HEAD semantics", async (t) => {
  const { root, url } = await preview(t);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /^text\/html/);
  const content = await page.text();
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(Buffer.byteLength(content)));
  assert.equal(await head.text(), "");
  const css = await fetch(`${url}/styles.css`);
  assert.match(css.headers.get("content-type"), /^text\/css/);
  await css.arrayBuffer();
  for (const [file, type] of [["styles.css", "text/css"], ["script.js", "text/javascript"]]) {
    const path = content.match(new RegExp(`/${file.replace(".", "\\.")}\\?v=[a-f0-9]{12}`))?.[0];
    assert.ok(path, `HTML must reference versioned ${file}`);
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
    assert.equal(await response.text(), await readFile(join(root, file), "utf8"));
  }
});

test("missing and private routes return the custom 404, without exposing source", async (t) => {
  const { root, url } = await preview(t);
  const expected = await readFile(join(root, "404.html"), "utf8");
  await writeFile(join(root, "README.md"), "PRIVATE TEST CONTENT");
  for (const path of ["/not-a-page", "/README.md", "/.git/config", "/%2e%2e%2fREADME.md"]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), expected);
  }
  const head = await fetch(`${url}/missing`, { method: "HEAD" });
  assert.equal(head.status, 404);
  assert.equal(await head.text(), "");
});

test("preview refuses unsupported methods, malformed encodings, and symlink files", async (t) => {
  const { root, url } = await preview(t);
  const post = await fetch(url, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  await post.text();
  const malformed = await fetch(`${url}/%ZZ`);
  assert.equal(malformed.status, 400);
  await malformed.text();
  await rm(join(root, "styles.css"));
  await symlink(join(source, "styles.css"), join(root, "styles.css"));
  const linked = await fetch(`${url}/styles.css`);
  assert.equal(linked.status, 404);
  await linked.text();
});
