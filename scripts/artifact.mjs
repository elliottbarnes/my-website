import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { PUBLIC_FILES, CONTENT_TYPES, assertRegularPublicFile } from "./public-files.mjs";
import { renderProjects } from "./generate-projects.mjs";

export const ROOT_FILES = Object.freeze(["index.html", "404.html", "robots.txt", "sitemap.xml", "site.webmanifest"]);
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const manifestPath = (directory) => `${directory.replace(/\/$/, "")}.manifest.json`;
export const cacheControl = (file) => ROOT_FILES.includes(file)
  ? "no-cache,max-age=0,must-revalidate" : "public,max-age=31536000,immutable";
export function publishedPath(source, hash) {
  if (ROOT_FILES.includes(source)) return source;
  const extension = extname(source);
  const base = source.startsWith("assets/") ? source : `assets/${source}`;
  return `${base.slice(0, -extension.length)}.${hash.slice(0, 12)}${extension}`;
}

export async function readArtifactManifest(directory, { optional = false, previous = false } = {}) {
  let bytes;
  try {
    const path = manifestPath(directory);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Artifact manifest must be a regular file");
    bytes = await readFile(path, "utf8");
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw error;
  }
  const manifest = JSON.parse(bytes);
  if (manifest.version !== 1 || !manifest.assets || typeof manifest.assets !== "object"
    || (!previous && JSON.stringify(Object.keys(manifest.assets).sort()) !== JSON.stringify([...PUBLIC_FILES].sort()))) {
    throw new Error("Artifact manifest must contain the exact source allowlist");
  }
  const paths = new Set();
  for (const [source, entry] of Object.entries(manifest.assets)) {
    const safeSource = PUBLIC_FILES.includes(source) || (previous && /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(source)
      && Object.hasOwn(CONTENT_TYPES, extname(source)));
    if (!safeSource || !entry || !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.path !== publishedPath(source, entry.sha256)
      || paths.has(entry.path)) throw new Error(`Invalid artifact manifest entry: ${source}`);
    paths.add(entry.path);
  }
  return manifest;
}

// Resource URLs must be complete literals. Dynamic URL construction cannot be
// content-addressed, so callers use explicit arrays (including optional games).
export function resourceReferences(text) {
  const references = [];
  for (const match of text.matchAll(/(["'`])([^"'`\r\n]*?)\1/g)) references.push(match[2]);
  for (const match of text.matchAll(/url\(\s*([^"'\s)][^\s)]*)\s*\)/g)) references.push(match[1]);
  return references;
}

export async function createArtifact(root) {
  const sources = new Map();
  for (const source of PUBLIC_FILES) {
    await assertRegularPublicFile(root, source);
    sources.set(source, await readFile(join(root, source)));
  }
  sources.set("index.html", Buffer.from(renderProjects(sources.get("index.html").toString("utf8"))));
  const assets = {}, contents = new Map(), active = new Set();
  function compile(source) {
    if (assets[source]) return assets[source];
    if (active.has(source)) throw new Error(`Cyclic asset references: ${source}`);
    active.add(source);
    let bytes = sources.get(source);
    function rewrite(raw) {
      if (raw.includes("${") && raw.startsWith("/assets/")) throw new Error(`${source}: resource URL must be a complete literal: ${raw}`);
      if (!/^(?:\/|\.\.?\/|https:\/\/elliottbarnes\.ca\/)/.test(raw) || /\s/.test(raw)
        || !/\.(?:html|css|js|png|jpg|webp|svg|ttf|woff2|txt|xml|webmanifest)(?:[?#].*)?$/.test(raw)) return raw;
      let url;
      try { url = new URL(raw, `https://elliottbarnes.ca/${source}`); } catch { return raw; }
      if (url.origin !== "https://elliottbarnes.ca") return raw;
      const target = decodeURIComponent(url.pathname).slice(1);
      if (!PUBLIC_FILES.includes(target) || ROOT_FILES.includes(target)) return raw;
      const compiled = compile(target);
      return `${raw.startsWith("https://elliottbarnes.ca/") ? "https://elliottbarnes.ca" : ""}/${compiled.path}${url.hash}`;
    }
    if (/\.(?:html|css|js|svg|webmanifest|xml|txt)$/.test(source)) {
      let text = bytes.toString("utf8");
      text = text.replace(/(["'`])([^"'`\r\n]*?)\1/g, (match, quote, raw) => `${quote}${rewrite(raw)}${quote}`);
      text = text.replace(/url\(\s*([^"'\s)][^\s)]*)\s*\)/g, (match, raw) => `url(${rewrite(raw)})`);
      bytes = Buffer.from(text);
    }
    const sha256 = digest(bytes), path = publishedPath(source, sha256);
    assets[source] = { path, sha256 };
    contents.set(path, bytes);
    active.delete(source);
    return assets[source];
  }
  for (const source of PUBLIC_FILES) compile(source);
  return { manifest: { version: 1, assets: Object.fromEntries(PUBLIC_FILES.map(file => [file, assets[file]])) }, contents };
}
