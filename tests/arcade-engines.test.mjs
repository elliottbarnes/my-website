import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const platform = require('../assets/goku-platformer.js');

const simulate = (game, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) platform.step(game, input, 1 / 120); };
test('platformer is idle until started, accelerates and lands without sinking through the floor', () => {
  const game = platform.create(); simulate(game, 1, { direction: 1, jump: true }); assert.equal(game.player.x, 80);
  platform.start(game); simulate(game, .5, { direction: 1 });
  assert.ok(game.player.x > 160); assert.equal(game.player.y + game.player.h, platform.GROUND);
  assert.equal(game.player.grounded, true);
});
test('holding jump reaches a higher apex than releasing it, and a jump cannot repeat in mid-air', () => {
  const high = platform.create(), low = platform.create(); platform.start(high); platform.start(low);
  simulate(high, .25, { jump: true }); simulate(low, .05, { jump: true }); simulate(low, .2, { jump: false });
  assert.ok(high.player.y < low.player.y - 20);
  const airborne = high.player.vy; platform.step(high, { jump: false }); platform.step(high, { jump: true });
  assert.ok(high.player.vy > -550); assert.ok(high.player.vy > airborne);
  simulate(high, 1, { jump: true }); assert.equal(high.player.grounded, true);
});
test('coyote time accepts a late edge jump but expires before it becomes an air jump', () => {
  const late = platform.create(), expired = platform.create();
  for (const game of [late, expired]) {
    platform.start(game); Object.assign(game.player, { x: 678, vx: 220 });
    simulate(game, .025, { direction: 1 });
    assert.equal(game.player.grounded, false);
  }
  simulate(late, .04, { direction: 1 }); platform.step(late, { direction: 1, jump: true });
  assert.ok(late.player.vy < -500);
  simulate(expired, .14, { direction: 1 }); platform.step(expired, { direction: 1, jump: true });
  assert.ok(expired.player.vy > 0);
});
test('jump buffering catches a press just before landing and does not keep an old press indefinitely', () => {
  const buffered = platform.create(), expired = platform.create();
  for (const game of [buffered, expired]) { platform.start(game); Object.assign(game.player, { y: game === buffered ? 257 : 190, vy: 150, grounded: false, coyote: 0 }); }
  simulate(buffered, .12, { jump: true });
  assert.ok(buffered.player.vy < -400); assert.equal(buffered.player.grounded, false);
  simulate(expired, .5, { jump: true });
  assert.equal(expired.player.grounded, true); assert.equal(expired.player.vy, 0);
});
test('ki removes a patrol bot once, has a bounded fire rate, and shots expire', () => {
  const game = platform.create(); platform.start(game); game.player.x = 390; game.enemies[0].vx = 0;
  simulate(game, .3, { attack: true });
  assert.equal(game.enemies[0].alive, false); assert.equal(game.score, 100);
  simulate(game, .9, { attack: true });
  assert.equal(game.score, 100); assert.ok(game.shots.length <= 3);
  simulate(game, 1); assert.equal(game.shots.length, 0); assert.equal(game.bursts.length, 0);
});
test('respawn gives damage grace before a continuing collision can spend a second life', () => {
  const game = platform.create(); platform.start(game);
  const enemy = game.enemies[0]; enemy.vx = 0; game.player.x = enemy.x;
  platform.step(game); assert.equal(game.lives, 2);
  enemy.x = game.player.x; enemy.left = enemy.x; enemy.right = enemy.x;
  simulate(game, .5); assert.equal(game.lives, 2);
  simulate(game, 1.1); assert.equal(game.lives, 1);
});
test('platforms support one-way travel over gaps and stop the player at solid sides', () => {
  const game = platform.create(); platform.start(game);
  Object.assign(game.player, { x: 280, y: 190, vy: 80, grounded: false });
  simulate(game, .3); assert.equal(game.player.y + game.player.h, 246); assert.equal(game.player.grounded, true);
  Object.assign(game.player, { x: 235, y: 245, vx: 220, vy: 0, grounded: false });
  simulate(game, .04, { direction: 1 }); assert.ok(game.player.x + game.player.w <= 260);
});
test('a top-down bot collision bounces; side collision loses one life and retains collected balls', () => {
  const game = platform.create(); platform.start(game);
  game.orbs[0].collected = true;
  const enemy = game.enemies[0]; enemy.vx = 0;
  Object.assign(game.player, { x: enemy.x, y: enemy.y - 32, vy: 140, grounded: false });
  platform.step(game, {}, 1 / 120); assert.equal(enemy.alive, false); assert.ok(game.player.vy < 0); assert.equal(game.score, 100);
  const second = game.enemies[1]; second.vx = 0;
  Object.assign(game.player, { x: second.x, y: second.y, vy: 0 });
  platform.step(game); assert.equal(game.lives, 2); assert.equal(game.player.x, 80); assert.equal(game.orbs[0].collected, true);
  assert.ok(game.player.immune > 0);
});
test('checkpoint survives falls, the third fall ends the run, and stopped worlds do not advance', () => {
  const game = platform.create(); platform.start(game);
  game.player.x = 1605; platform.step(game); assert.equal(game.checkpoint, 1605);
  game.player.y = 450; platform.step(game); assert.equal(game.player.x, 1605); assert.equal(game.lives, 2);
  game.player.y = 450; platform.step(game); game.player.y = 450; platform.step(game);
  assert.equal(game.phase, 'lost'); const end = JSON.stringify(game); simulate(game, 2, { direction: 1, jump: true }); assert.equal(JSON.stringify(game), end);
});
test('finish requires all seven balls, awards its life bonus once, and preserves a finite winning state', () => {
  const game = platform.create(); platform.start(game);
  game.player.x = 3290; platform.step(game); assert.equal(game.phase, 'playing'); assert.equal(game.event, 'missing');
  game.orbs.forEach(orb => { orb.collected = true; }); platform.step(game); assert.equal(game.phase, 'won'); assert.equal(game.score, 1500);
  simulate(game, 1); assert.equal(game.score, 1500);
});
test('the entire Cloud Trail is physically completable through ordinary run/jump input, with all seven balls', () => {
  const game = platform.create(); platform.start(game);
  // A deterministic navigator uses the same actions as a player: it cannot
  // reposition actors, modify collectibles, change lives or bypass collisions.
  for (let frame = 0; frame < 120 * 60 && game.phase === 'playing'; frame++) {
    const p = game.player, target = game.orbs.find(orb => !orb.collected), targetX = target ? target.x : 3300;
    const direction = Math.abs(targetX - p.x) > 4 ? Math.sign(targetX - p.x) : 0;
    let shouldJump = false;
    if (direction > 0) {
      shouldJump = platform.solids.some(tile => tile.y < platform.GROUND && tile.y < p.y + p.h && tile.y > p.y + p.h - 105 && tile.x - p.x > 15 && tile.x - p.x < 75);
      shouldJump ||= game.enemies.some(bot => bot.alive && bot.x - p.x > 5 && bot.x - p.x < 85 && Math.abs(p.y + p.h - platform.GROUND) < 6);
      shouldJump ||= platform.solids.some(tile => tile.y === platform.GROUND && p.x >= tile.x && p.x < tile.x + tile.w && tile.x + tile.w - p.x < 70 && tile.x + tile.w < platform.WIDTH);
    }
    if (target && Math.abs(targetX - p.x) < 25 && target.y + target.h < p.y + p.h - 15) shouldJump = true;
    platform.step(game, { direction, jump: p.grounded ? !p.jumpHeld && shouldJump : p.jumpHeld }, 1 / 120);
  }
  assert.equal(game.phase, 'won'); assert.equal(game.orbs.filter(orb => orb.collected).length, 7);
  assert.equal(game.lives, 3); assert.equal(game.checkpoint, 1605); assert.ok(game.score >= 3250);
  assert.ok(game.camera >= 0 && game.camera <= platform.WIDTH - 640);
  assert.ok(game.player.x - game.camera < 640);
});

const source = await readFile(new URL('../assets/goku-platformer.js', import.meta.url), 'utf8');
function controlsHarness() {
  let focus, now = 0, sequence = 0; const frames = new Map(), timers = new Map(), nodes = new Map();
  const trace = { x: 0, y: 0, blasts: 0 };
  const paint = main => ({ fillRect() { if (main && this.fillStyle === '#fffce0') trace.blasts++; }, fillText() {}, save() {}, restore() {}, scale() {}, drawImage() {}, translate(x, y) { if (main) { trace.x = x; trace.y = y; } } });
  class Element {
    constructor(tag = '') { this.tag = tag; this.listeners = {}; this.dataset = {}; this.attributes = new Map(); this.open = false; this.textContent = ''; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    fire(name, data = {}) { this.listeners[name]?.forEach(fn => fn({ target: this, preventDefault() {}, stopPropagation() {}, ...data })); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key); }
    removeAttribute(key) { this.attributes.delete(key); if (key === 'data-held') delete this.dataset.held; }
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, new Element(selector === '#platform-canvas' ? 'canvas' : selector.includes('platform-') && !selector.includes('status') ? 'button' : 'span')); return nodes.get(selector); }
    querySelectorAll() { return buttons; }
    getContext() { return this.ctx ||= paint(this === canvas); }
    closest(selector) { return selector === 'button' && this.tag === 'button' ? this : null; }
    setPointerCapture() {} showModal() { this.open = true; } close() { this.open = false; this.fire('close'); } focus() { focus = this; }
  }
  const dialog = new Element('dialog'), root = new Element(), window = new Element(), opener = new Element('button');
  const buttons = ['left', 'right', 'jump', 'attack'].map(control => { const button = new Element('button'); button.dataset.platformHold = control; return button; });
  const canvas = dialog.querySelector('#platform-canvas');
  const document = new Element(); Object.assign(document, { documentElement: root, hidden: false, getElementById: id => id === 'platformer-dialog' ? dialog : null, createElement: tag => new Element(tag) });
  window.dispatchEvent = () => {}; window.PortfolioGames = { run() { dialog.close(); } };
  vm.runInNewContext(source, { document, window, matchMedia: () => ({ matches: false, addEventListener() {} }), CustomEvent: class {}, requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; }, cancelAnimationFrame: id => frames.delete(id), setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id) });
  const pump = (elapsed = 20) => { now += elapsed; trace.blasts = 0; const active = [...frames.values()]; frames.clear(); active.forEach(fn => fn(now)); };
  return { window, document, dialog, root, opener, canvas, trace, frames, timers, focus: () => focus, pump, button: control => buttons.find(button => button.dataset.platformHold === control), key: (type, key, extra = {}) => dialog.fire(type, { target: canvas, key, ...extra }), start() { window.PortfolioPlatformer.open(opener); dialog.querySelector('#platform-action').fire('click'); pump(0); } };
}
test('a pointer or keyboard jump/ki tap between frames is consumed once by physics', () => {
  for (const input of ['pointer', 'keyboard']) {
    const h = controlsHarness(); h.start(); const ground = h.trace.y;
    if (input === 'pointer') {
      h.button('jump').fire('pointerdown', { button: 0, pointerId: 1 }); h.button('jump').fire('pointerup', { pointerId: 1 });
      h.button('attack').fire('pointerdown', { button: 0, pointerId: 2 }); h.button('attack').fire('pointerup', { pointerId: 2 });
    } else { h.key('keydown', ' '); h.key('keyup', ' '); h.key('keydown', 'x'); h.key('keyup', 'x'); }
    h.pump(1); assert.equal(h.trace.y, ground, 'no physics tick has occurred yet');
    h.pump(25); assert.ok(h.trace.y < ground); assert.ok(h.trace.blasts > 0);
    for (let i = 0; i < 80; i++) h.pump(20);
    assert.equal(h.trace.y, ground, 'a single tap cannot repeat after landing'); assert.equal(h.trace.blasts, 0);
  }
});
test('pause and closing discard pending taps and switch timers, with no work while closed', () => {
  const h = controlsHarness(); h.start(); const ground = h.trace.y;
  h.key('keydown', ' '); h.key('keyup', ' '); h.key('keydown', 'p');
  assert.equal(h.frames.size, 0); h.key('keyup', 'p'); h.key('keydown', 'p'); h.pump(0); h.pump(25);
  assert.equal(h.trace.y, ground, 'pause clears the unconsumed jump');
  h.button('jump').fire('click', { detail: 0 }); assert.equal(h.timers.size, 1);
  h.window.PortfolioPlatformer.close(); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.focus(), h.opener); assert.equal(h.root.dataset.training, undefined);
  h.window.PortfolioPlatformer.open(h.opener); assert.equal(h.frames.size, 0, 'reopening retains the paused state');
});
test('equivalent physical keys remain independent and Space on native buttons is not swallowed', () => {
  const h = controlsHarness(); h.start();
  h.key('keydown', 'd'); h.key('keydown', 'ArrowRight'); h.key('keyup', 'd');
  for (let i = 0; i < 10; i++) h.pump(20);
  assert.ok(h.trace.x > 105, 'the right arrow remains held after D is released');
  let prevented = false;
  h.dialog.fire('keydown', { target: h.button('jump'), key: ' ', preventDefault() { prevented = true; } });
  h.dialog.fire('keyup', { target: h.button('jump'), key: ' ', preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});
