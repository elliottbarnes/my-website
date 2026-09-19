import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const files = [
  "index.html", "404.html", "styles.css", "script.js", "robots.txt",
  "sitemap.xml", "site.webmanifest", "assets/favicon.svg", "assets/social-card.svg",
];
const destination = join(root, "dist");
await mkdir(destination, { recursive: true });

// Refuse unexpected files so a deployment cannot accidentally publish local notes.
async function inspect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory() && files.some((file) => file.startsWith(relative + "/"))) {
      await inspect(join(directory, entry.name), relative + "/");
    } else if (!entry.isFile() || !files.includes(relative)) {
      throw new Error(`Unexpected artifact in dist: ${relative}. Inspect it before building.`);
    }
  }
}

await inspect(destination);
for (const file of files) {
  await mkdir(dirname(join(destination, file)), { recursive: true });
  await copyFile(join(root, file), join(destination, file));
}
console.log(`Built ${files.length} public files in dist/.`);
