import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A proposed header set, never an AWS update request. Generate from final build
// bytes: editing JSON-LD changes its CSP hash even when only whitespace changes.
export async function generateSecurityHeaders(directory) {
  const scripts = new Set();
  const documents = {};
  for (const name of ["index.html", "playground.html", "404.html"]) {
    const html = await readFile(resolve(directory, name), "utf8").catch(error => {
      // Historical artifacts predate the optional Playground page.
      if (name === "playground.html" && error.code === "ENOENT") return null;
      throw error;
    });
    if (html === null) continue;
    documents[name] = createHash("sha256").update(html).digest("hex");
    for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/i.test(attributes) || !body.trim()) continue;
      if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) {
        throw new Error(`${name}: review executable inline JavaScript before changing the CSP`);
      }
      JSON.parse(body);
      scripts.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
    }
  }
  const csp = ["default-src 'self'", `script-src 'self' ${[...scripts].sort().join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "form-action 'none'"].join("; ");
  const headers = {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security": "max-age=86400",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  return { schema_version: 1, status: "proposal-only", documents, headers,
    report_only_headers: { ...headers, "Content-Security-Policy": undefined,
      "Content-Security-Policy-Report-Only": csp },
    limitations: ["Dynamic inline styles remain allowed; executable inline scripts are not allowed.",
      "No reporting endpoint is configured; report-only requires explicit browser inspection.",
      "The current CloudFront response-headers policy and its ETag must be read before preparing an update.",
      "AWS application and subsequent HSTS increases require separate approval."] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/plan-security-headers.mjs <built-artifact-directory>");
  console.log(JSON.stringify(await generateSecurityHeaders(resolve(process.argv[2])), null, 2));
}
