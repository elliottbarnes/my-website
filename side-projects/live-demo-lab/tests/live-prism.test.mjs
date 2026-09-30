import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/interactive/live-prism.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, URL, AbortController, setTimeout, clearTimeout };
vm.runInNewContext(source, sandbox);
const { Client, endpoint, inputs, randomSeed, requestId, signedImageURL, resultResponse,
  MODEL, MAX_SEED, RETENTION_MS, POLL_WINDOW_MS } = sandbox.module.exports;
const API = 'https://abcdef1234.execute-api.us-west-2.amazonaws.com';
const ID = '12345678-abcd-4abc-8abc-000000000001';
const PROMPT = 'A small observatory beside the sea';
const plain = (value) => JSON.parse(JSON.stringify(value));
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const health = { enabled: true, model: MODEL, limits: { monthly: 75, daily: 5, perIpDaily: 3 } };
const imageURL = (jobId = ID) => `https://demo-bucket.s3.us-west-2.amazonaws.com/generated/${jobId}.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature=${'a'.repeat(64)}`;
const result = (status = 'queued', jobId = ID, extra = {}) => ({ jobId, status, prompt: PROMPT, seed: 42,
  model: MODEL, settings: { aspectRatio: '1:1', outputFormat: 'png', images: 1, width: 1024, height: 1024 },
  ...(status === 'succeeded' ? { imageUrl: imageURL(jobId) } : {}), ...extra });

function harness(options = {}) {
  const calls = [], changes = [], timers = new Map(), store = options.store || { record: null, draft: null };
  let clock = 1_800_000_000_000, timerId = 0, id = 0;
  const fixture = {
    calls, changes, timers, store, get clock() { return clock; }, advance(ms) { clock += ms; },
    handler: async (url, request) => {
      if (url.endsWith('/health')) return response(health);
      if (request.method === 'POST') return response({ jobId: JSON.parse(request.body).requestId, status: 'queued' }, 202);
      return response(result('queued', url.split('/').at(-1)));
    },
    async runPoll() {
      const entry = [...timers].find(([, timer]) => timer.delay === 4000);
      assert.ok(entry, 'a single delayed poll should be scheduled');
      timers.delete(entry[0]); clock += 4000; entry[1].fn();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
  const client = new Client({
    api: options.api ?? API, store, now: () => clock,
    crypto: { randomUUID: () => `12345678-abcd-4abc-8abc-${String(++id).padStart(12, '0')}` },
    fetch: async (url, request) => { calls.push({ url, request }); return fixture.handler(url, request); },
    setTimeout: (fn, delay) => { const key = ++timerId; timers.set(key, { fn, delay }); return key; },
    clearTimeout: (key) => timers.delete(key),
    onChange: (state) => changes.push({ ...state, record: state.record ? plain(state.record) : null }),
  });
  fixture.client = client;
  return fixture;
}

test('empty endpoint performs no external calls and identifies the disconnected local prototype', async () => {
  const h = harness({ api: '' });
  await h.client.mount();
  await h.client.generate(PROMPT, 42);
  assert.equal(h.calls.length, 0);
  assert.equal(h.changes.at(-1).phase, 'disconnected');
  assert.match(h.changes.at(-1).message, /Local prototype.*not connected/);
});

test('only the exact Oregon API Gateway endpoint shape is accepted', () => {
  assert.equal(endpoint(API + '/'), API);
  assert.equal(endpoint('  '), null);
  for (const value of ['http://abcdef.execute-api.us-west-2.amazonaws.com', 'https://example.com',
    API + '.evil.test', API + '/stage', API + '?x=1', API + '#hash',
    'https://name:password@abcdef.execute-api.us-west-2.amazonaws.com',
    'https://abc.execute-api.us-east-1.amazonaws.com', 'https://abc.execute-api.us-west-2.amazonaws.com:444']) {
    assert.throws(() => endpoint(value));
  }
});

test('prompt and seed types, length, and bounds are validated before any POST', async () => {
  assert.deepEqual(plain(inputs('  A sky  ', '42')), { prompt: 'A sky', seed: 42 });
  for (const seed of [1, MAX_SEED]) assert.equal(inputs(PROMPT, seed).seed, seed);
  for (const seed of [0, -1, MAX_SEED + 1, true, false, null, '', '1e3', '1.0', ' 42', '4.2', 1.1]) {
    assert.throws(() => inputs(PROMPT, seed), /whole seed/);
  }
  for (const prompt of ['', 'xx', ' '.repeat(8), 'a'.repeat(1001), 'a\0b', 'a\ud800b', 42, null]) assert.throws(() => inputs(prompt, 42));
  assert.equal(inputs('A planet \u{1f30e}', 42).prompt, 'A planet \u{1f30e}');
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, 0);
  assert.equal(h.calls.length, 1);
  assert.match(h.changes.at(-1).message, /whole seed/);
});

test('random seed uses secure bytes and rejects zero; fallback request IDs are UUIDv4', () => {
  let call = 0;
  assert.equal(randomSeed({ getRandomValues: (bytes) => { bytes[0] = ++call === 1 ? 0 : MAX_SEED; return bytes; } }), MAX_SEED);
  assert.equal(call, 2);
  assert.throws(() => randomSeed(null));
  assert.match(requestId({ getRandomValues: (bytes) => { bytes.fill(255); return bytes; } }), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-b[a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('generated URLs must be signed HTTPS S3 URLs for the exact job image', () => {
  assert.equal(signedImageURL(imageURL(), ID), imageURL());
  const pathStyle = imageURL().replace('demo-bucket.s3.us-west-2.amazonaws.com/generated', 's3.us-west-2.amazonaws.com/demo-bucket/generated');
  assert.equal(signedImageURL(pathStyle, ID), pathStyle);
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,aA==', 'https://evil.example/file.png',
    imageURL().replace('amazonaws.com', 'amazonaws.com.evil.test'), imageURL().replace('https:', 'http:'),
    imageURL().replace('300', '301'), imageURL().replace(ID, '12345678-abcd-4abc-8abc-000000000999'),
    imageURL().split('?')[0], imageURL() + '#hash', imageURL().replace('https://', 'https://name:password@')]) {
    assert.throws(() => signedImageURL(url, ID));
  }
});

test('health checking never invokes generation and disabled service blocks submission', async () => {
  const h = harness(); h.handler = async () => response({ ...health, enabled: false });
  await h.client.mount(); await h.client.generate(PROMPT, 42);
  assert.equal(h.calls.length, 1);
  assert.equal(h.changes.at(-1).phase, 'disabled');
  assert.equal(h.store.record, null);
});

test('a new image uses one POST and sequential GET polling until success', async () => {
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, '42');
  assert.equal(h.calls.filter((call) => call.request.method === 'POST').length, 1);
  const post = h.calls.find((call) => call.request.method === 'POST');
  assert.deepEqual(JSON.parse(post.request.body), { prompt: PROMPT, seed: 42, requestId: ID });
  assert.equal(post.request.credentials, 'omit');
  assert.equal(post.request.redirect, 'error');
  assert.equal(h.store.record.status, 'queued');
  assert.equal([...h.timers.values()].filter((timer) => timer.delay === 4000).length, 1);
  h.handler = async () => response(result('succeeded'));
  await h.runPoll();
  assert.equal(h.store.record.status, 'succeeded');
  assert.equal(h.store.record.result.imageUrl, imageURL());
  assert.equal(h.timers.size, 0);
});

test('an ambiguous network POST failure reuses its request ID on manual retry', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async () => { throw new TypeError('private network detail'); };
  await h.client.generate(PROMPT, 42);
  assert.equal(h.store.record.status, 'uncertain');
  assert.equal(h.store.record.requestId, ID);
  assert.doesNotMatch(h.changes.at(-1).message, /private network/);
  h.handler = async (url, request) => request.method === 'POST'
    ? response({ jobId: ID, status: 'queued' }, 202) : response(result('succeeded'));
  await h.client.generate(PROMPT, 42);
  const bodies = h.calls.filter((call) => call.request.method === 'POST').map((call) => JSON.parse(call.request.body));
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(h.store.record.status, 'succeeded');
});

test('a different input cannot silently replace an unresolved request', async () => {
  const h = harness(); await h.client.mount(); h.handler = async () => { throw new Error('offline'); };
  await h.client.generate(PROMPT, 42); await h.client.generate(PROMPT, 43);
  assert.equal(h.calls.filter((call) => call.request.method === 'POST').length, 1);
  assert.match(h.changes.at(-1).message, /pending request/);
});

test('reopening an uncertain request checks GET only and never repeats POST automatically', async () => {
  const h = harness(); await h.client.mount(); h.handler = async () => { throw new Error('offline'); };
  await h.client.generate(PROMPT, 42); h.client.dispose();
  const reopened = harness({ store: h.store });
  await reopened.client.mount();
  assert.deepEqual(reopened.calls.map((call) => call.url.slice(API.length)), ['/health', `/generations/${ID}`]);
  assert.ok(reopened.calls.every((call) => !call.request.method));
  assert.equal(reopened.store.record.status, 'queued');
  reopened.client.dispose();
});

test('repeating a successful input refreshes its saved result without another paid request', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async (url, request) => request.method === 'POST'
    ? response({ jobId: ID, status: 'succeeded' }, 202) : response(result('succeeded'));
  await h.client.generate(PROMPT, 42); await h.client.generate(PROMPT, 42);
  assert.equal(h.calls.filter((call) => call.request.method === 'POST').length, 1);
  assert.equal(h.calls.filter((call) => call.url.endsWith(`/generations/${ID}`)).length, 2);
});

test('transient polling failure pauses and manual check resumes GET without POST', async () => {
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, 42);
  h.handler = async () => { throw new Error('offline'); }; await h.runPoll();
  assert.equal(h.changes.at(-1).phase, 'paused');
  assert.equal(h.timers.size, 0);
  h.handler = async () => response(result('succeeded')); await h.client.check();
  assert.equal(h.store.record.status, 'succeeded');
  assert.equal(h.calls.filter((call) => call.request.method === 'POST').length, 1);
});

test('shared quota rejection has a clear message and never starts polling', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async () => response({ error: { code: 'GENERATION_LIMIT_REACHED' } }, 429);
  await h.client.generate(PROMPT, 42);
  assert.equal(h.store.record.status, 'rejected');
  assert.match(h.changes.at(-1).message, /allowance/);
  assert.equal(h.timers.size, 0);
  assert.equal(h.calls.length, 2);
});

test('filtered results contain no image and surface the filtering explanation', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async (url, request) => request.method === 'POST' ? response({ jobId: ID, status: 'queued' }, 202)
    : response(result('failed', ID, { imageUrl: imageURL(), error: { code: 'CONTENT_FILTERED' } }));
  await h.client.generate(PROMPT, 42);
  assert.equal(h.store.record.status, 'failed');
  assert.equal(h.store.record.result.imageUrl, undefined);
  assert.match(h.changes.at(-1).message, /filtered/);
});

test('incorrect job IDs, settings, seed, prompt or model are never displayed as a user result', () => {
  const record = { requestId: ID, prompt: PROMPT, seed: 42 };
  for (const patch of [{ jobId: ID.replace(/1$/, '2') }, { prompt: 'Someone else' }, { seed: 43 },
    { model: 'other-model' }, { settings: { aspectRatio: '16:9', outputFormat: 'png', images: 1 } },
    { settings: { aspectRatio: '1:1', outputFormat: 'png', images: 2, width: 1024, height: 1024 } },
    { imageUrl: 'https://evil.example/image.png' }]) assert.throws(() => resultResponse(result('succeeded', ID, patch), record));
});

test('incorrect POST response leaves the same request available for a safe retry', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async () => response({ jobId: ID.replace(/1$/, '2'), status: 'queued' }, 202);
  await h.client.generate(PROMPT, 42);
  assert.equal(h.store.record.requestId, ID);
  assert.equal(h.store.record.jobId, null);
  assert.equal(h.store.record.status, 'uncertain');
  assert.equal(h.calls.length, 2);
  assert.match(h.changes.at(-1).message, /unexpected response/);
});

test('cleanup aborts pending POST and ignores a late successful response', async () => {
  const h = harness(); await h.client.mount();
  let resolve;
  h.handler = async () => new Promise((done) => { resolve = done; });
  const pending = h.client.generate(PROMPT, 42);
  const post = h.calls.at(-1);
  const count = h.changes.length;
  h.client.dispose();
  assert.equal(post.request.signal.aborted, true);
  resolve(response({ jobId: ID, status: 'queued' }, 202));
  await pending;
  assert.equal(h.changes.length, count);
  assert.equal(h.store.record.status, 'uncertain');
  assert.equal(h.store.record.jobId, null);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test('cleanup also cancels delayed polls and prevents new requests', async () => {
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, 42);
  h.client.dispose(); await h.client.check(); await h.client.generate(PROMPT, 42);
  assert.equal(h.calls.length, 3);
  assert.equal(h.timers.size, 0);
});

test('a timed-out request cannot publish a late response even if the fetch implementation ignores abort', async () => {
  const h = harness(); await h.client.mount();
  let resolve; h.handler = async () => new Promise((done) => { resolve = done; });
  const pending = h.client.generate(PROMPT, 42);
  const timeout = [...h.timers.values()].find((timer) => timer.delay === 15000);
  timeout.fn();
  resolve(response({ jobId: ID, status: 'queued' }, 202)); await pending;
  assert.equal(h.store.record.jobId, null);
  assert.equal(h.store.record.status, 'uncertain');
  assert.equal(h.changes.at(-1).phase, 'paused');
  assert.equal(h.calls.length, 2);
});

test('in-flight checks never overlap and automatic checks stop after ten minutes', async () => {
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, 42);
  let resolve; h.handler = async () => new Promise((done) => { resolve = done; });
  const pending = h.client.check(); await h.client.check();
  assert.equal(h.calls.length, 4);
  h.advance(POLL_WINDOW_MS);
  resolve(response(result('running'))); await pending;
  assert.equal(h.timers.size, 0);
  assert.match(h.changes.at(-1).message, /10 minutes/);
  assert.equal(h.changes.at(-1).phase, 'paused');
});

test('an unknown request is checked safely before its original ID can be submitted again', async () => {
  const h = harness(); await h.client.mount(); h.handler = async () => { throw new Error('offline'); };
  await h.client.generate(PROMPT, 42);
  h.handler = async () => response({ error: { code: 'GENERATION_NOT_FOUND' } }, 404);
  await h.client.check();
  assert.equal(h.store.record.status, 'rejected');
  assert.equal(h.store.record.requestId, ID);
  assert.match(h.changes.at(-1).message, /same request ID/);
});

test('expired results are forgotten on reopen and require an explicit new submission', async () => {
  const h = harness(); await h.client.mount(); await h.client.generate(PROMPT, 42); h.client.dispose();
  const store = h.store;
  store.record.startedAt -= RETENTION_MS;
  const reopened = harness({ store }); await reopened.client.mount();
  assert.equal(store.record, null);
  assert.equal(reopened.calls.length, 1);
  assert.equal(reopened.calls[0].url, API + '/health');
});

test('arbitrary server error strings cannot become user-facing HTML or text', async () => {
  const h = harness(); await h.client.mount();
  h.handler = async () => response({ error: { code: '<img src=x onerror=alert(1)>', message: 'secret text' } }, 500);
  await h.client.generate(PROMPT, 42);
  assert.doesNotMatch(h.changes.at(-1).message, /img|secret|alert/);
  assert.equal(h.changes.at(-1).message, 'The image service is unavailable. You can check again without starting a new generation.');
});
