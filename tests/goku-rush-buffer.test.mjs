import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const platform = require('../assets/goku-platformer.js');
const tick = (game, input = {}) => platform.step(game, { direction: 1, jump: true, ...input }, 1 / 120);
function firstRush() {
  const game = platform.create(); platform.start(game);
  for (let i = 0; i < 60 && !platform.targetForDash(game); i++) tick(game);
  assert.ok(platform.targetForDash(game), 'the starting jump reaches a real target');
  tick(game, { attack: true });
  assert.equal(game.rushes, 1); assert.equal(game.connections, 0);
  return game;
}
function lateTap(game, hold = false) {
  // Approach through ordinary simulated inputs, never actor/score mutation.
  while (game.player.dash) {
    const p = game.player, a = game.rings.find(ring => ring.id === p.dash.target);
    const distance = Math.hypot(a.x + a.w / 2 - p.x - p.w / 2, a.y + a.h / 2 - p.y - p.h / 2);
    if (distance < 34) break;
    tick(game);
  }
  tick(game, { attack: true });
  for (let i = 0; i < 30; i++) tick(game, { attack: hold });
}

test('a fresh early second tap connects the next clear target once', () => {
  const game = firstRush(); lateTap(game);
  assert.equal(game.rushes, 2); assert.equal(game.connections, 2);
  assert.equal(game.chain, 2); assert.equal(game.player.rushBuffer, 0);
  assert.equal(game.orbs[0].collected, true);
});
test('holding attack never queues or repeats a rush', () => {
  const game = firstRush();
  for (let i = 0; i < 45; i++) tick(game, { attack: true });
  assert.equal(game.rushes, 1); assert.equal(game.connections, 1);
  assert.equal(game.player.rushBuffer, 0);
});
test('holding the second tap consumes its queue once without a third rush', () => {
  const game = firstRush(); lateTap(game, true);
  assert.equal(game.rushes, 2); assert.equal(game.connections, 2);
});
test('a tap more than 120 ms before connection expires without a surprise rush', () => {
  const game = firstRush(); tick(game); tick(game, { attack: true });
  for (let i = 0; i < 35; i++) tick(game);
  assert.equal(game.rushes, 1); assert.equal(game.connections, 1);
  assert.equal(game.player.rushBuffer, 0);
});
