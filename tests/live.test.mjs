import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSite } from "../build.mjs";
import { PUBLIC_FILES, contentType } from "../scripts/public-files.mjs";
import { verifyLive } from "../scripts/verify-live.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
const origin = "https://elliottbarnes.ca";
const missingPath = /^\/__portfolio_missing_[a-f0-9-]+\.html$/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-live-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await buildSite({ root: source, destination: directory });
  const files = new Map(await Promise.all(PUBLIC_FILES.map(async (file) =>
    [file, await readFile(join(directory, file))])));
  const requests = [];

  // Every response is local. An unexpected URL fails instead of falling back to fetch.
  function mockFetch(change = () => undefined) {
    return async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "manual");
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers["User-Agent"], "Elliott-Portfolio-Deployment-Verification/1.0");
      const custom = await change(url, requests.filter((request) => request === url).length);
      if (custom !== undefined) return custom;
      const redirects = {
        "http://elliottbarnes.ca/": `${origin}/`,
        "http://www.elliottbarnes.ca/": "https://www.elliottbarnes.ca/",
        "https://www.elliottbarnes.ca/": `${origin}/`,
      };
      if (redirects[url]) return new Response(null, { status: 301, headers: { location: redirects[url] } });
      const parsed = new URL(url);
      assert.equal(parsed.origin, origin, `Unexpected network destination: ${url}`);
      assert.equal(parsed.hash, "");
      const missing = missingPath.test(parsed.pathname);
      const key = missing ? "404.html" : parsed.pathname === "/" ? "index.html" : parsed.pathname.slice(1);
      assert.ok(files.has(key), `Unexpected public file: ${url}`);
      if (parsed.search) {
        assert.ok(["styles.css", "script.js"].includes(key), `Unexpected versioned asset: ${url}`);
        assert.equal(parsed.search, `?v=${digest(files.get(key)).slice(0, 12)}`);
      }
      return new Response(files.get(key), {
        status: missing ? 404 : 200,
        headers: { "content-type": contentType(key) },
      });
    };
  }
  return { directory, files, requests, mockFetch };
}

test("live verification checks all 20 hashes, versioned assets, the apex, canonical redirect chains, and custom 404", async (t) => {
  const { directory, files, requests, mockFetch } = await fixture(t);
  const result = await verifyLive(directory, { fetchImpl: mockFetch(), delayMs: 0 });
  assert.equal(result.origin, origin);
  assert.equal(result.files, 20);
  assert.deepEqual(Object.keys(result.sha256).sort(), [...PUBLIC_FILES].sort());
  for (const [key, bytes] of files) {
    assert.equal(result.sha256[key], digest(bytes));
    assert.equal(requests.filter((url) => url === `${origin}/${key}`).length, 1);
  }
  assert.equal(Object.keys(result.versioned_assets).length, 2);
  for (const key of ["styles.css", "script.js"]) {
    const path = `/${key}?v=${digest(files.get(key)).slice(0, 12)}`;
    assert.equal(result.versioned_assets[path], digest(files.get(key)));
    assert.equal(requests.filter((url) => url === origin + path).length, 1);
  }
  assert.deepEqual(result.redirects.map(({ start, hops }) => ({
    start, urls: hops.map((hop) => hop.url), statuses: hops.map((hop) => hop.status),
  })), [
    { start: "http://elliottbarnes.ca/", urls: ["http://elliottbarnes.ca/", `${origin}/`], statuses: [301, 200] },
    { start: "http://www.elliottbarnes.ca/", urls: ["http://www.elliottbarnes.ca/", "https://www.elliottbarnes.ca/", `${origin}/`], statuses: [301, 301, 200] },
    { start: "https://www.elliottbarnes.ca/", urls: ["https://www.elliottbarnes.ca/", `${origin}/`], statuses: [301, 200] },
  ]);
  assert.equal(requests.filter((url) => url === `${origin}/`).length, 4);
  assert.match(result.not_found.path, missingPath);
  assert.equal(result.not_found.status, 404);
  assert.equal(result.not_found.sha256, digest(files.get("404.html")));
  assert.equal(requests.at(-1), origin + result.not_found.path);
  assert.equal(requests.length, 31);
  assert.ok(Number.isFinite(Date.parse(result.checked_at)));
});

test("live verification rejects stale bytes and wrong content types at the exact versioned asset URLs", async (t) => {
  for (const key of ["styles.css", "script.js"]) {
    for (const failure of ["stale", "wrong-type", "missing-type"]) {
      const { directory, files, requests, mockFetch } = await fixture(t);
      const path = `/${key}?v=${digest(files.get(key)).slice(0, 12)}`;
      const fetchImpl = mockFetch((url) => url === origin + path ? new Response(
        failure === "stale" ? "stale deployment" : files.get(key),
        { headers: failure === "missing-type" ? {} : { "content-type": failure === "wrong-type" ? "text/plain" : contentType(key) } },
      ) : undefined);
      const error = failure === "stale" ? /Byte hash differs/ : /Unexpected content type/;
      await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), error);
      assert.equal(requests.filter((url) => url === origin + path).length, 1);
    }
  }
});

test("live verification rejects stale bytes for public files, the apex, and custom 404", async (t) => {
  for (const [matches, status, label] of [
    [(url) => url === `${origin}/styles.css`, 200, /styles\.css: Byte hash differs/],
    [(url) => url === `${origin}/`, 200, /Apex homepage: Byte hash differs/],
    [(url) => missingPath.test(new URL(url).pathname), 404, /Custom 404: Byte hash differs/],
  ]) {
    const { directory, mockFetch } = await fixture(t);
    const fetchImpl = mockFetch((url) => matches(url) ? new Response("stale deployment", {
      status, headers: { "content-type": contentType(url.endsWith("styles.css") ? "styles.css" : "index.html") },
    }) : undefined);
    await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1, delayMs: 0 }), label);
  }
});

test("live verification refuses an external redirect without requesting its destination", async (t) => {
  const { directory, requests, mockFetch } = await fixture(t);
  const fetchImpl = mockFetch((url) => url === "http://elliottbarnes.ca/" ?
    new Response(null, { status: 302, headers: { location: "https://example.org/" } }) : undefined);
  await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /Unexpected redirect destination: https:\/\/example\.org\//);
  assert.ok(!requests.some((url) => url.includes("example.org")));
});

test("live verification rejects incorrect and missing content types", async (t) => {
  for (const type of ["application/octet-stream", ""]) {
    const { directory, files, mockFetch } = await fixture(t);
    const fetchImpl = mockFetch((url) => url === `${origin}/styles.css` ?
      new Response(files.get("styles.css"), { headers: type ? { "content-type": type } : {} }) : undefined);
    await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /styles\.css: Unexpected content type:/);
  }
});

test("live verification requires custom error pages to return HTTP 404, not a soft 404", async (t) => {
  const { directory, files, mockFetch } = await fixture(t);
  const fetchImpl = mockFetch((url) => missingPath.test(new URL(url).pathname) ?
    new Response(files.get("404.html"), { status: 200, headers: { "content-type": contentType("404.html") } }) : undefined);
  await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /Custom 404: Expected HTTP 404, received 200/);
});

test("live verification recovers from transient failures within three attempts", async (t) => {
  const { directory, requests, mockFetch } = await fixture(t);
  const fetchImpl = mockFetch((url, count) => {
    if (url === `${origin}/styles.css` && count < 3) throw new Error("temporary outage");
  });
  const result = await verifyLive(directory, { fetchImpl, delayMs: 0 });
  assert.equal(result.files, 20);
  assert.equal(requests.filter((url) => url === `${origin}/styles.css`).length, 3);
});

test("live verification bounds persistent failures by the configured attempt count", async (t) => {
  for (const attempts of [1, 2, 3]) {
    const { directory, requests, mockFetch } = await fixture(t);
    const fetchImpl = mockFetch((url) => {
      if (url === `${origin}/styles.css`) throw new Error("persistent outage");
    });
    await assert.rejects(verifyLive(directory, { fetchImpl, attempts, delayMs: 0 }), /styles\.css: persistent outage/);
    assert.equal(requests.filter((url) => url === `${origin}/styles.css`).length, attempts);
  }
});

test("live verification rejects invalid attempt limits before issuing requests", async (t) => {
  const { directory, requests, mockFetch } = await fixture(t);
  for (const attempts of [0, 4, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(verifyLive(directory, { fetchImpl: mockFetch(), attempts, delayMs: 0 }), /attempts must be between one and three/);
  }
  assert.deepEqual(requests, []);
});

test("live verification bounds redirect loops to four hops per attempt", async (t) => {
  const { directory, requests, mockFetch } = await fixture(t);
  const fetchImpl = mockFetch((url) => ["http://elliottbarnes.ca/", "https://www.elliottbarnes.ca/"].includes(url) ?
    new Response(null, { status: 308, headers: { location: "https://www.elliottbarnes.ca/" } }) : undefined);
  await assert.rejects(verifyLive(directory, { fetchImpl, attempts: 1 }), /Too many redirects/);
  assert.equal(requests.filter((url) => url === "http://elliottbarnes.ca/").length, 1);
  assert.equal(requests.filter((url) => url === "https://www.elliottbarnes.ca/").length, 3);
});
