import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const cleanPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const target = join(root, cleanPath === "/" ? "index.html" : cleanPath);

    if (relative(root, target).startsWith("..")) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const targetStat = await stat(target);
    const filePath = targetStat.isDirectory() ? join(target, "index.html") : target;
    const body = await readFile(filePath);

    response.writeHead(200, {
      "Content-Type": types[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Portfolio preview: http://${host}:${port}`);
});
