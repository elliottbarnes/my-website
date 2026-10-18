import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/source-signal-effects.js', import.meta.url), 'utf8');
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function runtime() {
  const realm = vm.createContext({ window: {}, setTimeout() { throw new Error('effect scheduled a timer'); },
    requestAnimationFrame() { throw new Error('effect owns a separate animation clock'); } });
  // Count allocation-producing integration work without exposing private math in the browser API.
  vm.runInContext('globalThis.mapCount=0; const originalMap=Array.prototype.map; Array.prototype.map=function(...args){mapCount++;return originalMap.apply(this,args)};', realm);
  vm.runInContext(source, realm);
  return { effects: realm.window.PortfolioSignalEffects, realm };
}

const shared = runtime();

function draw(kind, overrides = {}, instance = shared) {
  const calls = { text: [], glyphs: [], paths: [], segments: [], dots: [], fills: [], seeds: [], restores: 0 };
  let current = [], ellipse;
  const context = {
    save() {}, restore() { calls.restores++; },
    beginPath() { current = []; ellipse = null; },
    closePath() {},
    ellipse(x, y, rx, ry, rotation) { ellipse = { x, y, rx, ry, rotation }; },
    fill() { if (ellipse) calls.seeds.push({ ...ellipse, color: this.fillStyle, alpha: this.globalAlpha }); else calls.fills.push({ points: current, color: this.fillStyle, alpha: this.globalAlpha }); },
    moveTo(x, y) { current.push({ x, y }); },
    lineTo(x, y) { current.push({ x, y }); },
    stroke() { calls.paths.push({ points: current, color: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth }); },
  };
  const helpers = {
    clamp, smooth,
    layout(args, height) {
      const w = Math.min(args.width - 24, 540), h = Math.min(args.height - 30, height);
      return { w, h, left: 12, top: 15, right: w + 12, bottom: h + 15, scale: 1 };
    },
    begin() { context.save(); return context; },
    text(ctx, value, x, y, color, alpha, size = 9) { calls.text.push({ value, x, y, color, alpha, size }); },
    carry(ctx, value, x, y, color, alpha, size = 9) { calls.glyphs.push({ value, x, y, color, alpha, size }); },
    segment(ctx, x1, y1, x2, y2, color, alpha) { calls.segments.push({ x1, y1, x2, y2, color, alpha }); },
    dot(ctx, x, y, color, alpha, radius = 2) { calls.dots.push({ x, y, color, alpha, radius }); },
  };
  const args = { context, width: 348, height: 350, amount: 1, time: 4200,
    ink: '#ddd', accent: '#9b7', muted: '#887', highlight: '#ffe', ...overrides };
  const bounds = instance.effects.draw(kind, args, helpers);
  return { calls, bounds, width: Math.min(args.width - 24, 540), height: Math.min(args.height - 30, 320) };
}

const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≈ ${expected}`);

test('signal effects expose the three supported families and reject unavailable surfaces', () => {
  assert.deepEqual(Array.from(shared.effects.kinds), ['fourier', 'attractor', 'phyllotaxis']);
  assert.equal(shared.effects.draw('fourier', {}), null);
  assert.equal(draw('unknown').bounds, null);
  assert.equal(draw('fourier', { width: 0 }).bounds, null);
  assert.equal(draw('fourier', { height: 0 }).bounds, null);
  assert.ok(Object.isFrozen(shared.effects));
});

test('Fourier arms rotate at odd frequencies and end exactly at the sampled waveform value', () => {
  for (const time of [0, 300, 2100, 12000]) {
    const pointerX = .4;
    const { calls, width, height } = draw('fourier', { time, pointerX });
    const phase = time / 1700 + pointerX * .55;
    const baseRadius = Math.min(width * .123, (height - 156) * .33);
    const arms = calls.segments.slice(0, 4);
    let x = width * .235, y = (height - 22) / 2;
    for (const [i, n] of [1, 3, 5, 7].entries()) {
      near(arms[i].x1, x); near(arms[i].y1, y);
      near(Math.hypot(arms[i].x2 - x, arms[i].y2 - y), baseRadius / n);
      x += baseRadius / n * Math.cos(n * phase); y += baseRadius / n * Math.sin(n * phase);
      near(arms[i].x2, x); near(arms[i].y2, y);
    }
    const wave = calls.paths.find(path => path.points.length === 193 && path.color === '#ffe');
    assert.ok(wave, 'a connected sample path must accompany the epicycles');
    near(wave.points[0].y, y);
    near(calls.dots[5].y, y);
    for (const [i, p] of wave.points.entries()) {
      const samplePhase = phase - i / 192 * 2 * Math.PI * 1.35;
      const expected = (height - 22) / 2 + baseRadius * (Math.sin(samplePhase) + Math.sin(samplePhase * 3) / 3
        + Math.sin(samplePhase * 5) / 5 + Math.sin(samplePhase * 7) / 7);
      near(p.y, expected);
      if (i) assert.ok(p.x > wave.points[i - 1].x);
    }
  }
});

test('Lorenz has a continuous two-lobe trace and a bounded fading trail at frozen time zero', () => {
  const { calls, width } = draw('attractor', { time: 0 });
  const trace = calls.paths[0].points;
  assert.equal(trace.length, 2048);
  assert.ok(trace.filter(p => p.x < width / 2 - 20).length > 200);
  assert.ok(trace.filter(p => p.x > width / 2 + 20).length > 200);
  let crossings = 0;
  for (let i = 1; i < trace.length; i++) {
    assert.ok(Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y) < 40,
      'successive integration samples must not teleport across the attractor');
    if ((trace[i].x - width / 2) * (trace[i - 1].x - width / 2) < 0) crossings++;
  }
  assert.ok(crossings >= 8, 'the integrated trajectory must move between the two lobes');
  assert.equal(calls.glyphs.length, 0, 'settled curves replace the source-character scaffold');
  assert.equal(calls.dots.length, 2);
  assert.ok(calls.dots[1].alpha > .9);
  const depth = calls.paths.slice(1, 129);
  assert.ok(Math.max(...depth.map(path => path.alpha)) - Math.min(...depth.map(path => path.alpha)) > .15);
  const trails = calls.paths.slice(129, 141);
  assert.equal(trails.length, 12);
  for (let i = 1; i < trails.length; i++) assert.ok(trails[i].alpha > trails[i - 1].alpha);
});

test('Lorenz integrates once, reuses its trace, and never draws a line across the replay boundary', () => {
  const instance = runtime();
  draw('attractor', { time: 0 }, instance);
  const initialWork = instance.realm.mapCount;
  draw('attractor', { time: 0 }, instance);
  const redrawWork = instance.realm.mapCount - initialWork;
  assert.ok(initialWork > 1000, 'the first view should construct the RK4 integration');
  assert.ok(redrawWork < initialWork / 100, 'later frames only project the cached trace');
  const seamTime = (2048 - 900) * 21;
  const seam = draw('attractor', { time: seamTime }, instance);
  assert.equal(seam.calls.dots[0].alpha, 0);
  assert.ok(seam.calls.paths.slice(129, 141).every(path => path.points.length <= 1),
    'the new head starts a new tail instead of bridging the recording endpoints');
});

test('Phyllotaxis uses the golden angle and uniform area growth after unfurling', () => {
  const time = 3000;
  const { calls, width, height } = draw('phyllotaxis', { time, width: 278 });
  const seeds = calls.seeds, count = seeds.length;
  assert.equal(count, 233);
  const center = { x: width / 2, y: (57 + height - 43) / 2 };
  const radius = Math.min(width * .405, (height - 106) / 2);
  const goldenAngle = 2 * Math.PI / (((1 + Math.sqrt(5)) / 2) ** 2);
  for (let n = 0; n < count; n++) {
    const x = seeds[n].x - center.x, y = seeds[n].y - center.y;
    const r = radius * Math.sqrt((n + .5) / count);
    near(Math.hypot(x, y), r);
    near(x, Math.cos(n * goldenAngle + time / 32000) * r);
    near(y, Math.sin(n * goldenAngle + time / 32000) * r);
  }
  const frozen = draw('phyllotaxis', { time: 0, width: 278 }).calls.seeds;
  assert.ok(frozen.filter(seed => seed.alpha > .3).length > count / 3,
    'reduced motion must retain a meaningful seed pattern before animation starts');
});

test('phyllotaxis spiral families connect actual seeds at strides 13 and 21', () => {
  for (const width of [278, 348]) {
    const { calls } = draw('phyllotaxis', { time: 3000, width });
    let family = 0;
    for (const stride of [13, 21]) for (let start = 0; start < stride; start++) {
      const arm = calls.paths[family++].points;
      arm.forEach((point, index) => {
        near(point.x, calls.seeds[start + index * stride].x);
        near(point.y, calls.seeds[start + index * stride].y);
      });
    }
    assert.equal(calls.seeds.length, width < 300 ? 233 : 377);
    assert.ok(calls.seeds.every(seed => seed.rx > seed.ry && seed.ry > 0));
  }
});

test('each effect follows the supplied clock and pointer without history-dependent rendering', () => {
  for (const kind of shared.effects.kinds) {
    const original = draw(kind, { time: 0 }).calls;
    const moving = draw(kind, { time: 7800 }).calls;
    const pointed = draw(kind, { time: 0, pointerX: 1, pointerY: -.8 }).calls;
    assert.notDeepEqual(original, moving, `${kind} should animate`);
    assert.notDeepEqual(original, pointed, `${kind} should respond to the pointer`);
    assert.deepEqual(original, draw(kind, { time: 0 }).calls, `${kind} should rewind exactly when paused`);
    assert.equal(original.restores, 1);
  }
});

test('effects remain finite and inside their body at mobile widths, pointer extremes, and replay boundaries', () => {
  for (const kind of shared.effects.kinds) for (const width of [278, 348, 800]) for (const height of [260, 350]) {
    for (const time of [0, 900, 4300, 21812, 900000]) for (const pointer of [-1, 0, 1]) {
      const rendered = draw(kind, { width, height, time, pointerX: pointer, pointerY: pointer });
      const { calls, width: w, height: h } = rendered;
      const coordinates = [...calls.glyphs, ...calls.dots, ...calls.seeds, ...calls.fills.flatMap(path => path.points), ...calls.paths.flatMap(path => path.points),
        ...calls.segments.flatMap(segment => [{ x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }])];
      for (const p of coordinates) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.x >= 0 && p.x <= w && p.y >= 24 && p.y <= h - 23,
          `${kind} (${p.x}, ${p.y}) must fit the ${w}×${h} body`);
      }
      for (const label of calls.text) {
        assert.ok(label.size >= 10, 'instrument labels stay readable on mobile');
        assert.ok(label.x >= 0 && label.x + label.value.length * label.size * .6 <= w,
          `${kind} label should fit: ${label.value}`);
        assert.ok(label.y >= label.size / 2 && label.y + label.size / 2 <= h);
      }
    }
  }
});

const entranceSource = await readFile(new URL('../assets/entrance-effects.js', import.meta.url), 'utf8');
test('real shared helpers carry source characters into the instruments and return them on exit', () => {
  const realm = vm.createContext({ window: {} });
  vm.runInContext(entranceSource, realm); vm.runInContext(source, realm);
  const paint = (kind, amount) => {
    const marks = [], stack = []; let tx = 0, ty = 0, sx = 1, sy = 1;
    const context = {
      save() { stack.push([tx, ty, sx, sy]); }, restore() { [tx, ty, sx, sy] = stack.pop(); },
      translate(x, y) { tx += x * sx; ty += y * sy; }, scale(x, y) { sx *= x; sy *= y; },
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, ellipse() {},
      fillText(value, x, y) { marks.push({ value, x: tx + x * sx, y: ty + y * sy, alpha: this.globalAlpha }); },
    };
    realm.window.PortfolioEntranceEffects.draw(kind, { context, width: 348, height: 350, amount, time: 3000,
      glyphs: [{ glyph: 'Ω', x: 30, y: 90, size: 12 }] });
    assert.equal(stack.length, 0);
    return marks;
  };
  for (const kind of shared.effects.kinds) {
    const sourceMarks = paint(kind, 0), forming = paint(kind, .4), settled = paint(kind, 1), returned = paint(kind, 0);
    assert.ok(sourceMarks.length > 20);
    assert.ok(sourceMarks.every(mark => mark.value === 'Ω' && Math.abs(mark.x - 30) < 1e-8 && Math.abs(mark.y - 90) < 1e-8));
    assert.ok(forming.some(mark => mark.value === 'Ω' && mark.alpha > 0));
    assert.ok(settled.every(mark => mark.value !== 'Ω'));
    assert.deepEqual(returned, sourceMarks);
  }
});

test('all drawn marks inherit the theme palette and fade with the host morph amount', () => {
  const colors = ['#abc', '#def', '#123', '#456'];
  for (const kind of shared.effects.kinds) for (const amount of [0, .03, .3, .7, 1]) {
    const { calls } = draw(kind, { amount, ink: colors[0], accent: colors[1], muted: colors[2], highlight: colors[3] });
    for (const mark of [...calls.glyphs, ...calls.text, ...calls.paths, ...calls.dots, ...calls.segments, ...calls.seeds, ...calls.fills]) {
      assert.ok(colors.includes(mark.color));
      assert.ok(mark.alpha >= 0 && mark.alpha <= amount, `${kind} must fade every mark with amount`);
    }
  }
});
