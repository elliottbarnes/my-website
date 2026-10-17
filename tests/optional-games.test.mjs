import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../assets/optional-games.js', import.meta.url), 'utf8');
function harness() {
  let focus; const pending = [], nodes = new Map();
  class Element {
    constructor(tag = '') { this.tag = tag; this.listeners = {}; this.dataset = {}; this.children = []; this.open = false; this.isConnected = true; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    fire(name, data = {}) { this.listeners[name]?.forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, ...data })); }
    setAttribute() {} append(child) { this.children.push(child); if (child.tag === 'script' || child.tag === 'link') pending.push(child); if (child.id) nodes.set(child.id, child); }
    querySelector(selector) { if (!this[selector]) this[selector] = new Element(); return this[selector]; }
    closest() { return null; } showModal() { this.open = true; } close() { this.open = false; this.fire('close'); }
    remove() { this.removed = true; } focus() { focus = this; }
  }
  const footer = new Element(), root = new Element();
  const document = { documentElement: root, activeElement: footer, body: new Element(), head: new Element(), createElement: tag => new Element(tag), getElementById: id => nodes.get(id), querySelector: () => footer, querySelectorAll: () => [] };
  const window = new Element(); window.dispatchEvent = () => {};
  vm.runInNewContext(source, { document, window, CustomEvent: class {}, console });
  const loading = nodes.get('game-loading-dialog');
  return { window, document, root, pending, loading, footer, nodes, Element, focus: () => focus };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
test('optional games make zero initial requests and load only the selected cartridge, in dependency order', async () => {
  const h = harness(); assert.equal(h.pending.length, 0);
  const opening = h.window.PortfolioGames.open('breaker', h.footer);
  assert.equal(h.pending.length, 1); assert.equal(h.pending[0].href, '/assets/arcade.css');
  h.pending[0].onload(); await flush(); assert.equal(h.pending[1].src, '/assets/brick-breaker.js');
  h.pending[1].onload(); await flush(); assert.equal(h.pending[2].src, '/assets/training-chamber.js');
  let trigger; h.window.PortfolioTraining = { open(value) { trigger = value; } };
  h.pending[2].onload(); assert.equal(await opening, true); assert.equal(trigger, h.footer); assert.equal(h.loading.open, false);
});
test('slow cartridge switches close the current game immediately and cancellation stops the remaining dependency chain', async () => {
  const h = harness(), existing = new h.Element(); existing.open = true; h.nodes.set('platformer-dialog', existing);
  const opening = h.window.PortfolioGames.open('goku', h.footer);
  assert.equal(existing.open, false); assert.equal(h.loading.open, true);
  h.pending[0].onload(); await flush(); assert.equal(h.pending[1].src, '/assets/goku-story.js');
  h.loading.fire('cancel'); assert.equal(h.loading.open, false); assert.equal(h.focus(), h.footer);
  h.pending[1].onload(); assert.equal(await opening, false); assert.equal(h.pending.length, 2);
});
test('a failed script can be retried and does not leave a rejected load cached', async () => {
  const h = harness(); const first = h.window.PortfolioGames.open('blocks').catch(error => error);
  h.pending[0].onload(); await flush(); h.pending[1].onerror();
  assert.match((await first).message, /could not load/);
  assert.equal(h.loading.querySelector('[data-game-retry]').hidden, false);
  assert.equal(h.pending[1].removed, true);
  const second = h.window.PortfolioGames.open('blocks'); await flush();
  assert.equal(h.pending.length, 3); assert.equal(h.pending[2].src, '/assets/block-blast.js');
  h.window.PortfolioBlocks = { open() {} }; h.pending[2].onload(); assert.equal(await second, true);
});
test('newer request wins a shared in-flight load and never opens the superseded cartridge', async () => {
  const h = harness(); let firstOpened = false, secondOpened = false;
  const first = h.window.PortfolioGames.open('ki'), second = h.window.PortfolioGames.open('radar');
  assert.equal(h.pending.length, 1); h.pending[0].onload(); await flush();
  assert.equal(h.pending.length, 2); h.window.PortfolioArcade = { open(mode) { if (mode === 'ki') firstOpened = true; if (mode === 'radar') secondOpened = true; } };
  h.pending[1].onload(); assert.equal(await first, false); assert.equal(await second, true); assert.equal(firstOpened, false); assert.equal(secondOpened, true);
});
