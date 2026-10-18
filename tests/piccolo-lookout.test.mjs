import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const engine = require('../assets/piccolo-lookout.js');
const source = await readFile(new URL('../assets/piccolo-lookout.js', import.meta.url), 'utf8');
const run = (game, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) engine.step(game, input, 1 / 120); };
const tap = game => { run(game, .02, { action: true }); run(game, .4); };
const beam = game => { run(game, .8, { action: true }); engine.step(game); };

test('the adventure waits for start and collision blocks walls, water, and unopened gates', () => {
  const game = engine.create(); run(game, 1, { x: 1, action: true }); assert.equal(game.player.x, 40); assert.equal(game.shots, 0);
  engine.start(game); run(game, 3, { x: -1 }); assert.ok(game.player.x >= 21);
  assert.equal(engine.canStand(game, 56, 56), false); assert.equal(engine.canStand(game, 112, 112), false);
  assert.equal(engine.canStand(game, 308, 96), false); assert.equal(engine.unlocked(game), false);
  assert.equal(engine.canStand(game, 160, 96), true);
});
test('the opening rings teach a charged beam from the initial position and walls stop it', () => {
  const game = engine.create(); engine.start(game); tap(game);
  assert.equal(engine.unlocked(game), false, 'quick ki cannot activate paired rings');
  beam(game); assert.equal(engine.unlocked(game), true); assert.equal(game.beamsFired, 1); assert.equal(game.alignment, 80);
  assert.equal(engine.canStand(game, 308, 96), true);
  const blocked = engine.create(); engine.start(blocked);
  Object.assign(blocked.player, { x: 216, y: 96, facing: 'up' }); beam(blocked);
  assert.ok(blocked.beam.length < 8); assert.equal(engine.unlocked(blocked), false);
});
test('the garden requires moon before sun and its warden before opening the gate', () => {
  const game = engine.create(); engine.start(game); game.room = 2;
  Object.assign(game.player, { x: 264, y: 64, facing: 'up' }); tap(game);
  assert.equal(game.rooms[2].crystals[1].lit, false); assert.match(game.event, /moon.*first/);
  Object.assign(game.player, { x: 56, y: 64 }); tap(game); assert.equal(game.rooms[2].crystals[0].lit, true);
  Object.assign(game.player, { x: 264, y: 64 }); tap(game); assert.equal(game.rooms[2].crystals[1].lit, true);
  Object.assign(game.player, { x: 160, y: 56 }); tap(game); assert.equal(game.phase, 'playing'); assert.equal(engine.unlocked(game), false);
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

test('the tide seal raises only the central bridge and the far seal still locks the exit', () => {
  const game = engine.create(); engine.start(game); game.room = 3;
  assert.equal(engine.canStand(game, 160, 96), false);
  Object.assign(game.player, { x: 72, y: 96, facing: 'up' }); beam(game);
  assert.equal(engine.tileAt(game, 9, 5), '='); assert.equal(engine.canStand(game, 160, 96), true);
  assert.equal(engine.canStand(game, 160, 64), false); assert.equal(engine.canStand(game, 160, 144), false);
  assert.equal(engine.unlocked(game), false);
  Object.assign(game.player, { x: 248, y: 128, facing: 'down' }); run(game, .3); tap(game);
  assert.equal(engine.unlocked(game), true);
});
test('the keeper needs linked rings and a beam during its post-fan opening', () => {
  const game = engine.create(); engine.start(game); game.room = 5;
  const keeper = game.rooms[5].guards[0]; keeper.timer = 100;
  Object.assign(game.player, { x: 160, y: 160, facing: 'up' }); beam(game); assert.equal(keeper.hp, 8);
  Object.assign(game.player, { x: 32, y: 48, facing: 'right' }); beam(game);
  assert.ok(game.rooms[5].crystals.every(crystal => crystal.lit));
  Object.assign(game.player, { x: 160, y: 56, cooldown: 0 }); tap(game); assert.equal(game.phase, 'playing');
  Object.assign(game.player, { x: keeper.x, y: 160, facing: 'up' }); beam(game); assert.equal(keeper.hp, 8, 'closed guard rejects beam');
  Object.assign(keeper, { timer: 2.4, exposed: 1.35 }); beam(game); assert.equal(keeper.hp, 5);
  run(game, .3); assert.equal(keeper.hp, 5, 'visible beam cannot damage twice');
});
test('continue restores the current checkpoint with fresh inputs and keeps completed rooms', () => {
  const game = engine.create(); engine.start(game);
  game.rooms[0].crystals.forEach(crystal => { crystal.lit = true; }); game.rooms[0].cleared = true;
  Object.assign(game.player, { x: 307, y: 96 }); run(game, .04, { x: 1 });
  assert.equal(game.room, 1); assert.equal(game.checkpoint, 1);
  const earlier = JSON.stringify(game.rooms[0]);
  game.rooms[1].guards[0].hp = 0; game.hearts = 1; game.player.immune = 0;
  Object.assign(game.player, { x: game.rooms[1].guards[1].x, y: game.rooms[1].guards[1].y });
  engine.step(game, { y: -1, action: true }); assert.equal(game.phase, 'lost');
  engine.retry(game);
  assert.equal(game.phase, 'playing'); assert.equal(game.room, 1); assert.equal(game.hearts, 4); assert.equal(game.attempts, 2);
  assert.equal(JSON.stringify(game.rooms[0]), earlier);
  assert.ok(game.rooms[1].guards.every(guard => guard.hp === 2));
  assert.equal(game.player.actionHeld, false); assert.equal(game.player.actionBuffer, 0); assert.equal(game.player.cooldown, 0);
  assert.deepEqual(game.projectiles, []); assert.deepEqual(game.sparks, []);
  const { x, y } = game.player; run(game, .2); assert.equal(game.player.x, x); assert.equal(game.player.y, y);
  assert.equal(game.checkpoint, 1);
});
test('ki deflects one incoming bolt, lit seals do not absorb shots, and lethal damage freezes later contacts', () => {
  const game = engine.create(); engine.start(game);
  const bolt = { x: 160, y: 96, vx: 0, vy: 0, life: 1 };
  game.projectiles = [{ ...bolt, enemy: false }, { ...bolt, enemy: true }, { ...bolt, enemy: true }];
  engine.step(game); assert.equal(game.deflections, 1); assert.equal(game.projectiles.length, 1); assert.equal(game.projectiles[0].enemy, true);
  game.rooms[0].crystals[0].lit = true; game.projectiles = [{ ...bolt, x: 40, y: 96, enemy: false }];
  engine.step(game); assert.equal(game.projectiles.length, 1);
  const lethal = engine.create(); engine.start(lethal); lethal.room = 1; lethal.hearts = 1;
  const guard = lethal.rooms[1].guards[0]; guard.hp = 1;
  lethal.projectiles = [{ ...bolt, x: lethal.player.x, y: lethal.player.y, enemy: true }, { ...bolt, x: guard.x, y: guard.y, enemy: false }];
  engine.step(lethal); assert.equal(lethal.phase, 'lost'); assert.equal(guard.hp, 1); assert.match(lethal.event, /Continue from room/);
});
test('a quick action near the end of cooldown is buffered once rather than dropped', () => {
  const game = engine.create(); engine.start(game); game.player.cooldown = .09;
  engine.step(game, { action: true }); run(game, .12);
  assert.equal(game.shots, 1); run(game, .6); assert.equal(game.shots, 1);
});

test('a beam needs a full 0.8 second hold and fires once on release; charging locks aim and slows movement', () => {
  const short = engine.create(); engine.start(short); run(short, 95 / 120, { action: true }); engine.step(short);
  assert.equal(short.beamsFired, 0); assert.equal(short.shots, 1); assert.equal(engine.unlocked(short), false);
  const full = engine.create(); engine.start(full); run(full, .8, { action: true });
  assert.equal(full.player.charge, engine.CHARGE_TIME); assert.equal(full.beamsFired, 0); assert.equal(full.shots, 0);
  run(full, 1, { action: true }); engine.step(full); assert.equal(full.beamsFired, 1); run(full, 1); assert.equal(full.beamsFired, 1);
  const moving = engine.create(); engine.start(moving); Object.assign(moving.player, { x: 160, y: 144, facing: 'up' });
  run(moving, .5, { x: 1, action: true }); assert.equal(moving.player.facing, 'up'); assert.equal(moving.player.chargeFacing, 'up');
  assert.ok(Math.abs(moving.player.x - 173.5) < 1e-8); assert.equal(moving.player.y, 144);
  engine.cancelAction(moving); engine.step(moving); assert.equal(moving.beamsFired, 0); assert.equal(moving.shots, 0);
});
test('paired rings require the same beam and every successful target counts at most once for alignment', () => {
  const partial = engine.create(); engine.start(partial); partial.player.y = 80; beam(partial);
  assert.ok(partial.rooms[0].crystals.every(crystal => !crystal.lit)); assert.equal(partial.alignment, 0);
  const game = engine.create(); engine.start(game); game.room = 1;
  Object.assign(game.player, { x: 104, y: 96, facing: 'right' });
  game.rooms[1].guards.forEach(guard => Object.assign(guard, { y: 96, low: 96, high: 96, timer: 100, hp: 5 }));
  beam(game); assert.deepEqual(game.rooms[1].guards.map(guard => guard.hp), [2, 2]); assert.equal(game.alignment, 80); assert.equal(game.maxChain, 2);
  run(game, .4); assert.deepEqual(game.rooms[1].guards.map(guard => guard.hp), [2, 2], 'the visible beam cannot tick damage repeatedly');
  beam(game); assert.deepEqual(game.rooms[1].guards.map(guard => guard.hp), [0, 0]); assert.equal(game.alignment, 80, 'the same two targets cannot farm alignment');
  game.phase = 'lost'; game.checkpoint = 1; engine.retry(game);
  Object.assign(game.player, { x: 104, y: 96, facing: 'right' }); game.rooms[1].guards.forEach(guard => Object.assign(guard, { y: 96, low: 96, high: 96, timer: 100 }));
  beam(game); assert.equal(game.alignment, 80, 'checkpoint resets cannot farm the same targets either'); assert.equal(game.attempts, 2);
});
test('a beam stops at a wall before a guard and does not wrap to targets behind the player', () => {
  const game = engine.create(); engine.start(game); game.room = 1;
  Object.assign(game.player, { x: 216, y: 96, facing: 'up' });
  Object.assign(game.rooms[1].guards[0], { x: 216, y: 40, axis: 'x', low: 216, high: 216, timer: 100, hp: 5 });
  Object.assign(game.rooms[1].guards[1], { x: 216, y: 160, axis: 'x', low: 216, high: 216, timer: 100, hp: 5 });
  beam(game); assert.equal(game.beam.length, 16); assert.deepEqual(game.rooms[1].guards.map(guard => guard.hp), [5, 5]);
});
test('completed records include score breakdown, retries, and time; score wins before time', () => {
  const game = engine.create(); assert.equal(engine.completedRecord(game), null);
  game.phase = 'won'; game.rooms.forEach(room => { room.cleared = true; }); game.alignment = 240; game.hits = 2; game.attempts = 2; game.time = 83.125;
  assert.deepEqual(engine.scoreBreakdown(game), { rooms: 600, alignment: 240, health: 300, retries: 100, score: 1040 });
  const result = engine.completedRecord(game); assert.deepEqual(result, { version: 1, score: 1040, ms: 83125, attempts: 2, hits: 2, maxChain: 0 });
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(engine.saveRecord(storage, result).improved, true); assert.ok(values.get(engine.RECORD_KEY).length < 512);
  assert.equal(engine.saveRecord(storage, { ...result, score: 1039, ms: 1 }).improved, false);
  assert.equal(engine.saveRecord(storage, { ...result, ms: 83000 }).improved, true);
  assert.equal(engine.saveRecord(storage, { ...result, ms: 83000 }).improved, false);
  assert.equal(engine.saveRecord(storage, { ...result, score: 1041, ms: 90000 }).improved, true);
  assert.equal(engine.readRecord(storage).score, 1041);
});
test('personal records reject malformed or unbounded values and unavailable storage is harmless', () => {
  const valid = { version: 1, score: 1000, ms: 60000, attempts: 1, hits: 0, maxChain: 2 };
  for (const value of [null, [], {}, { ...valid, version: 2 }, { ...valid, score: -1 }, { ...valid, score: 2201 }, { ...valid, ms: Infinity }, { ...valid, ms: 0 }, { ...valid, attempts: 1000 }, { ...valid, hits: .5 }, { ...valid, maxChain: 16 }]) assert.ok(!engine.validRecord(value));
  for (const raw of ['{', 'x'.repeat(513), JSON.stringify({ ...valid, version: 0 }), JSON.stringify(null)]) assert.equal(engine.readRecord({ getItem: () => raw }), null);
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.equal(engine.readRecord(unavailable), null);
  const attempt = engine.saveRecord(unavailable, valid); assert.equal(attempt.saved, false); assert.equal(attempt.best.score, 1000);
  assert.equal(engine.saveRecord(unavailable, { ...valid, score: 500 }, attempt.best).improved, false, 'a worse result cannot replace the in-memory best');
  let stored; engine.saveRecord({ getItem: () => null, setItem: (_, value) => { stored = value; } }, { ...valid, extra: 'x'.repeat(5000) });
  assert.ok(stored.length < 512); assert.equal(JSON.parse(stored).extra, undefined);
});
test('recovering writes saves the better session record even after a lower completed score', () => {
  const initial = { version: 1, score: 1000, ms: 60000, attempts: 1, hits: 0, maxChain: 2 };
  let stored = JSON.stringify(initial), blocked = true, writes = 0;
  const storage = { getItem: () => stored, setItem(_, value) { if (blocked) throw new Error('quota'); stored = value; writes++; } };
  const session = engine.saveRecord(storage, { ...initial, score: 1400, ms: 80000 });
  assert.equal(session.improved, true); assert.equal(session.saved, false); assert.equal(engine.readRecord(storage).score, 1000);
  blocked = false;
  const recovered = engine.saveRecord(storage, { ...initial, score: 1200 }, session.best);
  assert.equal(recovered.improved, false, 'the lower run is not a new personal best'); assert.equal(recovered.saved, true);
  assert.equal(engine.readRecord(storage).score, 1400); assert.equal(engine.readRecord(storage).ms, 80000); assert.equal(writes, 1);
  engine.saveRecord(storage, { ...initial, score: 1200 }, recovered.best); assert.equal(writes, 1, 'an unchanged best does not need another write');
});

function navigator(game) {
  const input = (control, frames = 1) => { for (let i = 0; i < frames; i++) { engine.step(game, control, 1 / 120); assert.notEqual(game.phase, 'lost', `ordinary-input replay must survive room ${game.room + 1} at ${Math.round(game.player.x)},${Math.round(game.player.y)}; guards ${game.rooms[game.room].guards.map(guard => guard.hp)}`); } };
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
test('a complete six-room beam run wins through ordinary movement and action input without editing state', () => {
  const game = engine.create(); engine.start(game); const { input, walkTo } = navigator(game);
  const charge = () => { input({ action: true }, 96); input({}); };
  const quick = () => { input({ action: true }, 2); input({}, 48); };
  const next = room => { walkTo(304, 96); input({ x: 1 }, 30); assert.equal(game.room, room); };
  charge(); assert.equal(engine.unlocked(game), true); assert.equal(game.alignment, 80); next(1);
  walkTo(152, 168); input({ y: -1 }); charge();
  walkTo(248, 168); input({ y: -1 }); charge(); assert.equal(engine.unlocked(game), true); next(2);
  walkTo(32, 48); input({ x: 1 }); charge();
  walkTo(104, 144); input({ x: 1 }); charge(); assert.equal(engine.unlocked(game), true); next(3);
  walkTo(72, 96); input({ y: -1 }); charge(); assert.equal(engine.tileAt(game, 9, 5), '=');
  walkTo(248, 128); input({ y: 1 }); quick(); assert.equal(engine.unlocked(game), true); next(4);
  walkTo(152, 88); input({ y: -1 }); charge();
  walkTo(248, 168); input({ y: -1 }); charge(); assert.equal(engine.unlocked(game), true); next(5);
  walkTo(32, 48); input({ x: 1 }); charge();
  walkTo(160, 168); input({ y: -1 });
  for (let frame = 0; game.rooms[5].guards[0].hp > 0 && frame < 120 * 30; frame++) {
    const keeper = game.rooms[5].guards[0], offset = keeper.x - game.player.x;
    if (game.player.charge + 1e-9 >= engine.CHARGE_TIME && keeper.exposed > .1 && Math.abs(offset) < 8) input({});
    else input({ action: true, x: Math.abs(offset) > 4 ? Math.sign(offset) : 0 });
  }
  assert.equal(engine.unlocked(game), true); walkTo(160, 56); quick();
  assert.equal(game.phase, 'won'); assert.ok(game.hearts > 0); assert.ok(game.rooms.every(room => room.cleared));
  assert.ok(game.beamsFired >= 10); assert.ok(game.alignment >= 160); assert.equal(engine.completedRecord(game).attempts, 1);
  const finished = JSON.stringify(game); input({ x: 1, action: true }, 60); assert.equal(JSON.stringify(game), finished);
});

function harness(options = {}) {
  let now = 0, next = 0, focus, painting = []; const frames = new Map(), nodes = new Map(), holds = [];
  class Element {
    constructor() { this.listeners = {}; this.dataset = {}; this.attributes = {}; this.isConnected = true; this.open = false; this.textContent = ''; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    fire(type, event = {}) { const data = { target: this, button: 0, pointerId: 1, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...event }; this.listeners[type]?.forEach(fn => fn(data)); return data; }
    setAttribute(key, value) { this.attributes[key] = value; } getAttribute(key) { return this.attributes[key] ?? null; } removeAttribute(key) { delete this.attributes[key]; }
    querySelector(selector) { return get(selector.slice(1)); } querySelectorAll(selector) { return selector === '[data-piccolo-hold]' ? holds : []; }
    focus() { focus = this; } showModal() { this.open = true; } close() { this.open = false; this.fire('close'); }
    closest() { return this.button ? this : null; }
    contains(node) { return this === dialog && [...nodes.values()].includes(node); }
    setPointerCapture(id) { (this.captures ||= new Set()).add(id); }
    hasPointerCapture(id) { return this.captures?.has(id) ?? false; }
    releasePointerCapture(id) { this.captures?.delete(id); this.fire('lostpointercapture', { pointerId: id }); }
    getContext() { return { fillRect(...args) { if (args[0] === 0 && args[1] === 0 && args[2] === 320 && args[3] === 224) painting = []; painting.push(args); }, fillText() {} }; }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  for (const control of ['up', 'down', 'left', 'right', 'action']) { const button = get(`hold-${control}`); button.button = true; button.dataset.piccoloHold = control; holds.push(button); }
  const root = new Element(), footer = new Element(), motion = new Element(); motion.matches = false;
  const dialog = get('piccolo-dialog');
  dialog.querySelector = selector => { const id = selector.startsWith('#') ? selector.slice(1) : selector; const node = get(id); if (selector.includes('data-piccolo') || ['#piccolo-start', '#piccolo-pause'].includes(selector)) node.button = true; return node; };
  const document = Object.assign(new Element(), { documentElement: root, hidden: false, getElementById: id => nodes.get(id) });
  const window = new Element(); window.dispatchEvent = () => {}; let back;
  Object.defineProperty(window, 'localStorage', { get() { if (options.blockStorage) throw new Error('blocked'); return options.storage; } });
  window.PortfolioGames = { run(mode, trigger) { back = { mode, trigger }; } };
  vm.runInNewContext(source, { document, window, performance: { now: () => now }, matchMedia: () => motion, CustomEvent: class {}, requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  function advance(ms) { const until = now + ms; while (now < until) { now += Math.min(1000 / 60, until - now); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); } }
  return { get, dialog, document, window, root, footer, frames, advance, holds, motion, focus: () => focus, back: () => back, shots: () => painting.filter(args => args[2] === 5 && args[3] === 5).length, beam: () => painting.some(args => args[2] === 9 && args[3] > 50 || args[3] === 9 && args[2] > 50), shadow: () => painting.findLast(args => args[2] === 18 && args[3] === 3) };
}
test('UI starts explicitly, exposes room/hearts, and keyboard movement stops after blur until resume', () => {
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer);
  assert.equal(h.frames.size, 0); assert.equal(h.get('piccolo-room').textContent, 'ROOM 1 / 6'); assert.equal(h.get('piccolo-hearts').textContent, '4 HEARTS');
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
  h.get('piccolo-start').fire('click'); assert.equal(h.get('piccolo-hearts').textContent, '4 HEARTS'); assert.equal(h.get('piccolo-room').textContent, 'ROOM 1 / 6');
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


test('upward movement stops when release is delivered to the window instead of the pressed control', () => {
  for (const type of ['pointer', 'keyboard']) {
    const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
    if (type === 'pointer') h.get('hold-up').fire('pointerdown', { pointerId: 7 });
    else h.dialog.fire('keydown', { key: 'ArrowUp', target: h.get('piccolo-canvas') });
    h.advance(160); const y = h.shadow()[1];
    if (type === 'pointer') h.window.fire('pointerup', { pointerId: 7 });
    else h.window.fire('keyup', { key: 'ArrowUp', target: h.footer });
    h.advance(200); assert.equal(h.shadow()[1], y, `${type} release must stop upward movement`);
  }
});
test('restart discards held upward input and does not let stale key repeats reactivate it', () => {
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
  h.dialog.fire('keydown', { key: 'ArrowUp', target: h.get('piccolo-canvas') }); h.advance(160);
  h.get('hold-up').fire('pointerdown', { pointerId: 3 }); h.get('hold-up').fire('click', { detail: 0 });
  h.get('piccolo-start').fire('click'); const y = h.shadow()[1];
  assert.equal(h.get('hold-up').captures.size, 0, 'restart releases captured pointers');
  h.dialog.fire('keydown', { key: 'ArrowUp', repeat: true, target: h.get('piccolo-canvas') }); h.advance(200);
  assert.equal(h.shadow()[1], y, 'restart must remain idle despite old held keys/pointers/pulses');
  h.window.fire('keyup', { key: 'ArrowUp' });
  h.dialog.fire('keydown', { key: 'ArrowUp', target: h.get('piccolo-canvas') }); h.advance(100);
  assert.ok(h.shadow()[1] < y, 'a fresh press can move again');
});

test('upward holds stop on capture loss, missing mouse release, focus loss, pause, visibility, and close', () => {
  for (const release of ['capture', 'mouse', 'focus', 'pause', 'hidden', 'close']) {
    const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
    const up = h.get('hold-up'); up.fire('pointerdown', { pointerId: 3 }); h.advance(150);
    if (release === 'capture') up.fire('lostpointercapture', { pointerId: 3 });
    if (release === 'mouse') h.window.fire('pointermove', { pointerId: 3, pointerType: 'mouse', buttons: 0 });
    if (release === 'focus') h.dialog.fire('focusout', { relatedTarget: h.footer });
    if (release === 'pause') { h.get('piccolo-pause').fire('click'); h.get('piccolo-pause').fire('click'); }
    if (release === 'hidden') { h.document.hidden = true; h.document.fire('visibilitychange'); h.document.hidden = false; h.get('piccolo-pause').fire('click'); }
    if (release === 'close') { h.dialog.close(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-pause').fire('click'); }
    const y = h.shadow()[1]; h.advance(200); assert.equal(h.shadow()[1], y, release);
    assert.equal(up.getAttribute('data-held'), null);
  }
});
test('physical aliases release independently and native button keyup cannot leave Space held', () => {
  const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click');
  for (const key of ['ArrowUp', 'w']) h.dialog.fire('keydown', { key, target: h.get('piccolo-canvas') });
  h.advance(100); h.window.fire('keyup', { key: 'ArrowUp' }); const y = h.shadow()[1]; h.advance(100); assert.ok(h.shadow()[1] < y);
  h.window.fire('keyup', { key: 'w' }); const released = h.shadow()[1]; h.advance(100); assert.equal(h.shadow()[1], released);
  h.get('piccolo-start').fire('click');
  h.dialog.fire('keydown', { key: ' ', target: h.get('piccolo-canvas') }); h.advance(50); assert.equal(h.shots(), 0);
  const event = h.dialog.fire('keyup', { key: ' ', target: h.get('piccolo-pause') }); assert.equal(event.prevented, undefined);
  h.advance(50); assert.equal(h.shots(), 1, 'release fires exactly one quick bolt'); h.advance(450); assert.equal(h.shots(), 0, 'no continuing fire remains after release');
});

test('pointer, keyboard, focused A, and hold-free native activation all charge and release the opening beam', () => {
  for (const mode of ['pointer', 'keyboard', 'button-space', 'button-enter', 'assistive']) {
    const h = harness({ blockStorage: true }); h.window.PortfolioPiccolo.open(h.footer);
    assert.equal(h.get('piccolo-score').textContent, 'SCORE 0'); assert.equal(h.frames.size, 0);
    h.get('piccolo-start').fire('click'); const button = h.get('hold-action');
    const target = mode === 'button-space' ? button : h.get('piccolo-canvas');
    if (mode === 'pointer') button.fire('pointerdown');
    else if (mode === 'assistive') button.fire('click', { detail: 0 });
    else if (mode === 'button-enter') { h.dialog.fire('keydown', { key: 'Enter', target: button }); h.dialog.fire('keydown', { key: 'Enter', target: button, repeat: true }); }
    else h.dialog.fire('keydown', { key: ' ', target });
    h.advance(900); assert.equal(h.get('piccolo-charge').textContent, 'READY · RELEASE'); assert.equal(h.beam(), false);
    if (mode === 'pointer') button.fire('pointerup');
    else if (mode === 'assistive') button.fire('click', { detail: 0 });
    else if (mode === 'button-enter') h.dialog.fire('keydown', { key: 'Enter', target: button });
    else h.dialog.fire('keyup', { key: ' ', target });
    h.advance(30); assert.equal(h.beam(), true, mode); assert.equal(h.get('piccolo-objective').textContent, 'Eastern gate →'); assert.equal(h.get('piccolo-score').textContent, 'SCORE 180');
    h.advance(500); assert.equal(h.beam(), false); assert.equal(h.frames.size, 1);
  }
});
test('every interruption cancels a full charge without firing, and a fresh press still works', () => {
  for (const cancel of ['pointercancel', 'capture', 'blur', 'hidden', 'focus', 'pause', 'close', 'restart']) {
    const h = harness(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-start').fire('click'); const button = h.get('hold-action');
    button.fire('pointerdown', { pointerId: 4 }); h.advance(900); assert.equal(h.get('piccolo-charge').textContent, 'READY · RELEASE');
    if (cancel === 'pointercancel') h.window.fire('pointercancel', { pointerId: 4 });
    if (cancel === 'capture') button.fire('lostpointercapture', { pointerId: 4 });
    if (cancel === 'blur') { h.window.fire('blur'); h.get('piccolo-pause').fire('click'); }
    if (cancel === 'hidden') { h.document.hidden = true; h.document.fire('visibilitychange'); h.document.hidden = false; h.get('piccolo-pause').fire('click'); }
    if (cancel === 'focus') h.dialog.fire('focusout', { relatedTarget: h.get('piccolo-pause') });
    if (cancel === 'pause') { h.get('piccolo-pause').fire('click'); h.get('piccolo-pause').fire('click'); }
    if (cancel === 'close') { h.dialog.close(); h.window.PortfolioPiccolo.open(h.footer); h.get('piccolo-pause').fire('click'); }
    if (cancel === 'restart') h.get('piccolo-start').fire('click');
    button.fire('pointerup', { pointerId: 4 }); h.advance(40);
    assert.equal(h.beam(), false, cancel); assert.equal(h.shots(), 0); assert.equal(h.get('piccolo-score').textContent, 'SCORE 0');
    button.fire('pointerdown', { pointerId: 5 }); h.advance(900); button.fire('pointerup', { pointerId: 5 }); h.advance(30);
    assert.equal(h.get('piccolo-objective').textContent, 'Eastern gate →', `${cancel} permits a fresh charge`);
  }
});
test('reduced motion retains a readable beam and a loaded best remains local without starting the game', () => {
  const best = { version: 1, score: 1080, ms: 73500, attempts: 1, hits: 0, maxChain: 2 }; let writes = 0;
  const h = harness({ storage: { getItem: key => key === engine.RECORD_KEY ? JSON.stringify(best) : null, setItem() { writes++; } } });
  h.motion.matches = true; h.window.PortfolioPiccolo.open(h.footer); assert.equal(h.frames.size, 0);
  assert.match(h.get('piccolo-record').textContent, /1080.*1:13.*1 attempt/); assert.equal(writes, 0);
  h.get('piccolo-start').fire('click'); h.get('hold-action').fire('pointerdown'); h.advance(900); h.get('hold-action').fire('pointerup'); h.advance(30);
  assert.equal(h.beam(), true); assert.equal(h.get('piccolo-score').textContent, 'SCORE 180'); assert.equal(writes, 0, 'an unfinished room cannot write a record');
  h.dialog.close(); assert.equal(h.frames.size, 0);
});
