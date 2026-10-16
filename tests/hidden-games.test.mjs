import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rules = createRequire(import.meta.url)('../assets/hidden-games.js');
test('ki scores all five bands inclusively and rejects early/overcharged releases', () => {
  rules.bands.forEach(([low, high], round) => {
    assert.equal(rules.release(round, low * 22).hit, true);
    assert.equal(rules.release(round, high * 22).hit, true);
    assert.equal(rules.release(round, (low - 1) * 22).hit, false);
    assert.equal(rules.release(round, (high + 1) * 22).hit, false);
    assert.equal(rules.release(round, (low + high) / 2 * 22).perfect, true);
    assert.equal(rules.release(round, 100000).power, 100);
    assert.equal(rules.release(round, 0).hit, false);
  });
});
test('radar fields contain exactly seven unique reachable targets', () => {
  for (const random of [() => 0, () => .999999, Math.random]) {
    const field = rules.field(random);
    assert.equal(field.length, 7); assert.equal(new Set(field).size, 7);
    assert.ok(field.every(i => i >= 0 && i < 36));
  }
});
test('radar distances do not wrap rows and exclude collected targets', () => {
  assert.equal(rules.ping([6, 35], [], 5).distance, 5);
  assert.equal(rules.ping([6, 35], [], 7).distance, 1);
  assert.equal(rules.ping([6, 35], [], 8).distance, 2);
  assert.equal(rules.ping([6, 35], [6], 7).distance, 8);
  assert.equal(rules.ping([6, 35], [], 6).found, true);
  assert.equal(rules.ping([6, 35], [6], 6).found, false);
});
test('a full grid search always finishes with seven discoveries', () => {
  const targets = rules.field(() => .5), found = [];
  for (let i = 0; i < 36; i++) if (rules.ping(targets, found, i).found) found.push(i);
  assert.deepEqual([...found].sort((a,b) => a-b), [...targets].sort((a,b) => a-b));
});
