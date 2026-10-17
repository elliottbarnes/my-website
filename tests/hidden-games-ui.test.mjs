import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../assets/hidden-games.js', import.meta.url), 'utf8');
function harness({ quiet = false } = {}) {
  let now = 0, id = 0, focused;
  const frames = new Map(), nodes = new Map();
  class Element {
    constructor() { this.listeners = {}; this.children = []; this.dataset = {}; this.style = {}; this.attributes = {}; this.open = false; this.isConnected = true; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, preventDefault() {}, ...event }); }
    setAttribute(k,v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] ?? null; }
    append(el) { this.children.push(el); }
    replaceChildren(...els) { this.children = els; }
    focus() { focused = this; }
    querySelectorAll() { return []; }
    setPointerCapture() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getContext() { return new Proxy({}, {get: (_, name) => name === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {}}); }
  }
  const get = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
  const document = Object.assign(new Element(), { documentElement: new Element(), hidden: false, getElementById: get, querySelectorAll: () => [], createElement: () => new Element() });
  const window = Object.assign(new Element(), { dispatchEvent() {} });
  vm.runInNewContext(source, {document, window, performance:{now:()=>now}, matchMedia:()=>({matches:quiet,addEventListener(){}}), MutationObserver:class {observe(){}}, CustomEvent:class{}, requestAnimationFrame: fn=>{frames.set(++id,fn);return id;}, cancelAnimationFrame: n=>frames.delete(n)});
  function advance(ms) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn=>fn(now)); }
  return {get, window, document, advance, frames, focus:()=>focused};
}
test('charge scores elapsed time, overcharge resolves once, and closed games leave no frames', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki');
  assert.equal(h.frames.size, 0);
  h.get('ki-charge').fire('click',{detail:0}); h.advance(1500); h.get('ki-charge').fire('click',{detail:0});
  assert.match(h.get('arcade-status').textContent,/Perfect control/);
  assert.match(h.get('arcade-score').textContent,/1 hits/);
  h.get('ki-charge').fire('click',{detail:0}); h.advance(2500); assert.equal(h.frames.size,1); h.advance(1000);
  assert.match(h.get('arcade-status').textContent,/Overcharged/);
  assert.match(h.get('arcade-score').textContent,/3 \/ 5/);
  h.get('arcade-dialog').close(); assert.equal(h.frames.size,0);
});
test('focus loss and hidden documents cancel a charge without consuming a round', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki');
  h.get('ki-charge').fire('click',{detail:0}); h.advance(500); h.get('ki-charge').fire('blur');
  assert.match(h.get('arcade-score').textContent,/1 \/ 5/); assert.equal(h.frames.size,0);
  h.get('ki-charge').fire('click',{detail:0}); h.document.hidden = true; h.document.fire('visibilitychange');
  assert.equal(h.frames.size,0); assert.equal(h.get('ki-meter').value,0);
});
test('reduced motion still supports essential timing and settles after release', () => {
  const h = harness({quiet:true}); h.window.PortfolioArcade.open('ki');
  h.get('ki-charge').fire('click',{detail:0}); h.advance(1500); h.get('ki-charge').fire('click',{detail:0}); h.advance(16);
  assert.equal(h.frames.size,0); assert.match(h.get('arcade-status').textContent,/Perfect/);
});
test('radar is keyboard navigable, completes seven discoveries and starts no animation loop', () => {
  const h = harness(); h.window.PortfolioArcade.open('radar');
  const cells = h.get('hunt-grid').children;
  cells[0].fire('keydown',{key:'ArrowDown'}); assert.equal(h.focus(),cells[6]);
  cells.forEach(cell=>cell.fire('click'));
  assert.match(h.get('arcade-status').textContent,/All seven found/);
  assert.equal(h.get('hunt-dragon').hidden,false); assert.equal(h.frames.size,0);
  const complete = h.get('arcade-score').textContent; cells[0].fire('click'); assert.equal(h.get('arcade-score').textContent,complete);
});
test('a held pointer release scores once and the following click does not start a new charge', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  action.fire('pointerdown',{button:0,pointerId:1,isPrimary:true}); h.advance(1500); action.fire('pointerup'); action.fire('click',{detail:1});
  assert.equal(action.textContent,'charge ki'); assert.match(h.get('arcade-score').textContent,/2 \/ 5 · 1 hits/);
});
test('five rounds reach a terminal result and restart resets score and meter', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  for(let i=0;i<5;i++){action.fire('click',{detail:0});h.advance(1500);action.fire('click',{detail:0});}
  assert.equal(action.textContent,'train again'); assert.match(h.get('arcade-status').textContent,/Training complete/);
  action.fire('click',{detail:0}); assert.equal(h.get('ki-meter').value,0); assert.match(h.get('arcade-score').textContent,/1 \/ 5 · 0 hits/);assert.equal(h.frames.size,0);
});
test('the game chooser starts no game and opens either small game through its card', () => {
  const h = harness(); h.window.PortfolioArcade.open('choose');
  assert.equal(h.get('arcade-picker').hidden,false);
  assert.equal(h.get('ki-game').hidden,true); assert.equal(h.get('radar-game').hidden,true);
  assert.equal(h.get('arcade-reset').hidden,true); assert.equal(h.frames.size,0);
  assert.equal(h.focus(),h.get('game-pick-blocks'));
  h.get('game-pick-ki').fire('click'); assert.equal(h.get('ki-game').hidden,false); assert.equal(h.focus(),h.get('ki-charge'));
  h.get('ki-charge').fire('click',{detail:0}); h.advance(500);
  h.get('arcade-back').fire('click'); assert.equal(h.frames.size,0); assert.equal(h.get('arcade-picker').hidden,false);
  h.get('game-pick-radar').fire('click'); assert.equal(h.get('radar-game').hidden,false); assert.equal(h.focus(),h.get('hunt-grid').children[0]);
});
test('brick breaker handoff retains the original trigger and survives deferred close cleanup', () => {
  const h = harness(), trigger = h.get('footer-trigger'); let passed;
  h.window.PortfolioTraining = {open(opener){passed=opener; h.get('training-dialog').open=true; h.document.documentElement.dataset.training='open';}};
  h.window.PortfolioArcade.open('choose',trigger); h.get('game-pick-breaker').fire('click');
  assert.equal(passed,trigger); assert.equal(h.get('arcade-dialog').open,false);
  h.get('arcade-dialog').fire('close'); assert.equal(h.document.documentElement.dataset.training,'open');
});
test('closing the chooser restores the original footer trigger', () => {
  const h=harness(), trigger=h.get('footer-trigger');
  h.window.PortfolioArcade.open('choose',trigger); h.get('arcade-dialog').close();
  assert.equal(h.focus(),trigger); assert.equal(h.document.documentElement.dataset.training,undefined);
});
