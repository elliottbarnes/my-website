import { createServer } from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
export const LAB_FILES = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/lab.css': ['lab.css', 'text/css; charset=utf-8'],
  '/assets/interactive/playground.css': ['assets/interactive/playground.css', 'text/css; charset=utf-8'],
  '/assets/interactive/playground.js': ['assets/interactive/playground.js', 'text/javascript; charset=utf-8'],
  '/assets/interactive/live-prism.js': ['assets/interactive/live-prism.js', 'text/javascript; charset=utf-8'],
});

export function createLabServer() {
  return createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      // A second boundary: even an accidentally configured endpoint cannot be
      // called from this local prototype. Change deliberately in a future review.
      'Content-Security-Policy': "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    const send = (code, body, type = 'text/plain; charset=utf-8') => {
      response.writeHead(code, { ...headers, 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) { send(405, 'Method not allowed'); return; }
    let path;
    try { path = new URL(request.url, 'http://localhost').pathname; }
    catch { send(400, 'Invalid URL'); return; }
    const file = LAB_FILES[path];
    if (!file) { send(404, 'Not found'); return; }
    try {
      const target = new URL(file[0], import.meta.url);
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) { send(404, 'Not found'); return; }
      send(200, await readFile(target), file[1]);
    } catch { send(404, 'Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4190);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  createLabServer().listen(port, '127.0.0.1', () => console.log(`Local-only demo lab: http://127.0.0.1:${port}/ (${root})`));
}
