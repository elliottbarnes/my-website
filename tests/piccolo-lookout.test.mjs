import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const engine = require('../assets/piccolo-lookout.js');
const source = await readFile(new URL('../assets/piccolo-lookout.js', import.meta.url), 'utf8');
const run = (game, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) engine.step(game, input, 1 / 120); };

test('the adventure waits for start and collision blocks walls, water, and unopened gates', () => {
  const game = engine.create(); run(game, 1, { x: 1, action: true }); assert.equal(game.player.x, 40); assert.equal(game.shots, 0);
  engine.start(game); run(game, 3, { x: -1 }); assert.ok(game.player.x >= 21);
  assert.equal(engine.canStand(game, 56, 56), false); assert.equal(engine.canStand(game, 112, 112), false);
  assert.equal(engine.canStand(game, 308, 96), false); assert.equal(engine.unlocked(game), false);
  assert.equal(engine.canStand(game, 160, 96), true);
});
test('ki lights the first crystal at range and a wall absorbs shots before they reach it', () => {
  const game = engine.create(); engine.start(game);
  Object.assign(game.player, { x: 120, y: 80, facing: 'up' }); run(game, .5, { action: true });
  assert.equal(engine.unlocked(game), true); assert.equal(engine.canStand(game, 308, 96), true);
  const blocked = engine.create(); engine.start(blocked);
  Object.assign(blocked.player, { x: 216, y: 96, facing: 'up' }); run(blocked, 1, { action: true });
  assert.equal(blocked.projectiles.length, 0); assert.equal(engine.unlocked(blocked), false);
});
test('moon must be lit before sun; both seals and the final warden are needed for the bell', () => {
  const game = engine.create(); engine.start(game); game.room = 2;
  Object.assign(game.player, { x: 264, y: 64, facing: 'up' }); run(game, .4, { action: true });
  assert.equal(game.rooms[2].crystals[1].lit, false); assert.match(game.event, /moon.*first/);
  Object.assign(game.player, { x: 56, y: 64 }); run(game, .4, { action: true }); assert.equal(game.rooms[2].crystals[0].lit, true);
  Object.assign(game.player, { x: 264, y: 64 }); run(game, .4, { action: true }); assert.equal(game.rooms[2].crystals[1].lit, true);
  Object.assign(game.player, { x: 160, y: 56 }); run(game, .4, { action: true }); assert.equal(game.phase, 'playing'); assert.equal(engine.unlocked(game), false);
});
test('guard shots are telegraphed, damage has a grace period, and death freezes the world', () => {
  const game = engine.create(); engine.start(game); game.room = 1;
  const guard = game.rooms[1].guards[0]; Object.assign(game.player, { x: guard.x, y: guard.y });
  engine.step(game); assert.equal(game.hearts, 3); const health = game.hearts;
  run(game, .4); assert.equal(game.hearts, health); assert.ok(game.player.immune > 0);
  Object.assign(game.player, { x: 200, y: 96 }); guard.timer = .3; const before = guard.y; run(game, .1); assert.equal(guard.y, before);
  run(game, .25); assert.ok(game.projectiles.some(shot => shot.enemy));
  for (let i = 0; i < 3; i++) {
    game.player.immune = 0; Object.assign(game.player, { x: guard.x, y: guard.y }); engine.step(game);
  }
  assert.equal(game.phase, 'lost'); assert.equal(game.hearts, 0); const ended = JSON.stringify(game);
  run(game, 2, { x: 1, action: true }); assert.equal(JSON.stringify(game), ended);
  const fresh = engine.create(); assert.equal(fresh.hearts, 4); assert.equal(fresh.room, 0); assert.equal(fresh.phase, 'ready'); assert.ok(fresh.rooms[1].guards.every(guard => guard.hp === 2));
});
test('diagonal movement keeps the same speed and invalid timing cannot advance the game', () => {
  const straight = engine.create(), diagonal = engine.create(); engine.start(straight); engine.start(diagonal);
  Object.assign(straight.player, { x: 160, y: 144 }); Object.assign(diagonal.player, { x: 160, y: 144 });
  run(straight, .2, { x: 1 }); run(diagonal, .2, { x: 1, y: -1 });
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - 160, diagonal.player.y - 144) - (straight.player.x - 160)) < 1e-8);
  const before = JSON.stringify(straight); [NaN, -1, 0, Infinity].forEach(dt => engine.step(straight, { x: 1 }, dt)); assert.equal(JSON.stringify(straight), before);
});

function navigator(game) {
  const input = (control, frames = 1) => { for (let i = 0; i < frames; i++) { engine.step(game, control, 1 / 120); assert.notEqual(game.phase, 'lost', 'the ordinary-input replay must survive'); } };
  function walkTo(tx, ty) {
    const key = (x, y) => `${x},${y}`;
    const sx = Math.round(game.player.x / 8) * 8, sy = Math.round(game.player.y / 8) * 8;
    const queue = [[sx, sy]], previous = new Map([[key(sx, sy), null]]); let end;
    for (let index = 0; index < queue.length; index++) {
      const [x, y] = queue[index]; if (Math.hypot(x - tx, y - ty) < 5) { end = [x, y]; break; }
      for (const [dx, dy] of [[0, -8], [8, 0], [0, 8], [-8, 0]]) {
        const nx = x + dx, ny = y + dy, id = key(nx, ny);
        if (!previous.has(id) && engine.canStand(game, nx, ny)) { previous.set(id, [x, y]); queue.push([nx, ny]); }
      }
    }
    assert.ok(end, `walkable route exists to ${tx},${ty}`); const route = [];
    while (previous.get(key(...end))) { route.push(end); end = previous.get(key(...end)); }
    for (const [x, y] of route.reverse()) {
      let frames = 0;
      while (Math.hypot(game.player.x - x, game.player.y - y) > 1 && frames++ < 100) {
        const dx = x - game.player.x, dy = y - game.player.y;
        input({ x: Math.abs(dx) > .35 ? Math.sign(dx) : 0, y: Math.abs(dy) > .35 ? Math.sign(dy) : 0 });
      }
      assert.ok(frames < 100, `did not get stuck walking to ${x},${y}`);
    }
  }
  return { input, walkTo };
}
test('a complete three-room run wins through ordinary movement and ki input without teleporting or editing state', () => {
  const game = engine.create(); engine.start(game); const { input, walkTo } = navigator(game);
  walkTo(120, 72); input({ y: -1 }); input({ action: true }, 36); assert.equal(engine.unlocked(game), true);
  walkTo(304, 96); input({ x: 1 }, 30); assert.equal(game.room, 1);
  walkTo(104, 96); input({ x: 1 }); input({ action: true }, 120 * 8);
  assert.ok(game.rooms[1].guards.every(guard => guard.hp === 0));
  walkTo(200, 96); input({ x: 1 }); input({ action: true }, 120 * 8);
  walkTo(304, 96); input({ x: 1 }, 30); assert.equal(game.room, 2);
  walkTo(56, 64); input({ y: -1 }); input({ action: true }, 36);
  walkTo(264, 64); input({ y: -1 }); input({ action: true }, 36);
  walkTo(104, 144); input({ x: 1 }); input({ action: true }, 120 * 14);
  assert.equal(engine.unlocked(game), true); walkTo(160, 56); input({ action: true });
  assert.equal(game.phase, 'won'); assert.ok(game.hearts > 0); assert.ok(game.rooms.every(room => room.cleared));
  const finished = JSON.stringify(game); input({ x: 1, action: true }, 60); assert.equal(JSON.stringify(game), finished);
});

function harness() {
  let now = 0, next = 0, focus, painting = []; const frames = new Map(), nodes = new Map(), holds = [];
  class Element {
    constructor() { this.listeners = {}; this.dataset = {}; this.attributes = {}; this.isConnected = true; this.open = false; this.textContent = ''; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    fire(type, event = {}) { const data = { target: this, button: 0, pointerId: 1, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...event }; this.listeners[type]?.forEach(fn => fn(data)); return data; }
    setAttribute(key, value) { this.attributes[key] = value; } getAttribute(key) { return this.attributes[key] ?? null; } removeAttribute(key) { delete this.attributes[key]; }
    querySelector(selector) { return get(selector.slice(1)); } querySelectorAll() { return holds; }
    focus() { focus = this; } showModal() { this.open = true; } close() { this.open = false; this.fire('close'); }
    closest() { return this.button ? this : null; } setPointerCapture() {}
    getContext() { return { fillRect(...args) { if (args[0] === 0 && args[1] === 0 && args[2] === 320 && args[3] === 224) painting = []; painting.push(args); }, fillText() {} }; }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  for (const control of ['up', 'down', 'left', 'right', 'action']) { const button = get(`hold-${control}`); button.button = true; button.dataset.piccoloHold = control; holds.push(button); }
  const root = new Element(), footer = new Element(), motion = new Element(); motion.matches = false;
  const dialog = get('piccolo-dialog');
  dialog.querySelector = selector => { const id = selector.startsWith('#') ? selector.slice(1) : selector; const node = get(id); if (selector.includes('data-piccolo') || ['#piccolo-start', '#piccolo-pause'].includes(selector)) node.button = true; return node; };
  const document = Object.assign(new Element(), { documentElement: root, hidden: false, getElementById: id => nodes.get(id) });
  const window = new Element(); window.dispatchEvent = () => {}; let back;
  window.PortfolioGames = { run(mode, trigger) { back = { mode, trigger }; } };
  vm.runInNewContext(source, { document, window, performance: { now: () => now }, matchMedia: () => motion, CustomEvent: class {}, requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  function advance(ms) { const until = now + ms; while (now < until) { now += Math.min(1000 / 60, until - now); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); } }
  return { get, dialog, document, window, root, footer, frames, advance, holds, focus: () => focus, back: () => back, shots: () => painting.filter(args => args[2] === 5 && args[3] === 5).length, shadow: () => painting.findLast(args => args[2] === 18 && args[3] === 3) };
}
test('UI starts explicitly, exposes room/hearts, and keyboard movement stops after blur until resume', () => {
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer);
  assert.equal(h.frames.size, 0); assert.equal(h.get('piccolo-room').textContent, 'ROOM 1 / 3'); assert.equal(h.get('piccolo-hearts').textContent, '4 HEARTS');
  h.get('piccolo-start').fire('click'); assert.equal(h.frames.size, 1);
  const before = h.shadow()[0]; h.dialog.fire('keydown', { key: 'ArrowRight', target: h.get('piccolo-canvas') }); h.advance(250); assert.ok(h.shadow()[0] > before);
  h.window.fire('blur'); const paused = [...h.shadow()]; assert.equal(h.frames.size, 0); assert.equal(h.get('piccolo-pause').textContent, 'resume');
  h.advance(2000); assert.deepEqual(h.shadow(), paused);
  h.get('piccolo-pause').fire('click'); h.advance(200); assert.equal(h.shadow()[0], paused[0]);
  assert.equal(h.dialog.fire('keydown', { key: ' ', target: h.get('piccolo-pause') }).prevented, undefined);
  assert.equal(h.dialog.fire('keyup', { key: ' ', target: h.get('piccolo-pause') }).prevented, undefined);
});
test('UI touch capture moves, cancellation clears input, hidden pages pause, and Escape keeps the original opener', () => {
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
  const right = h.get('hold-right'); right.fire('pointerdown'); h.advance(250); const moved = h.shadow()[0]; right.fire('pointercancel'); h.advance(250); assert.equal(h.shadow()[0], moved);
  h.document.hidden = true; h.document.fire('visibilitychange'); assert.equal(h.frames.size, 0);
  h.dialog.fire('cancel'); assert.equal(h.back().mode, 'choose'); assert.equal(h.back().trigger, h.footer);
  h.dialog.close(); assert.equal(h.frames.size, 0); assert.equal(h.focus(), h.footer); assert.equal(h.root.dataset.training, undefined);
  h.document.hidden = false; h.window.PortfolioPiccolo.open(h.footer); assert.equal(h.frames.size, 0); assert.equal(h.get('piccolo-pause').textContent, 'resume');
  h.get('piccolo-start').fire('click'); assert.equal(h.get('piccolo-hearts').textContent, '4 HEARTS'); assert.equal(h.get('piccolo-room').textContent, 'ROOM 1 / 3');
});

test('quick pointer and keyboard action taps survive between frames; cancel and pause discard pending actions', () => {
  for (const kind of ['pointer', 'keyboard']) {
    const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
    if (kind === 'pointer') { h.get('hold-action').fire('pointerdown'); h.get('hold-action').fire('pointerup'); }
    else { h.dialog.fire('keydown', { key: 'z', target: h.get('piccolo-canvas') }); h.dialog.fire('keyup', { key: 'z', target: h.get('piccolo-canvas') }); }
    h.advance(50); assert.equal(h.shots(), 1, `${kind} quicktap must fire once`);
  }
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
  h.get('hold-action').fire('pointerdown'); h.get('hold-action').fire('pointercancel'); h.advance(50); assert.equal(h.shots(), 0);
  h.get('hold-action').fire('pointerdown'); h.window.fire('blur'); h.get('piccolo-pause').fire('click'); h.advance(50); assert.equal(h.shots(), 0);
});
