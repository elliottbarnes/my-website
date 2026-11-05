import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../assets/hidden-games.js', import.meta.url), 'utf8');
function harness({ quiet = false, storage } = {}) {
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
    focus() { focused = this; this.fire('focus'); }
    querySelectorAll() { return []; }
    setPointerCapture() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getContext() { return new Proxy({}, {get: (_, name) => name === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {}}); }
  }
  const get = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
  const document = Object.assign(new Element(), { documentElement: new Element(), hidden: false, getElementById: get, querySelectorAll: () => [], createElement: () => new Element() });
  const window = Object.assign(new Element(), { dispatchEvent() {}, localStorage: storage });
  vm.runInNewContext(source, {document, window, Math: Object.assign(Object.create(Math), {random: () => .5}), performance:{now:()=>now}, matchMedia:()=>({matches:quiet,addEventListener(){}}), MutationObserver:class {observe(){}}, CustomEvent:class{}, requestAnimationFrame: fn=>{frames.set(++id,fn);return id;}, cancelAnimationFrame: n=>frames.delete(n)});
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
  action.fire('pointerdown',{button:0,pointerId:1,isPrimary:true}); h.advance(1500); action.fire('pointerup',{pointerId:1}); action.fire('click',{detail:1});
  assert.equal(action.textContent,'charge ki'); assert.match(h.get('arcade-score').textContent,/2 \/ 5 · 1 hits/);
});
test('five rounds reach a terminal result and restart resets score and meter', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  for(let i=0;i<5;i++){action.fire('click',{detail:0});h.advance(1500);action.fire('click',{detail:0});}
  assert.equal(action.textContent,'train again'); assert.match(h.get('arcade-status').textContent,/Training complete/);
  action.fire('click',{detail:0}); assert.equal(action.textContent,'charge ki'); assert.equal(h.get('ki-meter').value,0); assert.match(h.get('arcade-score').textContent,/1 \/ 5 · 0 hits/);assert.equal(h.frames.size,0);
});
test('the game chooser starts no game and opens either small game through its card', () => {
  const h = harness(); h.window.PortfolioArcade.open('choose');
  assert.equal(h.get('arcade-picker').hidden,false);
  assert.equal(h.get('ki-game').hidden,true); assert.equal(h.get('radar-game').hidden,true);
  assert.equal(h.get('arcade-reset').hidden,true); assert.equal(h.frames.size,0);
  assert.equal(h.focus(),h.get('game-pick-piccolo'));
  h.get('game-pick-ki').fire('click'); assert.equal(h.get('ki-game').hidden,false); assert.equal(h.focus(),h.get('ki-charge'));
  h.get('ki-charge').fire('click',{detail:0}); h.advance(500);
  h.get('arcade-back').fire('click'); assert.equal(h.frames.size,0); assert.equal(h.get('arcade-picker').hidden,false);
  assert.equal(h.focus(),h.get('game-pick-ki')); assert.equal(h.get('arcade-bonus').open,true);
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

test('generation picker hands Piccolo and Goku to the lazy loader with the original opener', () => {
  for (const game of ['piccolo', 'platformer']) {
    const h = harness(), trigger = h.get('footer-trigger');
    let received;
    h.window.PortfolioGames = { run(mode, opener) { received = { mode, opener }; } };
    h.window.PortfolioArcade.open('choose', trigger);
    h.get(`game-pick-${game}`).fire('click');
    assert.deepEqual(received, { mode: game, opener: trigger });
  }
});

test('a Ki result keeps the band it was judged against until the next charge', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  action.fire('click', { detail: 0 }); h.advance(1474); action.fire('click', { detail: 0 });
  assert.equal(h.get('ki-band').textContent, '56–78%');
  assert.match(h.get('arcade-status').textContent, /67% against 56–78%/);
  action.fire('click', { detail: 0 });
  assert.equal(h.get('ki-band').textContent, '42–61%');
  h.advance(500); action.fire('click', { detail: 0 });
  assert.match(h.get('arcade-status').textContent, /Below the target. Hold a little longer/);
  assert.equal(h.get('ki-band').textContent, '42–61%');
});

test('losing the charging pointer cancels without consuming a round or accepting the trailing click', () => {
  for (const type of ['pointercancel', 'lostpointercapture']) {
    const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
    action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 7 }); h.advance(500);
    action.fire(type, { pointerId: 8 }); assert.equal(action.textContent, 'release ki');
    action.fire(type, { pointerId: 7 });
    assert.equal(action.textContent, 'charge ki'); assert.equal(h.get('ki-meter').value, 0);
    action.fire('click', { detail: 1 }); h.advance(2500);
    assert.equal(action.textContent, 'charge ki'); assert.match(h.get('arcade-score').textContent, /1 \/ 5 · 0 hits/);
    action.fire('click', { detail: 0 }); h.advance(1474); action.fire('click', { detail: 0 });
    assert.match(h.get('arcade-status').textContent, /Perfect control/);
  }
});

test('short tap retains tap-twice charging after normal capture release', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 1 }); h.advance(50);
  action.fire('pointerup', { pointerId: 1 }); action.fire('lostpointercapture', { pointerId: 1 }); action.fire('click', { detail: 1 });
  assert.equal(action.textContent, 'release ki');
  h.advance(1424); action.fire('click', { detail: 0 }); assert.match(h.get('arcade-status').textContent, /Perfect control/);
});

test('unchanged radar readings do not charge an extra scan and keyboard geography stays in bounds', () => {
  const h = harness(); h.window.PortfolioArcade.open('radar'); const cells = h.get('hunt-grid').children;
  let empty;
  for (const cell of cells) { cell.fire('click'); if (cell.dataset.signal !== 'found') { empty = cell; break; } }
  const score = h.get('arcade-score').textContent; empty.fire('click');
  assert.equal(h.get('arcade-score').textContent, score); assert.match(h.get('arcade-status').textContent, /no extra scan/);
  cells[0].fire('keydown', { key: 'ArrowLeft' }); assert.equal(h.focus(), cells[0]);
  cells[5].fire('keydown', { key: 'ArrowRight' }); assert.equal(h.focus(), cells[5]);
  cells[5].fire('keydown', { key: 'ArrowDown' }); assert.equal(h.focus(), cells[11]);
  cells[11].fire('keydown', { key: 'Home' }); assert.equal(h.focus(), cells[6]);
  assert.equal(cells.filter(cell => cell.tabIndex === 0).length, 1);
});

test('starting fresh returns keyboard focus to the game control', () => {
  const h = harness();
  h.window.PortfolioArcade.open('radar'); h.get('hunt-grid').children[12].focus();
  h.get('arcade-reset').fire('click'); assert.equal(h.focus(), h.get('hunt-grid').children[0]);
  h.window.PortfolioArcade.open('ki'); h.get('arcade-reset').fire('click'); assert.equal(h.focus(), h.get('ki-charge'));
});

test('only a completed Ki run writes a best; retry and reload preserve it', () => {
  const saved = new Map(), storage = {getItem:key=>saved.get(key) ?? null, setItem:(key,value)=>saved.set(key,value)};
  const h = harness({storage}); h.window.PortfolioArcade.open('ki');
  const action = h.get('ki-charge');
  for (const elapsed of [1474,1133,1672,1232]) { action.fire('click',{detail:0}); h.advance(elapsed); action.fire('click',{detail:0}); }
  assert.equal(saved.size,0,'unfinished attempts do not become records');
  action.fire('click',{detail:0}); h.advance(1738); action.fire('click',{detail:0});
  assert.match(h.get('arcade-score').textContent,/5 hits · 5 perfect/);
  assert.match(h.get('arcade-status').textContent,/New personal best/);
  assert.match(h.get('arcade-record').textContent,/best 5\/5 hits · 5 perfect · this device/);
  action.fire('click',{detail:0}); assert.match(h.get('arcade-record').textContent,/best 5\/5/);
  const reloaded = harness({storage}); reloaded.window.PortfolioArcade.open('ki');
  assert.match(reloaded.get('arcade-record').textContent,/best 5\/5 hits · 5 perfect/);
  for(let i=0;i<5;i++){action.fire('click',{detail:0});h.advance(300);action.fire('click',{detail:0});}
  assert.match(h.get('arcade-record').textContent,/best 5\/5 hits · 5 perfect/,'a worse replay cannot replace the best');
});

test('unavailable storage keeps a session best and never blocks retry', () => {
  const storage = {getItem(){throw Error('blocked');},setItem(){throw Error('full');}};
  const h = harness({storage}); h.window.PortfolioArcade.open('ki');
  for(let i=0;i<5;i++){h.get('ki-charge').fire('click',{detail:0});h.advance(1500);h.get('ki-charge').fire('click',{detail:0});}
  assert.match(h.get('arcade-record').textContent,/this session/);
  h.get('arcade-reset').fire('click'); assert.match(h.get('arcade-score').textContent,/0 hits/);
  h.window.PortfolioArcade.open('radar'); h.get('hunt-grid').children.forEach(cell=>cell.fire('click'));
  assert.match(h.get('arcade-record').textContent,/best \d+ scans · this session/);
});

test('saving a completed run merges better records written by another tab', () => {
  const key='portfolio-arcade-records-v1', saved=new Map();
  const storage={getItem:key=>saved.get(key) ?? null,setItem:(key,value)=>saved.set(key,value)};
  const h=harness({storage}); h.window.PortfolioArcade.open('ki');
  // A second tab finishes after this dialog was opened.
  storage.setItem(key,JSON.stringify({ki:{hits:5,perfects:5},radar:{scans:12}}));
  for(let i=0;i<5;i++){h.get('ki-charge').fire('click',{detail:0});h.advance(1500);h.get('ki-charge').fire('click',{detail:0});}
  assert.deepEqual(JSON.parse(saved.get(key)),{ki:{hits:5,perfects:5},radar:{scans:12}});
  assert.doesNotMatch(h.get('arcade-status').textContent,/New personal best/);
  h.window.PortfolioArcade.open('radar'); assert.match(h.get('arcade-record').textContent,/best 12 scans/);
});

test('a discovery invalidates distance readings but preserves known empty squares', () => {
  const h = harness(); h.window.PortfolioArcade.open('radar'); const cells = h.get('hunt-grid').children;
  let empty;
  for (const cell of cells) {
    cell.fire('click');
    if(cell.dataset.signal !== 'found') { empty = cell; assert.match(cell.getAttribute('aria-label'), /\d+ steps? to the nearest ball/); }
    else if(empty) break;
  }
  assert.ok(empty); assert.equal(empty.dataset.signal,'visited'); assert.equal(empty.textContent,'○');
  assert.match(empty.getAttribute('aria-label'),/empty, scan for an updated distance/);
  empty.fire('click'); assert.match(empty.textContent,/^\d+$/,'explicit rescan supplies a new numeric clue');
});

test('blur and hidden-tab interruption consume the held pointer trailing click without restarting', () => {
  for (const interrupt of ['window-blur', 'focus-blur', 'hidden']) {
    const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
    action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 7 }); h.advance(500);
    if (interrupt === 'window-blur') h.window.fire('blur');
    else if (interrupt === 'focus-blur') action.fire('blur');
    else { h.document.hidden = true; h.document.fire('visibilitychange'); h.document.hidden = false; }
    action.fire('pointerup', { pointerId: 7 }); action.fire('click', { detail: 1 }); h.advance(2500);
    assert.equal(action.textContent, 'charge ki', interrupt);
    assert.equal(h.get('ki-meter').value, 0); assert.match(h.get('arcade-score').textContent, /1 \/ 5 · 0 hits/);
    assert.equal(h.frames.size, 0);
    action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 8 }); h.advance(1474);
    action.fire('pointerup', { pointerId: 8 }); action.fire('click', { detail: 1 });
    assert.match(h.get('arcade-status').textContent, /Perfect control/, 'a fresh hold still works');
  }
});

test('reset and game switching do not let an interrupted hold restart the new round', () => {
  for (const interruption of ['reset', 'switch']) {
    const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
    action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 7 }); h.advance(500);
    assert.equal(h.focus(), action, 'pointer charge explicitly owns keyboard focus');
    if (interruption === 'reset') h.get('arcade-reset').fire('click');
    else { h.get('arcade-back').fire('click'); h.get('game-pick-ki').fire('click'); }
    action.fire('pointerup', { pointerId: 7 }); action.fire('click', { detail: 1 }); h.advance(2500);
    assert.equal(action.textContent, 'charge ki', interruption);
    assert.match(h.get('arcade-score').textContent, /1 \/ 5 · 0 hits/); assert.equal(h.frames.size, 0);
    action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 8 }); h.advance(1474);
    action.fire('pointerup', { pointerId: 8 }); action.fire('click', { detail: 1 });
    assert.match(h.get('arcade-status').textContent, /Perfect control/);
  }
});

test('an old cancelled pointer cannot release a new keyboard-started charge', () => {
  const h = harness(); h.window.PortfolioArcade.open('ki'); const action = h.get('ki-charge');
  action.fire('pointerdown', { button: 0, isPrimary: true, pointerId: 7 }); h.advance(500);
  h.get('arcade-reset').fire('click'); action.fire('click', { detail: 0 }); h.advance(500);
  action.fire('pointerup', { pointerId: 7 }); action.fire('click', { detail: 1 });
  assert.equal(action.textContent, 'release ki'); assert.match(h.get('arcade-score').textContent, /1 \/ 5 · 0 hits/);
  h.advance(974); action.fire('click', { detail: 0 }); assert.match(h.get('arcade-status').textContent, /Perfect control/);
});
