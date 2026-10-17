import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { PUBLIC_FILES, contentType } from "../scripts/public-files.mjs";
import { cacheControl, digest, manifestPath, readArtifactManifest } from "../scripts/artifact.mjs";
import { verifyLive } from "../scripts/verify-live.mjs";
const source = fileURLToPath(new URL("..", import.meta.url));
const origin = "https://elliottbarnes.ca";
const missingPath = /^\/__portfolio_missing_[a-f0-9-]+\.html$/;
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-live-test-"));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); await rm(manifestPath(directory), { force: true }); });
  await buildSite({ root: source, destination: directory });
  const manifest = await readArtifactManifest(directory), asset = source => manifest.assets[source].path;
  const files = new Map(await Promise.all(Object.values(manifest.assets).map(async ({path}) => [path, await readFile(join(directory, path))])));
  const requests = [];
  function mockFetch(change = () => undefined) {
    return async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "manual"); assert.ok(options.signal instanceof AbortSignal);
      const custom = await change(url, requests.filter(request => request === url).length);
      if (custom !== undefined) return custom;
      const redirects = { "http://elliottbarnes.ca/": `${origin}/`, "http://www.elliottbarnes.ca/": "https://www.elliottbarnes.ca/", "https://www.elliottbarnes.ca/": `${origin}/` };
      if (redirects[url]) return new Response(null, { status: 301, headers: { location: redirects[url] } });
      const parsed = new URL(url); assert.equal(parsed.origin, origin); assert.equal(parsed.search, "");
      const missing = missingPath.test(parsed.pathname);
      const key = missing ? "404.html" : parsed.pathname === "/" ? "index.html" : parsed.pathname.slice(1);
      assert.ok(files.has(key), `Unexpected network file: ${url}`);
      return new Response(files.get(key), { status: missing ? 404 : 200, headers: { "content-type": contentType(key), "cache-control": cacheControl(key) } });
    };
  }
  return { directory, files, requests, asset, mockFetch };
}

test("live checks every exact immutable URL including lazy assets, roots, redirects and custom 404", async t => {
  const { directory, files, requests, asset, mockFetch } = await fixture(t);
  const result = await verifyLive(directory, { fetchImpl: mockFetch(), delayMs: 0 });
  assert.equal(result.files, PUBLIC_FILES.length);
  assert.deepEqual(Object.keys(result.sha256).sort(), [...files.keys()].sort());
  for (const [key, bytes] of files) {
    assert.equal(result.sha256[key], digest(bytes));
    assert.equal(requests.filter(url => url === `${origin}/${key}`).length, 1);
  }
  for (const source of ["assets/block-blast.js", "assets/goku-platformer.js", "assets/arcade.css"]) assert.equal(result.versioned_assets['/' + asset(source)], digest(files.get(asset(source))));
  assert.equal(result.redirects.length, 3);
  assert.equal(requests.filter(url => url === origin + '/').length, 4);
  assert.equal(result.not_found.status, 404); assert.match(result.not_found.path, missingPath);
  assert.equal(requests.length, PUBLIC_FILES.length + 9);
});

test("live rejects stale lazy assets, wrong MIME, absent MIME, and incorrect cache policy", async t => {
  for (const mode of ["bytes", "type", "missing", "cache"]) {
    const { directory, files, asset, mockFetch } = await fixture(t), key = asset("assets/goku-platformer.js");
    const fetchImpl = mockFetch(url => url === `${origin}/${key}` ? new Response(mode === "bytes" ? "stale" : files.get(key), {
      headers: { ...(mode === "missing" ? {} : { "content-type": mode === "type" ? "text/plain" : contentType(key) }), "cache-control": mode === "cache" ? "no-cache" : cacheControl(key) },
    }) : undefined);
    await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /Byte hash differs|Unexpected content type|Unexpected cache policy/);
  }
});

test("live rejects stale homepage, incorrect 404 status, external redirects and loops", async t => {
  for (const mode of ["home", "404", "external", "loop"]) {
    const { directory, files, requests, mockFetch } = await fixture(t);
    const fetchImpl = mockFetch(url => {
      if (mode === "home" && url === origin + '/') return new Response("stale", { headers: { "content-type": "text/html" } });
      if (mode === "404" && missingPath.test(new URL(url).pathname)) return new Response(files.get("404.html"), { headers: { "content-type": "text/html" } });
      if (["external", "loop"].includes(mode) && url === "http://elliottbarnes.ca/") return new Response(null, {status:302,headers:{location:mode === "external" ? "https://example.org/" : "https://www.elliottbarnes.ca/"}});
      if (mode === "loop" && url === "https://www.elliottbarnes.ca/") return new Response(null, {status:308,headers:{location:url}});
    });
    await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /Byte hash differs|Expected HTTP 404|Unexpected redirect destination|Too many redirects/);
    assert.ok(!requests.some(url => url.includes("example.org")));
  }
});

test("live retries transient failure and bounds persistent failure", async t => {
  for (const persistent of [false, true]) {
    const { directory, requests, asset, mockFetch } = await fixture(t), target = origin + '/' + asset("styles.css");
    const fetchImpl = mockFetch((url, count) => { if (url === target && (persistent || count < 3)) throw new Error("outage"); });
    if (persistent) await assert.rejects(verifyLive(directory, { fetchImpl, delayMs: 0 }), /outage/);
    else await verifyLive(directory, { fetchImpl, delayMs: 0 });
    assert.equal(requests.filter(url => url === target).length, 3);
  }
});

test("live invalid retry limits issue no requests", async t => {
  const { directory, requests, mockFetch } = await fixture(t);
  for (const attempts of [0, 4, -1, 1.5, NaN, Infinity]) await assert.rejects(verifyLive(directory, { fetchImpl: mockFetch(), attempts }), /attempts must be between/);
  assert.deepEqual(requests, []);
});
