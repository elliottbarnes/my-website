import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, assertRegularPublicFile, inspectPublicTree } from "./public-files.mjs";

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
  await inspectPublicTree(directory);
  const content = new Map();
  const sha256 = {};
  for (const file of PUBLIC_FILES) {
    await assertRegularPublicFile(directory, file);
    const bytes = await readFile(join(directory, file));
    if (!bytes.length) throw new Error(`Empty public file: ${file}`);
    content.set(file, bytes.toString("utf8"));
    sha256[file] = createHash("sha256").update(bytes).digest("hex");
    if (sourceRoot) {
      await assertRegularPublicFile(sourceRoot, file);
      if (!bytes.equals(await readFile(join(sourceRoot, file)))) throw new Error(`Built file differs from source: ${file}`);
    }
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
    if (!PUBLIC_FILES.includes(file)) throw new Error(`${from}: reference is not published: ${raw}`);
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
  }
  const index = documents.get("index.html").parsed;
  const shortcuts = index.filter((tag) => tag.attrs.has("data-shortcut"));
  const keys = shortcuts.map((tag) => tag.attrs.get("data-shortcut"));
  if (JSON.stringify([...keys].sort()) !== JSON.stringify(["1", "2", "3"])) {
    throw new Error("index.html: expected unique shortcuts 1, 2, and 3");
  }
  for (const tag of shortcuts) {
    if (tag.name !== "a" || !tag.attrs.get("href")?.startsWith("#")) throw new Error("Shortcut must be an in-page link");
  }
  const toggle = index.filter((tag) => tag.attrs.has("data-fx-toggle"));
  const label = index.filter((tag) => tag.attrs.has("data-fx-label"));
  const body = index.find((tag) => tag.name === "body");
  if (toggle.length !== 1 || toggle[0].name !== "button" || toggle[0].attrs.get("aria-pressed") !== "false" || !toggle[0].attrs.get("aria-label") || label.length !== 1 || !body?.attrs.get("class")?.split(/\s+/).includes("fx-off")) {
    throw new Error("index.html: screen texture must start off with one labeled toggle and label");
  }
  for (const match of content.get("styles.css").matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
    reference(match[1] ?? match[2] ?? match[3], "styles.css", { localOnly: true });
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
  return { files: PUBLIC_FILES.length, sha256 };
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
    console.log(json ? JSON.stringify(result, null, 2) : `Verified ${result.files} public files, metadata, local links, and interaction hooks.`);
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
