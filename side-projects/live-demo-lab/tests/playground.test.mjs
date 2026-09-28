import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/interactive/playground.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(source, sandbox);
const { emptyQueue, stepQueue, diffWords, parseCents, reconcileRecords, evaluateFixture, evaluateText, parseRecordsCSV, parseTrafficPattern, renderRecordsTable, renderReconcileIssues, DEMO_LIMITS } = sandbox.module.exports;
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

test('custom traffic patterns preserve bursts, pauses, and bounds', () => {
  assert.deepEqual(plain(parseTrafficPattern(' 0, 6, 100, 0 ')), [0, 6, 100, 0]);
  assert.deepEqual(plain(parseTrafficPattern('  ')), []);
  for (const value of ['6,,2', '6,', '-1', '101', '1.2', '1e2', Array(31).fill('1').join(',')]) {
    assert.throws(() => parseTrafficPattern(value), /whole numbers/);
  }
  let state = emptyQueue();
  for (const arrival of parseTrafficPattern('100,0,0,0,0,0')) state = stepQueue(state, arrival, 4);
  assert.equal(state.queued, 0);
  assert.equal(state.completed, 18);
  assert.equal(state.rejected, 82);
});

test('custom evaluation checks literal case-sensitive phrases on both answers', () => {
  assert.deepEqual(plain(evaluateText('Contact support in 5 days.', 'Contact Support in 1 day.', 'support\n5 days.\nsupport')), [
    { label: 'Contains “support” (case-sensitive)', baseline: true, candidate: false },
    { label: 'Contains “5 days.” (case-sensitive)', baseline: true, candidate: false },
  ]);
  assert.deepEqual(plain(evaluateText('a.b', 'axb', 'a.b')), [{ label: 'Contains “a.b” (case-sensitive)', baseline: true, candidate: false }]);
  assert.deepEqual(plain(evaluateText('before', 'after', ' \n ')), []);
  assert.throws(() => evaluateText('', '', Array(6).fill(0).map((_, i) => String(i)).join('\n')), /five required/);
  assert.throws(() => evaluateText('', '', 'x'.repeat(101)), /five required/);
});

test('answer bounds protect diff allocation before text comparison', () => {
  const allowed = Array(DEMO_LIMITS.textWords).fill('word').join(' ');
  assert.equal(diffWords(allowed, allowed).map((part) => part.text).join(''), allowed);
  for (const input of [`${allowed} extra`, 'x'.repeat(DEMO_LIMITS.textCharacters + 1)]) {
    assert.throws(() => diffWords(input, 'small'), /300 words/);
    assert.throws(() => diffWords('small', input), /300 words/);
    assert.throws(() => evaluateText(input, 'small'), /300 words/);
  }
});

test('CSV accepts common line endings, BOM, quoted IDs, escaped quotes and exact amounts', () => {
  assert.deepEqual(plain(parseRecordsCSV('\uFEFFid,amount\r\n"order,one",0.10\r\n"a""b",-12.5\r\nempty,0\r\n')), [
    { id: 'order,one', cents: 10 }, { id: 'a"b', cents: -1250 }, { id: 'empty', cents: 0 },
  ]);
  assert.deepEqual(plain(parseRecordsCSV(' ID , Amount \n\nA,18.99\n')), [{ id: 'A', cents: 1899 }]);
  assert.deepEqual(plain(parseRecordsCSV('id,amount\n')), []);
});

test('CSV refuses malformed records instead of rounding or silently dropping columns', () => {
  const cases = [
    ['', /header/], ['id,total\nA,1', /header/], ['id,amount,extra\nA,1,x', /header/],
    ['id,amount\n,1', /needs an ID/], ['id,amount\nA,1,extra', /two columns/],
    ['id,amount\n"A,1', /not closed/], ['id,amount\n"A"x,1', /closing CSV quote/],
    ['id,amount\na"b,1', /start of a field/], ['id,amount\n"A\nB",1', /control characters/],
    ['id,amount\nA,1.001', /decimal/], ['id,amount\nA,1e2', /decimal/],
    ['id,amount\nA,NaN', /decimal/], ['id,amount\nA,90071992547409.92', /supported range/],
  ];
  for (const [input, expected] of cases) assert.throws(() => parseRecordsCSV(input), expected);
});

test('CSV record, character, and ID limits are enforced', () => {
  const records = Array.from({ length: DEMO_LIMITS.csvRecords }, (_, index) => `A${index},1.00`);
  assert.equal(parseRecordsCSV(`id,amount\n${records.join('\n')}`).length, DEMO_LIMITS.csvRecords);
  assert.throws(() => parseRecordsCSV(`id,amount\n${records.join('\n')}\nextra,1.00`), /200 records/);
  assert.throws(() => parseRecordsCSV('x'.repeat(DEMO_LIMITS.csvCharacters + 1)), /20000 characters/);
  assert.throws(() => parseRecordsCSV(`id,amount\n${'x'.repeat(81)},1.00`), /1–80 characters/);
});

test('cent parsing preserves the exact safe-integer boundary and refuses unsafe differences', () => {
  assert.equal(parseCents('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  assert.equal(parseCents('-90071992547409.91'), -Number.MAX_SAFE_INTEGER);
  assert.throws(() => parseCents('90071992547409.92'), /supported range/);
  assert.throws(() => reconcileRecords([{ id: 'A', cents: -Number.MAX_SAFE_INTEGER }], [{ id: 'A', cents: 1 }]), /exact-cent range/);
});

test('custom CSV reconciliation reports duplicates and missing IDs on either side', () => {
  const ledger = parseRecordsCSV('id,amount\nleft,1\nleft,1\nonly-ledger,2\nboth,3\nboth,3');
  const incoming = parseRecordsCSV('id,amount\nleft,1\nonly-export,2\nboth,3\nboth,3\nboth,3');
  const report = reconcileRecords(ledger, incoming);
  assert.deepEqual(plain(report), { matched: 0, issues: [
    { id: 'both', type: 'duplicate', expectedCount: 2, actualCount: 3 },
    { id: 'left', type: 'duplicate', expectedCount: 2, actualCount: 1 },
    { id: 'only-export', type: 'missing', side: 'ledger' },
    { id: 'only-ledger', type: 'missing', side: 'export' },
  ] });
  const rendered = renderReconcileIssues(report.issues);
  assert.match(rendered, /2 copies in the ledger; 3 in the export/);
  assert.match(rendered, /Missing from the ledger/);
  assert.match(rendered, /Missing from the export/);
});

test('CSV IDs and captions remain text in rendered tables and issue reports', () => {
  const id = '<img src=x onerror=alert(1)>';
  const rows = parseRecordsCSV(`id,amount\n${id},0.01`);
  const table = renderRecordsTable(rows, '<script>alert(1)</script>');
  const issues = renderReconcileIssues(reconcileRecords(rows, []).issues);
  for (const html of [table, issues]) {
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script'));
  }
  assert.ok(table.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});
