import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, contentType } from "./public-files.mjs";
import { verifySite } from "./verify-site.mjs";

const ORIGIN = "https://elliottbarnes.ca";
const REDIRECT_STARTS = [
  "http://elliottbarnes.ca/",
  "http://www.elliottbarnes.ca/",
  "https://www.elliottbarnes.ca/",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

export async function verifyLive(directory, { fetchImpl = fetch, attempts = 3, delayMs = 1000 } = {}) {
  const root = resolve(directory);
  const artifact = await verifySite(root);
  if (PUBLIC_FILES.length !== 20 || artifact.files !== 20) {
    throw new Error("Live verification requires the fixed 20-file public allowlist.");
  }
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error("Verification attempts must be between one and three.");
  }
  const request = (url) => fetchImpl(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "Elliott-Portfolio-Deployment-Verification/1.0" },
  });
  async function retry(label, operation) {
    let last;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        last = error;
        if (attempt < attempts) await delay(delayMs * attempt);
      }
    }
    throw new Error(`${label}: ${last?.message ?? last}`);
  }
  async function verifyBytes(url, expectedStatus, expectedHash, expectedType) {
    const response = await request(url);
    if (response.status !== expectedStatus) {
      await response.body?.cancel();
      throw new Error(`Expected HTTP ${expectedStatus}, received ${response.status}`);
    }
    const actualType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (actualType !== expectedType.split(";")[0].trim()) {
      await response.body?.cancel();
      throw new Error(`Unexpected content type: ${actualType || "missing"}`);
    }
    const actualHash = hash(Buffer.from(await response.arrayBuffer()));
    if (actualHash !== expectedHash) {
      throw new Error(`Byte hash differs: expected ${expectedHash}, received ${actualHash}`);
    }
    return actualHash;
  }

  const hashes = {};
  // Bounded parallel requests keep this check small and make failures attributable to exact keys.
  for (let offset = 0; offset < PUBLIC_FILES.length; offset += 4) {
    const batch = PUBLIC_FILES.slice(offset, offset + 4);
    await Promise.all(batch.map(async (key) => {
      hashes[key] = await retry(key, () => verifyBytes(
        `${ORIGIN}/${key}`, 200, artifact.sha256[key], contentType(key),
      ));
    }));
  }
  await retry("Apex homepage", () => verifyBytes(
    `${ORIGIN}/`, 200, artifact.sha256["index.html"], contentType("index.html"),
  ));

  const redirects = [];
  for (const start of REDIRECT_STARTS) {
    const chain = await retry(start, async () => {
      let current = start;
      const hops = [];
      for (let hop = 0; hop < 4; hop++) {
        const response = await request(current);
        const location = response.headers.get("location");
        await response.body?.cancel();
        hops.push({ url: current, status: response.status, location });
        if (response.status === 200) {
          if (current !== `${ORIGIN}/` || hops.length < 2) {
            throw new Error("Request did not redirect to the canonical HTTPS apex.");
          }
          return hops;
        }
        if (![301, 302, 307, 308].includes(response.status) || !location) {
          throw new Error(`Expected redirect, received ${response.status}`);
        }
        const target = new URL(location, current);
        if (target.protocol !== "https:" || target.username || target.password || target.port
          || !["elliottbarnes.ca", "www.elliottbarnes.ca"].includes(target.hostname)
          || target.pathname !== "/" || target.search || target.hash) {
          throw new Error(`Unexpected redirect destination: ${target.href}`);
        }
        current = target.href;
      }
      throw new Error("Too many redirects.");
    });
    redirects.push({ start, hops: chain });
  }

  const missingPath = `/__portfolio_missing_${randomUUID()}.html`;
  const missingHash = artifact.sha256["404.html"];
  await retry("Custom 404", () => verifyBytes(
    `${ORIGIN}${missingPath}`, 404, missingHash, contentType("404.html"),
  ));
  return {
    origin: ORIGIN,
    files: PUBLIC_FILES.length,
    sha256: hashes,
    redirects,
    not_found: { path: missingPath, status: 404, sha256: missingHash },
    checked_at: new Date().toISOString(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const paths = args.filter((arg) => arg !== "--json");
  if (paths.length > 1 || args.some((arg) => arg.startsWith("--") && arg !== "--json")) {
    console.error("Usage: node scripts/verify-live.mjs [dist-directory] [--json]");
    process.exitCode = 2;
  } else {
    try {
      const result = await verifyLive(paths[0] ?? "dist");
      console.log(json ? JSON.stringify(result) :
        `Verified ${result.files} HTTPS file hashes, canonical redirects and the custom 404.`);
    } catch (error) {
      console.error(`Live verification failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
