import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), engine = require('../assets/goku-platformer.js');
const store = () => {
  const values = new Map(); let writes = 0;
  return { values, get writes() { return writes; }, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { writes++; values.set(key, value); } };
};
function openingChain() {
  const game = engine.create(); engine.start(game);
  for (let i = 0; i < 1000 && game.longestChain < 3; i++) {
    engine.step(game, { direction: 1, jump: true, attack: Boolean(engine.targetForDash(game)) && !game.player.attackHeld });
  }
  assert.equal(game.longestChain, 3);
  return game;
}

test('an earned short chain survives natural loss without creating a completed score record', () => {
  const game = openingChain(), storage = store();
  for (let i = 0; i < 5000 && game.phase === 'playing'; i++) engine.step(game, { direction: 1 });
  assert.equal(game.phase, 'lost'); assert.equal(game.lastDamage, 'contact');
  assert.equal(engine.completedRun(game), null);
  assert.deepEqual(engine.recordChain(storage, game), { longestChain: 3, saved: true });
  assert.equal(engine.loadChainRecord(storage), 3);
  assert.equal(storage.getItem(engine.RECORD_KEY), null);
  const writes = storage.writes;
  assert.deepEqual(engine.recordChain(storage, game), { longestChain: 3, saved: true });
  assert.equal(storage.writes, writes, 'ties do not rewrite storage');
});

test('pause or exit can save earned mastery; a newer best in another tab never regresses', () => {
  const game = openingChain(), storage = store();
  engine.recordChain(storage, game);
  storage.setItem(engine.CHAIN_RECORD_KEY, JSON.stringify({ version: 1, longestChain: 6 }));
  assert.deepEqual(engine.recordChain(storage, game, 3), { longestChain: 6, saved: true });
  assert.equal(engine.loadChainRecord(storage), 6);
  const writes = storage.writes;
  assert.equal(engine.recordChain(storage, engine.create(), 6).longestChain, 6);
  assert.equal(storage.writes, writes);
});

test('legacy completed chain bests remain valid and are never rewritten by a partial attempt', () => {
  const storage = store(), run = { score: 5000, chain: 7, timeMs: 60000 };
  const legacy = JSON.stringify({ version: 1, best: run, previous: run, longestChain: 7, fastestMs: 60000 });
  storage.setItem(engine.RECORD_KEY, legacy);
  assert.deepEqual(engine.recordChain(storage, openingChain()), { longestChain: 7, saved: true });
  assert.equal(storage.getItem(engine.RECORD_KEY), legacy);
  assert.equal(storage.getItem(engine.CHAIN_RECORD_KEY), null, 'the legacy best already persists');
});

test('invalid chain storage and unearned values cannot create goals; blocked storage keeps session mastery', () => {
  const storage = store();
  for (const raw of ['invalid', 'x'.repeat(129), 'null', '{}', '{"version":2,"longestChain":4}', ...[-1, 1.5, '4', engine.MAX_CHAIN + 1].map(longestChain => JSON.stringify({ version: 1, longestChain }))]) {
    storage.values.set(engine.CHAIN_RECORD_KEY, raw); assert.equal(engine.loadChainRecord(storage), 0);
  }
  storage.values.clear();
  const fresh = engine.create(); fresh.longestChain = 7;
  assert.deepEqual(engine.recordChain(storage, fresh), { longestChain: 0, saved: true });
  assert.equal(storage.writes, 0);
  const denied = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(engine.recordChain(denied, openingChain()), { longestChain: 3, saved: false });
  assert.deepEqual(engine.recordChain(denied, engine.create(), 3), { longestChain: 3, saved: false });
});

test('damage feedback identifies accepted falls, projectiles and collisions without changing immunity', () => {
  const fall = engine.create(); engine.start(fall); fall.player.y = 450; engine.step(fall);
  assert.equal(fall.lastDamage, 'fall'); assert.equal(fall.lives, 2);
  const shot = engine.create(); engine.start(shot);
  shot.hazards.push({ x: shot.player.x, y: shot.player.y, w: 12, h: 10, vx: 0, life: 1 }); engine.step(shot);
  assert.equal(shot.lastDamage, 'projectile'); assert.equal(shot.lives, 2);
  const immuneAt = shot.damageAt;
  shot.hazards.push({ x: shot.player.x, y: shot.player.y, w: 12, h: 10, vx: 0, life: 1 }); engine.step(shot);
  assert.equal(shot.lives, 2); assert.equal(shot.damageAt, immuneAt);
});
