import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../assets/optional-effects.js", import.meta.url), "utf8");
const flush = () => new Promise(resolve => setImmediate(resolve));
function loader() {
  const appended = [], timers = new Map(), window = {};
  let timerId = 0;
  const document = { createElement: () => ({ remove() { this.removed = true; } }),
    head: { append: script => appended.push(script) } };
  vm.runInNewContext(source, { window, document,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id) });
  function complete(script) {
    const globals = { '/assets/entrance-effects.js': 'PortfolioEntranceEffects',
      '/assets/ecdsa-math.js': 'PortfolioECDSA', '/assets/ecdsa-effect.js': 'PortfolioECDSAEffect',
      '/assets/source-signal-effects.js': 'PortfolioSignalEffects', '/assets/source-structure-effects.js': 'PortfolioStructureEffects' };
    window[globals[script.src]] = {};
    script.onload();
  }
  return { api: window.PortfolioEffects, appended, timers, complete };
}

test("no optional request before activation; concurrent discoveries share dependencies", async () => {
  const l = loader();
  assert.equal(l.appended.length, 0);
  await l.api.load('object');
  assert.equal(l.appended.length, 0);
  const first = l.api.load('ecdsa'), second = l.api.load('ecdsa');
  assert.equal(l.appended.length, 1);
  l.complete(l.appended[0]); await flush();
  assert.equal(l.appended[1].src, '/assets/ecdsa-math.js');
  l.complete(l.appended[1]); await flush();
  assert.equal(l.appended[2].src, '/assets/ecdsa-effect.js');
  l.complete(l.appended[2]);
  await Promise.all([first, second]);
  assert.equal(l.api.ready('ecdsa'), true);
  assert.equal(l.api.ready('fourier'), false);
  await l.api.load('history');
  assert.equal(l.appended.length, 3);
  assert.equal(l.timers.size, 0);
});

test("failed and stalled loads are retryable without downloading unrelated effect families", async () => {
  for (const fail of ['network', 'timeout']) {
    const l = loader();
    const first = l.api.load('quadtree');
    const rejection = assert.rejects(first, /could not load|timed out/);
    if (fail === 'network') l.appended[0].onerror();
    else [...l.timers.values()][0]();
    await rejection;
    assert.equal(l.appended[0].removed, true);
    const retry = l.api.load('quadtree');
    l.complete(l.appended[1]); await flush();
    assert.equal(l.appended[2].src, '/assets/source-structure-effects.js');
    l.complete(l.appended[2]); await retry;
    assert.equal(l.api.ready('quadtree'), true);
    assert.equal(l.api.ready('ecdsa'), false);
  }
});
