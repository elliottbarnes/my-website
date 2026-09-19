import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { PUBLIC_FILES, assertRegularPublicFile, contentType } from "./scripts/public-files.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export function createPreviewServer({ root = projectRoot } = {}) {
  return createServer(async (request, response) => {
    function send(status, body, type, headers = {}) {
      response.writeHead(status, {
        "Content-Type": type,
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      send(405, "Method not allowed", "text/plain; charset=utf-8", { Allow: "GET, HEAD" });
      return;
    }
    let file;
    try {
      const url = new URL(request.url || "/", "http://localhost");
      file = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
    } catch {
      send(400, "Invalid URL", "text/plain; charset=utf-8");
      return;
    }
    try {
      // Serve only the publication allowlist, even in source-preview mode.
      await assertRegularPublicFile(root, file);
      send(200, await readFile(join(root, file)), contentType(file));
    } catch {
      try {
        await assertRegularPublicFile(root, "404.html");
        send(404, await readFile(join(root, "404.html")), contentType("404.html"));
      } catch {
        send(404, "Not found", "text/plain; charset=utf-8");
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--dir")) {
      throw new Error("Usage: node server.mjs [--dir dist]");
    }
    const root = args.length ? resolve(args[1]) : projectRoot;
    for (const file of PUBLIC_FILES) await assertRegularPublicFile(root, file);
    const port = Number(process.env.PORT || 4173);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be an integer from 0 to 65535");
    const host = process.env.HOST || "127.0.0.1";
    const server = createPreviewServer({ root });
    server.on("error", (error) => {
      console.error(`Preview failed: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      console.log(`Portfolio preview: http://${host}:${server.address().port} (${root})`);
    });
  } catch (error) {
    console.error(`Preview failed: ${error.message}`);
    process.exitCode = 1;
  }
}
