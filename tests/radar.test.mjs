import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source = await readFile(new URL('../assets/workspace.js', import.meta.url), 'utf8');

function radar() {
  const surface = () => {
    const handlers = new Map();
    return {
      addEventListener(type, handler) { handlers.set(type, [...(handlers.get(type) || []), handler]); },
      emit(type) { for (const handler of handlers.get(type) || []) handler(); },
    };
  };
  const root = {dataset: {view: 'workspace', motion: 'running'}};
  const frames = new Map();
  let id = 0, geometry = [];
  const context = new Proxy({
    clearRect() { geometry = []; },
    arc(...args) { geometry.push(['arc', ...args]); },
    lineTo(...args) { geometry.push(['line', ...args]); },
  }, {get: (target, key) => target[key] ?? (() => {})});
  const plot = {dataset: {}, querySelectorAll: () => []};
  const canvas = {getContext: () => context, closest: () => plot,
    getBoundingClientRect: () => ({width: 400, height: 220})};
  const about = {hidden: false};
  const workspace = {...surface(), querySelector: () => null};
  const document = {...surface(), documentElement: root, hidden: false,
    getElementById: id => id === 'workspace' ? workspace : id === 'profile-plot' ? canvas : null,
    querySelector: selector => selector === '[data-panel="about"]' ? about : null};
  const motion = {...surface(), matches: false};
  const window = {...surface(), matchMedia: () => motion, devicePixelRatio: 1};
  vm.runInNewContext(source, {document, window,
    getComputedStyle: () => ({getPropertyValue: () => ''}),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id)});
  return {root, window, document, motion, frames,
    drawing: () => JSON.stringify(geometry),
    frame(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); }};
}

test('radar freezes its actual sweep and pulses, then resumes without counting paused time', () => {
  const page = radar();
  page.frame(100); page.frame(150); page.frame(200);
  const frozen = page.drawing();
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  assert.equal(page.drawing(), frozen);
  assert.equal(page.frames.size, 0);
  page.window.emit('resize');
  assert.equal(page.drawing(), frozen, 'redrawing while paused preserves the phase');
  page.root.dataset.motion = 'running'; page.window.emit('portfolio:preferences');
  page.frame(10000);
  assert.equal(page.drawing(), frozen, 'first resumed frame does not jump over paused time');
  page.frame(10050);
  assert.notEqual(page.drawing(), frozen);
  const second = page.drawing();
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  assert.equal(page.drawing(), second, 'a later pause freezes a different position');
});

test('hidden tabs and reduced motion retain the radar phase', () => {
  const page = radar();
  page.frame(100); page.frame(160);
  const frozen = page.drawing();
  page.document.hidden = true; page.document.emit('visibilitychange');
  assert.equal(page.frames.size, 0);
  page.document.hidden = false; page.document.emit('visibilitychange');
  page.frame(5000);
  assert.equal(page.drawing(), frozen);
  delete page.root.dataset.motion;
  page.motion.matches = true; page.motion.emit('change');
  assert.equal(page.drawing(), frozen);
  assert.equal(page.frames.size, 0);
});
