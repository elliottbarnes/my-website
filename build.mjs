import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, assertRegularPublicFile, inspectPublicTree } from "./scripts/public-files.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export async function buildSite({ root = projectRoot, destination = join(root, "dist") } = {}) {
  // Validate every source and existing destination before replacing any file.
  // Never follow a source symlink into private files outside the website.
  for (const file of PUBLIC_FILES) await assertRegularPublicFile(root, file);
  await inspectPublicTree(destination, { allowMissing: true });
  await mkdir(destination, { recursive: true });
  for (const file of PUBLIC_FILES) {
    await mkdir(dirname(join(destination, file)), { recursive: true });
    await copyFile(join(root, file), join(destination, file));
  }
  await inspectPublicTree(destination);
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await buildSite();
    console.log(`Built ${PUBLIC_FILES.length} public files in dist/.`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
