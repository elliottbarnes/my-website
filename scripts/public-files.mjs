import { lstat, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

// This is the complete publication boundary. Source files outside this list
// remain local even when they are tracked in the repository.
export const PUBLIC_FILES = Object.freeze([
  "index.html", "404.html", "styles.css", "script.js", "robots.txt",
  "sitemap.xml", "site.webmanifest", "assets/favicon.svg", "assets/social-card.svg",
  "assets/dragon-ball.png", "assets/dragon-ball-1.webp", "assets/dragon-ball-2.webp", "assets/dragon-ball-3.webp", "assets/dragon-ball-4.webp", "assets/dragon-ball-5.webp", "assets/dragon-ball-6.webp", "assets/dragon-ball-7.webp",
  "assets/themes.css", "assets/themes.js", "assets/workspace.js",
  "assets/projects/glassbox.jpg", "assets/projects/pixel-language.jpg", "assets/projects/architecture-lab.jpg", "assets/projects/automata-lab.jpg", "assets/projects/ellmiott.jpg", "assets/projects/batchline.jpg", "assets/projects/evaldeck.jpg",
  "assets/animation.js", "assets/entrance-effects.js", "assets/brick-breaker.js", "assets/training-chamber.js", "assets/memoji-saiyan.webp", "assets/fonts/IBMPlexMono-Regular.ttf", "assets/fonts/OFL.txt",
]);

export const VERSIONED_FILES = Object.freeze(PUBLIC_FILES.filter((file) => /\.(?:css|js)$/.test(file)));

export const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
});

export const contentType = (file) => CONTENT_TYPES[extname(file)] || "application/octet-stream";

export async function assertRegularPublicFile(root, file) {
  if (!PUBLIC_FILES.includes(file)) throw new Error(`Not a public file: ${file}`);
  const parts = file.split("/");
  const paths = [root, ...parts.map((_, index) => join(root, ...parts.slice(0, index + 1)))];
  for (const [index, path] of paths.entries()) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Symlink is not permitted: ${path}`);
    const expected = index === paths.length - 1 ? info.isFile() : info.isDirectory();
    if (!expected) throw new Error(`Expected ${index === paths.length - 1 ? "file" : "directory"}: ${path}`);
  }
}

export async function inspectPublicTree(directory, { allowMissing = false } = {}) {
  let root;
  try {
    root = await lstat(directory);
  } catch (error) {
    if (allowMissing && error.code === "ENOENT") return [];
    throw error;
  }
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error(`Artifact root must be a real directory: ${directory}`);
  }
  const found = [];
  async function walk(path, prefix = "") {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink artifact is not permitted: ${relative}`);
      if (entry.isDirectory() && PUBLIC_FILES.some((file) => file.startsWith(relative + "/"))) {
        await walk(join(path, entry.name), relative + "/");
      } else if (entry.isFile() && PUBLIC_FILES.includes(relative)) {
        found.push(relative);
      } else {
        throw new Error(`Unexpected artifact: ${relative}`);
      }
    }
  }
  await walk(directory);
  if (!allowMissing) {
    const missing = PUBLIC_FILES.filter((file) => !found.includes(file));
    if (missing.length) throw new Error(`Missing public artifacts: ${missing.join(", ")}`);
  }
  return found.sort();
}
