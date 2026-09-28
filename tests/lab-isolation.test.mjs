import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLabServer, LAB_FILES } from '../side-projects/live-demo-lab/server.mjs';
import { PUBLIC_FILES } from '../scripts/public-files.mjs';

test('the live demo side project is excluded from production and starts disconnected', async () => {
  assert.ok(!PUBLIC_FILES.some(file => file.startsWith('side-projects/') || /live-prism|backend|infra/.test(file)));
  const production = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/live-prism|portfolio-demo-api|live-demo-lab/.test(production));
  const lab = await readFile(new URL('../side-projects/live-demo-lab/index.html', import.meta.url), 'utf8');
  assert.match(lab, /name="portfolio-demo-api" content=""/);
  assert.ok(!Object.keys(LAB_FILES).some(file => /backend|infra|test|README|docs/.test(file)));
});

test('local lab rejects backend paths, mutations and outbound browser API calls', async t => {
  const server = createLabServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  for (const path of ['/backend/live_demos/app.py', '/infra/live-demos.template.json', '/README.md', '/generations']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.equal((await fetch(origin + '/generations', { method: 'POST', body: '{}' })).status, 405);
});
