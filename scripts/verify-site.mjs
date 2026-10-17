import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, VERSIONED_FILES, contentType, assertRegularPublicFile, inspectPublicTree } from "./public-files.mjs";

import { cacheControl, createArtifact, readArtifactManifest, resourceReferences } from "./artifact.mjs";

import { PROJECTS } from "../data/projects.mjs";

const origin = "https://elliottbarnes.ca";

function attributes(tag) {
  const values = new Map();
  for (const match of tag.matchAll(/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    values.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return values;
}

function tags(html) {
  // Targeted checks for this hand-authored static site, not an HTML conformance parser.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, "$1</script>");
  return [...markup.matchAll(/<[a-z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?\s*>/gi)].map((match) => ({
    name: match[0].match(/^<([\w:-]+)/)[1].toLowerCase(), attrs: attributes(match[0]),
  }));
}

export async function verifySite(directory, { sourceRoot } = {}) {
  const artifactManifest = await readArtifactManifest(directory, { optional: true });
  if (sourceRoot && !artifactManifest) throw new Error("Built artifact requires its private manifest");
  const paths = Object.fromEntries(PUBLIC_FILES.map(file => [file, artifactManifest?.assets[file].path || file]));
  const published = Object.values(paths);
  await inspectPublicTree(directory, { files: published });
  const expected = sourceRoot ? await createArtifact(sourceRoot) : null;
  const content = new Map();
  const sha256 = {};
  for (const file of PUBLIC_FILES) {
    await assertRegularPublicFile(directory, paths[file], published);
    const bytes = await readFile(join(directory, paths[file]));
    if (!bytes.length) throw new Error(`Empty public file: ${file}`);
    if (file === "assets/dragon-ball.png") {
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)
        || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") {
        throw new Error(`${file}: invalid PNG signature or IHDR header`);
      }
      if (bytes.readUInt32BE(16) !== 256 || bytes.readUInt32BE(20) !== 256) {
        throw new Error(`${file}: favicon must be 256x256 pixels`);
      }
    }
    content.set(file, bytes.toString("utf8"));
    sha256[paths[file]] = createHash("sha256").update(bytes).digest("hex");
    if (artifactManifest && sha256[paths[file]] !== artifactManifest.assets[file].sha256) throw new Error(`Artifact hash mismatch: ${paths[file]}`);
    if (expected && (expected.manifest.assets[file].path !== paths[file]
      || !bytes.equals(expected.contents.get(paths[file])))) throw new Error(`Built file differs from source: ${file}`);
  }

  const documents = new Map();
  for (const file of ["index.html", "404.html"]) {
    const parsed = tags(content.get(file));
    const ids = new Set();
    for (const tag of parsed) {
      const id = tag.attrs.get("id");
      if (id !== undefined) {
        if (!id || ids.has(id)) throw new Error(`${file}: empty or duplicate id ${JSON.stringify(id)}`);
        ids.add(id);
      }
    }
    if (!/<title>[^<]+<\/title>/i.test(content.get(file))) throw new Error(`${file}: missing document title`);
    documents.set(file, { parsed, ids });
  }

  function reference(raw, from, { localOnly = false } = {}) {
    if (!raw) throw new Error(`${from}: empty reference`);
    let url;
    try {
      url = new URL(raw.replaceAll("&amp;", "&"), `${origin}/${from}`);
    } catch {
      throw new Error(`${from}: invalid reference ${JSON.stringify(raw)}`);
    }
    if (!["https:", "http:", "mailto:", "tel:"].includes(url.protocol)) {
      throw new Error(`${from}: unsupported reference protocol ${url.protocol}`);
    }
    if (url.origin !== origin) {
      if (localOnly) throw new Error(`${from}: expected a local reference: ${raw}`);
      return;
    }
    let file, fragment;
    try {
      file = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
      fragment = decodeURIComponent(url.hash.slice(1));
    } catch {
      throw new Error(`${from}: invalid encoded reference: ${raw}`);
    }
    if (!published.includes(file)) throw new Error(`${from}: reference is not published: ${raw}`);
    if (fragment && documents.has(file) && !documents.get(file).ids.has(fragment)) {
      throw new Error(`${from}: missing fragment target: ${raw}`);
    }
  }

  for (const [file, document] of documents) {
    for (const tag of document.parsed) {
      for (const attribute of ["href", "src"]) {
        if (tag.attrs.has(attribute)) reference(tag.attrs.get(attribute), file, { localOnly: attribute === "src" });
      }
      if (tag.name === "meta" && tag.attrs.get("property") === "og:image") {
        reference(tag.attrs.get("content"), file, { localOnly: true });
      }
    }
    for (const rel of ["icon", "apple-touch-icon"]) {
      const icons = document.parsed.filter((tag) => tag.name === "link" && tag.attrs.get("rel")?.split(/\s+/).includes(rel));
      if (icons.length !== 1 || icons[0].attrs.get("href") !== `/${paths["assets/dragon-ball.png"]}`
        || icons[0].attrs.get("type") !== "image/png" || icons[0].attrs.get("sizes") !== "256x256") {
        throw new Error(`${file}: expected exactly one ${rel} reference to the 256x256 image/png Dragon Ball favicon`);
      }
    }
  }
  const index = documents.get("index.html").parsed;
  // The homepage remains useful without JavaScript: every project has ordinary
  // demo and source links, each with an accessible name.
  for (const [attribute, base] of [["data-demo", "https://elliottbarnes.github.io/"], ["data-source", "https://github.com/elliottbarnes/"]]) {
    const links = index.filter((tag) => tag.attrs.has(attribute));
    const expected = PROJECTS.map(project => project.id).sort();
    if (JSON.stringify(links.map((tag) => tag.attrs.get(attribute)).sort()) !== JSON.stringify(expected)) {
      throw new Error(`index.html: expected ${PROJECTS.length} unique ${attribute} links`);
    }
    for (const tag of links) {
      const slug = tag.attrs.get(attribute);
      if (tag.name !== "a" || tag.attrs.get("href") !== (attribute === "data-demo" ? PROJECTS.find(project => project.id === slug)?.demo.url : PROJECTS.find(project => project.id === slug)?.source) || !tag.attrs.get("aria-label")) {
        throw new Error(`index.html: invalid ${attribute} destination or accessible name`);
      }
    }
  }
  for (const file of VERSIONED_FILES.filter((file) => file.endsWith(".css"))) {
    for (const match of content.get(file).matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
      reference(match[1] ?? match[2] ?? match[3], paths[file], { localOnly: true });
    }
  }

  // Every code asset must be referenced by HTML or another published asset.
  // Optional games load through literal URLs in the loader, not eager script tags.
  const incoming = new Map(VERSIONED_FILES.map(file => [paths[file], 0]));
  for (const file of PUBLIC_FILES.filter(file => /\.(?:html|css|js)$/.test(file))) {
    for (const raw of resourceReferences(content.get(file))) {
      if (!/^(?:\/assets\/|\/script\.js|\/styles\.css|\.\.?\/)/.test(raw)) continue;
      const url = new URL(raw, `${origin}/${paths[file]}`);
      const target = decodeURIComponent(url.pathname).slice(1);
      // Relative require calls are checked too. Non-resource strings are ignored.
      if (!/\.(?:css|js|png|jpg|webp|svg|ttf|woff2)$/.test(target)) continue;
      if (raw.includes("${")) throw new Error(`${file}: dynamic resource URL is not verifiable: ${raw}`);
      reference(raw, paths[file], { localOnly: true });
      if (incoming.has(target)) incoming.set(target, incoming.get(target) + 1);
    }
  }
  for (const [file, count] of incoming) if (count === 0) throw new Error(`Unreferenced code asset: ${file}`);
  const eager = new Set();
  for (const tag of index.filter(tag => tag.name === "link" && tag.attrs.get("rel")?.split(/\s+/).includes("stylesheet"))) {
    const url = new URL(tag.attrs.get("href"), origin);
    if (eager.has(url.pathname)) throw new Error(`Duplicate eager asset: ${url.pathname}`);
    eager.add(url.pathname);
    if (url.origin !== origin || !url.pathname.endsWith(".css")) throw new Error("index.html: unknown stylesheet reference");
  }
  for (const tag of index.filter(tag => tag.name === "script" && tag.attrs.has("src"))) {
    const path = new URL(tag.attrs.get("src"), origin).pathname;
    if (eager.has(path)) throw new Error(`Duplicate eager asset: ${path}`);
    eager.add(path);
    if (!path.endsWith(".js")) throw new Error("index.html: unknown script reference");
  }
  for (const [file, document] of documents) {
    for (const script of document.parsed.filter((tag) => tag.name === "script" && tag.attrs.has("src"))) {
      if (!script.attrs.has("defer") || script.attrs.has("async")) {
        throw new Error(`${file}: ${script.attrs.get("src")} must use defer without async`);
      }
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(content.get("site.webmanifest"));
  } catch {
    throw new Error("site.webmanifest: invalid JSON");
  }
  if (!manifest || typeof manifest.name !== "string" || !manifest.name.trim() || !Array.isArray(manifest.icons) || !manifest.icons.length) throw new Error("site.webmanifest: missing name or icons");
  reference(manifest.start_url, "site.webmanifest", { localOnly: true });
  for (const icon of manifest.icons) reference(icon?.src, "site.webmanifest", { localOnly: true });
  if (manifest.icons.length !== 1 || manifest.icons[0].src !== `/${paths["assets/dragon-ball.png"]}`
    || manifest.icons[0].type !== "image/png" || manifest.icons[0].sizes !== "256x256") {
    throw new Error("site.webmanifest: expected exactly one 256x256 image/png Dragon Ball favicon");
  }

  const structured = [...content.get("index.html").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((match) => attributes(` script ${match[1]}`).get("type") === "application/ld+json");
  if (!structured.length) throw new Error("index.html: missing JSON-LD");
  for (const match of structured) {
    try {
      const data = JSON.parse(match[2]);
      if (!data || data["@type"] !== "Person" || typeof data.name !== "string") throw new Error();
    } catch {
      throw new Error("index.html: invalid Person JSON-LD");
    }
  }
  const sitemap = [...content.get("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)];
  if (!sitemap.length) throw new Error("sitemap.xml: missing URL");
  for (const match of sitemap) reference(match[1], "sitemap.xml", { localOnly: true });
  for (const match of content.get("robots.txt").matchAll(/^Sitemap:\s*(\S+)/gim)) reference(match[1], "robots.txt", { localOnly: true });
  return { files: PUBLIC_FILES.length, sha256, paths,
    publication: PUBLIC_FILES.map(source => ({ source, path: paths[source], sha256: sha256[paths[source]],
      content_type: contentType(source), cache_control: cacheControl(paths[source]) })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const directory = args[0] && !args[0].startsWith("-") ? args.shift() : "dist";
    let sourceRoot, json = false;
    while (args.length) {
      const argument = args.shift();
      if (argument === "--source" && args.length && !args[0].startsWith("-")) sourceRoot = args.shift();
      else if (argument === "--json") json = true;
      else throw new Error("Usage: node scripts/verify-site.mjs [dist] [--source directory] [--json]");
    }
    const result = await verifySite(resolve(directory), { sourceRoot: sourceRoot && resolve(sourceRoot) });
    console.log(json ? JSON.stringify(result, null, 2) : `Verified ${result.files} public files, metadata, local links, and project destinations.`);
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
