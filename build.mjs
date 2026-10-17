import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, inspectPublicTree } from "./scripts/public-files.mjs";
import { createArtifact, manifestPath, readArtifactManifest } from "./scripts/artifact.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export async function buildSite({ root = projectRoot, destination = join(root, "dist") } = {}) {
  root = resolve(root); destination = resolve(destination);
  if (root === destination || root.startsWith(destination + "/")) throw new Error("Build destination must not contain the source root");
  const { manifest, contents } = await createArtifact(root);
  const previous = await readArtifactManifest(destination, { optional: true, previous: true });
  const previousFiles = previous ? Object.values(previous.assets).map(entry => entry.path) : PUBLIC_FILES;
  const oldFiles = await inspectPublicTree(destination, { allowMissing: true, files: previousFiles });
  await mkdir(destination, { recursive: true });
  for (const [file, bytes] of contents) {
    await mkdir(dirname(join(destination, file)), { recursive: true });
    await writeFile(join(destination, file), bytes);
  }
  // Only remove obsolete files which belonged to the validated previous artifact.
  for (const file of oldFiles) if (!contents.has(file)) await rm(join(destination, file));
  for (const oldFile of oldFiles) {
    let directory = dirname(join(destination, oldFile));
    while (directory !== destination) {
      try { await rmdir(directory); } catch (error) { if (["ENOTEMPTY", "ENOENT"].includes(error.code)) break; throw error; }
      directory = dirname(directory);
    }
  }
  await writeFile(manifestPath(destination), JSON.stringify(manifest, null, 2) + "\n");
  await inspectPublicTree(destination, { files: [...contents.keys()] });
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await buildSite();
    console.log(`Built ${PUBLIC_FILES.length} public files in dist/ with a private dist.manifest.json.`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
