import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {VERSIONED_FILES} from './public-files.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
let html = await readFile(join(root, 'index.html'), 'utf8');
for (const file of VERSIONED_FILES) {
  const hash = createHash('sha256').update(await readFile(join(root, file))).digest('hex').slice(0,12);
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`/${escaped}\\?v=[a-f0-9]{12}`, 'g');
  const matches = html.match(pattern);
  if (matches?.length !== 1) throw new Error(`Expected exactly one versioned HTML reference for ${file}`);
  html = html.replace(pattern, `/${file}?v=${hash}`);
}
await writeFile(join(root, 'index.html'), html);
console.log(`Updated ${VERSIONED_FILES.length} asset versions.`);
