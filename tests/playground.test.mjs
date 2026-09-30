import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/interactive/playground.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(source, sandbox);
const { emptyQueue, stepQueue, diffWords, parseCents, reconcileRecords, evaluateFixture } = sandbox.module.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the queue conserves requests and remains bounded during overload and recovery', () => {
  let state = emptyQueue();
  for (let tick = 0; tick < 100; tick++) {
    state = stepQueue(state, 12, 1);
    assert.ok(state.queued >= 0 && state.queued <= 18);
    assert.equal(state.received, state.queued + state.completed + state.rejected);
  }
  assert.ok(state.rejected > 0);
  const received = state.received;
  for (let tick = 0; tick < 18; tick++) state = stepQueue(state, 0, 8);
  assert.equal(state.queued, 0);
  assert.equal(state.received, received);
  assert.equal(state.completed + state.rejected, received);
});

test('queue admission happens before processing and a quiet service is idle', () => {
  assert.deepEqual(plain(stepQueue(emptyQueue(), 0, 4)), { tick: 1, queued: 0, completed: 0, rejected: 0, received: 0 });
  const state = stepQueue(emptyQueue(), 12, 4);
  assert.deepEqual(plain(state), { tick: 1, queued: 8, completed: 4, rejected: 0, received: 12 });
  const next = stepQueue(state, 12, 4);
  assert.deepEqual(plain(next), { tick: 2, queued: 14, completed: 8, rejected: 2, received: 24 });
});

test('word comparison preserves both exact texts, including repeated words and whitespace', () => {
  for (const [before, after] of [['one two two\nthree', 'one two new three'], ['', 'added'], ['removed', ''], ['same same', 'same same']]) {
    const diff = diffWords(before, after);
    assert.equal(diff.filter((part) => part.type !== 'added').map((part) => part.text).join(''), before);
    assert.equal(diff.filter((part) => part.type !== 'removed').map((part) => part.text).join(''), after);
  }
});

test('sample evaluation distinguishes an allowed change from a regression', () => {
  assert.equal(evaluateFixture('refund').filter((check) => !check.candidate).length, 1);
  assert.equal(evaluateFixture('json').filter((check) => !check.candidate).length, 0);
  assert.equal(evaluateFixture('fallback').filter((check) => !check.candidate).length, 2);
  for (const id of ['refund', 'json', 'fallback']) assert.ok(evaluateFixture(id).every((check) => check.baseline));
  assert.throws(() => evaluateFixture('unknown'), /Unknown sample/);
});

test('money is parsed into exact cents without floating point tolerances', () => {
  assert.equal(parseCents('0.10') + parseCents('0.20'), parseCents('0.30'));
  assert.equal(parseCents('18.99'), 1899);
  assert.equal(parseCents('12.5'), 1250);
  assert.equal(parseCents('-0.01'), -1);
  for (const value of ['1.001', '1e3', '$4.00', '', 'NaN']) assert.throws(() => parseCents(value), /decimal/);
  assert.throws(() => parseCents('9007199254740992'), /supported range/);
});

test('reconciliation independently detects a cent mismatch, missing ID and duplicate ID', () => {
  const expected = [{ id: 'A', cents: 100 }, { id: 'B', cents: 200 }, { id: 'C', cents: 300 }, { id: 'D', cents: 400 }];
  const actual = [{ id: 'A', cents: 100 }, { id: 'B', cents: 201 }, { id: 'D', cents: 400 }, { id: 'D', cents: 400 }];
  assert.deepEqual(plain(reconcileRecords(expected, actual)), {
    matched: 1,
    issues: [
      { id: 'B', type: 'amount', expected: 200, actual: 201, difference: 1 },
      { id: 'C', type: 'missing', side: 'export' },
      { id: 'D', type: 'duplicate', expectedCount: 1, actualCount: 2 },
    ],
  });
  assert.deepEqual(plain(reconcileRecords(expected, [...expected].reverse())), { matched: 4, issues: [] });
});

test('reconciliation reports unexpected IDs and rejects fractional-cent data', () => {
  assert.deepEqual(plain(reconcileRecords([], [{ id: 'new', cents: 0 }])).issues, [{ id: 'new', type: 'missing', side: 'ledger' }]);
  assert.throws(() => reconcileRecords([{ id: 'A', cents: 0.1 }], []), /integer cents/);
  assert.deepEqual(plain(reconcileRecords([{ id: '__proto__', cents: 10 }], [{ id: '__proto__', cents: 10 }])), { matched: 1, issues: [] });
});
