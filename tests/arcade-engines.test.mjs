import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const blocks = require('../assets/block-blast.js');
const platform = require('../assets/goku-platformer.js');

test('blocks rejects out-of-bounds and overlapping moves without changing the board or tray', () => {
  const game = blocks.create(() => .4), before = JSON.stringify(game);
  assert.equal(blocks.place(game, 0, 7, 7).accepted, false);
  assert.equal(JSON.stringify(game), before);
  game.board[0] = 1;
  const occupied = JSON.stringify(game);
  assert.equal(blocks.place(game, 0, 0, 0).accepted, false);
  assert.equal(JSON.stringify(game), occupied);
  assert.equal(blocks.place(game, 0, -1, 0).accepted, false);
  assert.equal(blocks.place(game, 0, .5, 0).accepted, false);
});
test('blocks clears a completed row and column simultaneously, counting their shared cell once', () => {
  const game = blocks.create(() => 0);
  for (let i = 1; i < 8; i++) { game.board[i] = 1; game.board[i * 8] = 1; }
  const move = blocks.place(game, 0, 0, 0, () => 0);
  assert.equal(move.lines, 2); assert.equal(move.cleared.length, 15);
  assert.equal(game.board.filter(Boolean).length, 0);
  assert.equal(game.score, 410); assert.equal(game.lines, 2);
});
test('blocks deals only after all three pieces are used; blocked remaining pieces end the run', () => {
  const game = blocks.create(() => 0);
  blocks.place(game, 0, 0, 0, () => .9); blocks.place(game, 1, 2, 0, () => .9);
  assert.equal(game.tray.filter(Boolean).length, 1);
  blocks.place(game, 2, 4, 0, () => .9);
  assert.equal(game.tray.filter(Boolean).length, 3); assert.equal(game.tray[0].cells.length, 6);
  const trapped = blocks.create(() => 0);
  trapped.board = Array.from({ length: 64 }, (_, i) => (i + Math.floor(i / 8)) % 2);
  trapped.tray = [blocks.piece(0), blocks.piece(7), blocks.piece(7)];
  assert.equal(blocks.place(trapped, 0, 0, 0).accepted, true);
  assert.equal(trapped.over, true);
  const ended = JSON.stringify(trapped); assert.equal(blocks.place(trapped, 1, 1, 0).accepted, false); assert.equal(JSON.stringify(trapped), ended);
});
test('consecutive clears earn a streak and a non-clear ends it', () => {
  const game = blocks.create(() => 0);
  for (let row = 0; row < 2; row++) {
    for (let x = 1; x < 8; x++) game.board[row * 8 + x] = 1;
    blocks.place(game, row, 0, row, () => 0);
  }
  assert.equal(game.streak, 2); assert.equal(game.score, 270);
  blocks.place(game, 2, 0, 0, () => 0); assert.equal(game.streak, 0);
});
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
test('platforms support one-way travel over gaps and stop the player at solid sides', () => {
  const game = platform.create(); platform.start(game);
  Object.assign(game.player, { x: 280, y: 190, vy: 80, grounded: false });
  simulate(game, .3); assert.equal(game.player.y + game.player.h, 238); assert.equal(game.player.grounded, true);
  Object.assign(game.player, { x: 225, y: 235, vx: 220, vy: 0, grounded: false });
  simulate(game, .04, { direction: 1 }); assert.ok(game.player.x + game.player.w <= 250);
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
});
