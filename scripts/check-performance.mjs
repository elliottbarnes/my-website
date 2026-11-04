import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { readArtifactManifest } from "./artifact.mjs";

// These are reproducible artifact measurements, not a browser waterfall or
// Core Web Vitals. Optional images/scripts are included only in publicBytes.
export function entryResourcePaths(html) {
  const scripts = [], styles = [];
  const markup = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, "$1</script>");
  for (const [tag] of markup.matchAll(/<(?:script|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map([...tag.matchAll(/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
      .map(([, name, double, single, bare]) => [name.toLowerCase(), double ?? single ?? bare ?? ""]));
    if (/^<script\b/i.test(tag) && attributes.has("src")) scripts.push(attributes.get("src"));
    if (/^<link\b/i.test(tag) && (attributes.get("rel") || "").toLowerCase().split(/\s+/).includes("stylesheet")) {
      styles.push(attributes.get("href"));
    }
  }
  if ([...scripts, ...styles].some(path => !path)) throw new Error("Entry resource has an empty URL");
  return { scripts, styles };
}

export async function measureArtifact(directory) {
  const manifest = await readArtifactManifest(directory);
  const entries = await Promise.all(Object.entries(manifest.assets).map(async ([source, entry]) => {
    const bytes = await readFile(join(directory, entry.path));
    return { source, path: entry.path, bytes, rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  }));
  const html = entries.find(entry => entry.source === "index.html");
  const text = html.bytes.toString("utf8");
  const { scripts, styles } = entryResourcePaths(text);
  const summarize = paths => {
    const files = [...new Set(paths)].map(path => {
      const entry = entries.find(candidate => `/${candidate.path}` === path);
      if (!entry) throw new Error(`Entry resource is outside the artifact: ${path}`);
      return { path, rawBytes: entry.rawBytes, gzipBytes: entry.gzipBytes };
    });
    return { count: files.length, rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
      gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0), files };
  };
  return { htmlBytes: html.rawBytes, eagerJavaScript: summarize(scripts), eagerCSS: summarize(styles),
    publicFiles: entries.length, publicBytes: entries.reduce((sum, entry) => sum + entry.rawBytes, 0),
    note: "Raw artifact bytes and local gzip estimates; excludes fonts/images from entry totals and is not a browser performance measurement." };
}

export function checkBudgets(measurement, budget) {
  const checks = [
    ["eager JavaScript bytes", measurement.eagerJavaScript.rawBytes, budget.eagerJavaScriptBytes],
    ["eager script requests", measurement.eagerJavaScript.count, budget.eagerScriptCount],
    ["eager stylesheet bytes", measurement.eagerCSS.rawBytes, budget.eagerCSSBytes],
    ["homepage HTML bytes", measurement.htmlBytes, budget.htmlBytes],
    ["complete artifact bytes", measurement.publicBytes, budget.publicBytes],
  ];
  for (const [name, actual, limit] of checks) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error(`Missing or invalid budget: ${name}`);
    if (actual > limit) throw new Error(`${name}: ${actual} exceeds budget ${limit}`);
  }
  return checks.map(([name, actual, limit]) => ({ name, actual, limit }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const measurement = await measureArtifact(resolve(process.argv[2] || "dist"));
    const budget = JSON.parse(await readFile(new URL("../performance-budgets.json", import.meta.url), "utf8"));
    console.log(JSON.stringify({ ...measurement, checks: checkBudgets(measurement, budget) }, null, 2));
  } catch (error) { console.error(`Performance budget failed: ${error.message}`); process.exitCode = 1; }
}
