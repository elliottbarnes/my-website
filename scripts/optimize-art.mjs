import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This optional authoring step uses an existing Sharp installation. Building
// and serving the site need only Node; they never install image tooling.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--sharp-module")) {
  throw new Error("Usage: node scripts/optimize-art.mjs [--sharp-module /path/to/sharp]");
}
const candidates = args.length
  ? [resolve(args[1])]
  : ["sharp", resolve(dirname(process.execPath), "../node_modules/sharp")];
let sharp;
for (const candidate of candidates) {
  try { sharp = require(candidate); break; } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
}
if (!sharp) throw new Error("Sharp is unavailable. Use an existing installation with --sharp-module; no package is installed automatically.");

const art = [
  ...Array.from({ length: 7 }, (_, index) => ({ name: `dragon-ball-${index + 1}`, size: 128 })),
  { name: "memoji-saiyan", size: 512 },
  { name: "shenron", size: 512, padding: 51 },
];
const outputs = [];
for (const { name, size, padding = 0 } of art) {
  const input = await readFile(join(root, `assets/${name}.png`));
  const metadata = await sharp(input).metadata();
  if (!metadata.hasAlpha || metadata.width !== metadata.height || metadata.width < size) {
    throw new Error(`${name}: expected a square transparent master larger than its display copy`);
  }
  const resized = () => {
    let image = sharp(input).resize({ width: size - padding * 2, kernel: "lanczos3" }).ensureAlpha();
    if (padding) image = image.extend({ top: padding, bottom: padding, left: padding, right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 } });
    return image;
  };
  const reference = await resized().raw().toBuffer({ resolveWithObject: true });
  const output = await resized().webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const decoded = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const outputMetadata = await sharp(output).metadata();
  if (!outputMetadata.hasAlpha || decoded.info.width !== size || decoded.info.height !== size
    || decoded.info.channels !== 4 || !reference.data.equals(decoded.data)) {
    throw new Error(`${name}: display copy changed the resized image's RGBA pixels`);
  }
  if (output.length >= input.length) throw new Error(`${name}: display copy must be smaller than its master`);
  let previous;
  try { previous = (await readFile(join(root, `assets/${name}.webp`))).length; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  outputs.push({ name, size, inputBytes: input.length, previousBytes: previous, outputBytes: output.length, output });
}

// Finish every dimension, alpha, and decoded-pixel check before replacing any
// production copy. PNG masters and the licensed favicon are never changed.
for (const { name, output } of outputs) await writeFile(join(root, `assets/${name}.webp`), output);
const total = key => outputs.reduce((sum, item) => sum + (item[key] || 0), 0);
console.log(JSON.stringify({
  encoder: `sharp ${sharp.versions.sharp} / webp ${sharp.versions.webp}`,
  assets: outputs.map(({ output, ...item }) => ({ ...item, alphaPreserved: true, resizedRgbaEqual: true })),
  totals: { masterBytes: total("inputBytes"), previousBytes: total("previousBytes"), displayBytes: total("outputBytes") },
}, null, 2));
