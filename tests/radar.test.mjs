import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source = await readFile(new URL('../assets/workspace.js', import.meta.url), 'utf8');

const routes = ['glassbox', 'pixel-language', 'architecture-lab', 'automata-lab', 'ellmiott', 'batchline', 'evaldeck'];

function radar({saved = null, denied = false, hash = '', paused = false, reduced = false, width = 400, height = 220} = {}) {
  const surface = () => {
    const handlers = new Map();
    return {
      addEventListener(type, handler) { handlers.set(type, [...(handlers.get(type) || []), handler]); },
      emit(type, values = {}) {
        const event = {target: this, preventDefault() { this.defaultPrevented = true; },
          stopPropagation() { this.stopped = true; }, ...values};
        for (const handler of handlers.get(type) || []) handler(event);
        return event;
      },
    };
  };
  const element = () => {
    const attributes = new Map();
    return {...surface(), dataset: {}, style: {}, textContent: '', hidden: false,
      getAttribute: key => attributes.get(key) || null,
      setAttribute: (key, value) => attributes.set(key, value)};
  };
  const root = {dataset: {view: 'workspace', motion: paused ? 'paused' : 'running'}};
  if (reduced) delete root.dataset.motion;
  const frames = new Map();
  let id = 0, geometry = [], drawings = 0;
  const context = new Proxy({
    clearRect() { geometry = []; drawings++; },
    arc(...args) { geometry.push(['arc', ...args, {alpha: context.globalAlpha}]); },
    lineTo(...args) { geometry.push(['line', ...args]); },
    fillRect(...args) { geometry.push(['particle', ...args]); },
    drawImage(image, ...args) { geometry.push(['image', ...args]); },
  }, {get: (target, key) => target[key] ?? (() => {})});
  const signals = routes.map(route => {
    const signal = element();
    signal.dataset.radarRoute = route;
    signal.setAttribute('aria-label', `open ${route}`);
    return signal;
  });
  const button = element(), feedback = element();
  const plot = {...element(), querySelectorAll: () => signals};
  const canvas = {getContext: () => context, closest: () => plot,
    getBoundingClientRect: () => ({width, height})};
  const about = {hidden: false};
  const workspace = {...surface(), querySelector: () => null};
  const document = {...surface(), documentElement: root, hidden: false,
    getElementById: id => id === 'workspace' ? workspace : id === 'profile-plot' ? canvas : null,
    querySelector: selector => selector === '[data-panel="about"]' ? about
      : selector === '[data-radar-summon]' ? button
        : selector === '[data-radar-feedback]' ? feedback
          : (selector === '#training-dialog[open]' && document.training)
            || (selector === 'dialog[open]' && (document.openDialog || document.training)) ? {} : null,
    createElement: () => ({getContext: () => ({drawImage() {}, fillRect() {},
      getImageData(x, y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        // Model the published art's transparent border, rather than a fully
        // opaque square that would extend beyond its normalized content box.
        const padding = Math.ceil(w * .1);
        for (let py = padding; py < h - padding; py++) for (let px = padding; px < w - padding; px++) {
          const at = (py * w + px) * 4;
          data[at + 1] = 190; data[at + 3] = 255;
        }
        return {data};
      }})})};
  const motion = {...surface(), matches: reduced};
  const stored = {value: saved}, requests = [], images = [];
  class Image {
    constructor() { images.push(this); this.complete = false; this.naturalWidth = 0; }
    set src(value) { requests.push(value); }
    load() { this.complete = true; this.naturalWidth = 512; this.onload(); }
    fail() { this.onerror(); }
  }
  const window = {...surface(), matchMedia: () => motion, devicePixelRatio: 1, location: {hash},
    sessionStorage: {
      getItem() { if (denied) throw new Error('denied'); return stored.value; },
      setItem(key, value) { if (denied) throw new Error('denied'); assert.equal(key, 'elliott:radar-signals:v1'); stored.value = value; },
    }};
  vm.runInNewContext(source, {document, window, Image,
    getComputedStyle: () => ({getPropertyValue: () => ''}),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id)});
  return {root, window, document, motion, frames, plot, signals, button, feedback, requests, images, stored, about,
    api: window.PortfolioRadar,
    get drawings() { return drawings; },
    drawing: () => JSON.stringify(geometry),
    visit(panel) { about.hidden = panel !== 'about'; window.emit('portfolio:view', {detail: {view: panel ? 'workspace' : 'entrance', panel}}); },
    frame(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); }};
}

test('radar freezes its actual sweep and pulses, then resumes without counting paused time', () => {
  const page = radar();
  page.frame(100); page.frame(150); page.frame(200);
  const frozen = page.drawing();
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  assert.equal(page.drawing(), frozen);
  assert.equal(page.frames.size, 0);
  page.window.emit('resize');
  assert.equal(page.drawing(), frozen, 'redrawing while paused preserves the phase');
  page.root.dataset.motion = 'running'; page.window.emit('portfolio:preferences');
  page.frame(10000);
  assert.equal(page.drawing(), frozen, 'first resumed frame does not jump over paused time');
  page.frame(10050);
  assert.notEqual(page.drawing(), frozen);
  const second = page.drawing();
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  assert.equal(page.drawing(), second, 'a later pause freezes a different position');
});

test('hidden tabs and reduced motion retain the radar phase', () => {
  const page = radar();
  page.frame(100); page.frame(160);
  const frozen = page.drawing();
  page.document.hidden = true; page.document.emit('visibilitychange');
  assert.equal(page.frames.size, 0);
  page.document.hidden = false; page.document.emit('visibilitychange');
  page.frame(5000);
  assert.equal(page.drawing(), frozen);
  delete page.root.dataset.motion;
  page.motion.matches = true; page.motion.emit('change');
  assert.equal(page.drawing(), frozen);
  assert.equal(page.frames.size, 0);
});

test('radar resizing and preference changes preserve a single tap response', () => {
  const page = radar();
  for (let index = 0; index < 10; index++) {
    page.window.emit('resize');
    page.window.emit('portfolio:preferences');
  }
  const before = page.drawings;
  page.plot.emit('click', {target: {closest: () => null}});
  assert.equal(page.drawings, before + 1, 'one tap must redraw once after repeated resizing');
});

test('only seven distinct valid projects unlock the radar, without automatically summoning', () => {
  const page = radar({hash: '#glassbox'});
  assert.equal(page.signals[0].dataset.discovered, 'true');
  assert.equal(page.button.hidden, true);
  assert.equal(page.api.summon(), false);
  for (const route of ['about', 'connect', 'constructor', ...routes.slice(0, -1), 'glassbox']) page.visit(route);
  assert.equal(page.api.unlocked, false, 'repeated projects and unrelated routes cannot fill the collection');
  page.visit(routes.at(-1));
  assert.equal(page.api.unlocked, true);
  assert.equal(page.button.hidden, false);
  assert.equal(page.button.textContent, 'summon');
  assert.equal(page.plot.dataset.summoned, 'false');
  assert.equal(page.requests.length, 0, 'unlocking never requests or launches the dragon');
  assert.ok(page.signals.every(signal => signal.dataset.discovered === 'true' && signal.getAttribute('aria-label').endsWith('; explored')));
  assert.deepEqual(JSON.parse(page.stored.value), routes);
  const announcement = page.feedback.textContent;
  page.visit('about'); page.visit('glassbox');
  assert.equal(page.feedback.textContent, announcement);
});

test('saved exploration is filtered and storage denial retains collection in memory', () => {
  for (const saved of [JSON.stringify([...routes.slice(0, 6), 'about', 'unknown', 'glassbox']), 'invalid json', JSON.stringify({projects: routes})]) {
    const page = radar({saved});
    assert.equal(page.api.unlocked, false);
    assert.equal(page.requests.length, 0);
  }
  const remembered = radar({saved: JSON.stringify(routes)});
  assert.equal(remembered.api.unlocked, true);
  assert.equal(remembered.plot.dataset.summoned, 'false');
  const denied = radar({denied: true});
  routes.forEach(route => denied.visit(route));
  assert.equal(denied.api.unlocked, true);
  denied.visit('about');
  assert.equal(denied.api.summon(), true);
});

test('summoning loads art once, supports explicit return and replay, and cancels when leaving about', () => {
  const page = radar({saved: JSON.stringify(routes)});
  assert.equal(page.api.summon(), true);
  assert.deepEqual(page.requests, ['/assets/shenron.webp']);
  assert.equal(page.plot.dataset.summoned, 'true');
  assert.equal(page.button.textContent, 'return');
  const escape = page.document.emit('keydown', {key: 'Escape', target: page.button});
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.stopped, true, 'Escape must not reach the global return-home shortcut');
  assert.equal(page.plot.dataset.summoned, 'false');
  page.button.emit('click');
  assert.equal(page.plot.dataset.summoned, 'true');
  assert.equal(page.requests.length, 1);
  page.visit('glassbox');
  assert.equal(page.plot.dataset.summoned, 'false');
  assert.equal(page.api.summon(), false, 'hidden radar cannot start a reveal');
  const before = page.drawings;
  page.images[0].load();
  assert.equal(page.drawings, before, 'late images never redraw an inactive project');
  page.visit('about');
  assert.equal(page.plot.dataset.summoned, 'false', 'returning does not replay automatically');
});

test('summon formation pauses continuously through hidden tabs and training, including late artwork', () => {
  const page = radar({saved: JSON.stringify(routes)});
  page.api.summon();
  page.frame(100); page.frame(160); page.frame(220);
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  const frozen = page.drawing();
  page.images[0].load();
  assert.equal(page.drawing(), frozen, 'art arriving while paused must not replace the frozen constellation');
  page.window.emit('resize');
  assert.equal(page.drawing(), frozen);
  assert.equal(page.frames.size, 0);
  page.root.dataset.motion = 'running'; page.window.emit('portfolio:preferences');
  const resumed = page.drawing();
  page.frame(10000);
  assert.equal(page.drawing(), resumed, 'the first resumed frame excludes paused time');
  page.document.hidden = true; page.document.emit('visibilitychange');
  assert.equal(page.frames.size, 0);
  page.document.hidden = false; page.document.emit('visibilitychange');
  page.document.training = true; page.root.dataset.training = 'open'; page.window.emit('portfolio:training');
  assert.equal(page.frames.size, 0);
  page.document.training = false; delete page.root.dataset.training; page.window.emit('portfolio:training');
  assert.equal(page.frames.size, 1);
  assert.equal(page.plot.dataset.summoned, 'true');
});

test('quiet summons complete immediately with a deterministic fallback and retain live project links', () => {
  for (const options of [{paused: true}, {reduced: true}]) {
    const page = radar({...options, saved: JSON.stringify(routes), width: 232, height: 153});
    page.button.emit('click');
    assert.equal(page.plot.dataset.summoned, 'true');
    assert.equal(page.frames.size, 0);
    const fallback = page.drawing();
    assert.match(fallback, /particle/);
    page.images[0].fail();
    assert.equal(page.drawing(), fallback);
    page.button.emit('click'); page.button.emit('click');
    assert.equal(page.drawing(), fallback, 'the fallback replays deterministically without motion');
    assert.equal(page.requests.length, 1);
    assert.ok(page.signals.every(signal => !signal.hidden && !signal.getAttribute('aria-hidden')));
  }
});

test('loaded dragon artwork forms a bounded silhouette on a small radar without restarting quiet motion', () => {
  const page = radar({paused: true, saved: JSON.stringify(routes), width: 232, height: 153});
  page.api.summon();
  page.images[0].load();
  const geometry = JSON.parse(page.drawing());
  const particles = geometry.filter(entry => entry[0] === 'particle');
  assert.equal(particles.length, 960, 'sampling caps the rendered particle count');
  for (const [, x, y, w, h] of particles) {
    assert.ok(x >= 0 && y >= 0 && x + w <= 232 && y + h <= 153);
  }
  assert.ok(geometry.some(entry => entry[0] === 'image'), 'a faint tinted mask preserves the dragon outline');
  const top = Math.min(...particles.map(entry => entry[2]));
  const bottom = Math.max(...particles.map(entry => entry[2] + entry[4]));
  assert.ok(bottom - top > 130, 'transparent padding must not shrink the visible dragon to eighty percent of its display area');
  assert.ok(geometry.filter(entry => entry[0] === 'arc').every(entry => entry.at(-1).alpha < .04), 'the old radar field recedes behind the centered dragon');
  assert.equal(page.frames.size, 0);
  page.button.emit('click'); page.button.emit('click');
  assert.equal(page.requests.length, 1);
  assert.equal(page.drawing(), JSON.stringify(geometry), 'cached art can be explicitly replayed');
});

test('the radar field fades continuously during a summon and returns at normal strength', () => {
  const page = radar({saved: JSON.stringify(routes)});
  const strength = () => JSON.parse(page.drawing()).find(entry => entry[0] === 'arc').at(-1).alpha;
  const normal = strength();
  page.api.summon();
  assert.equal(strength(), normal, 'the field begins at its current opacity');
  page.frame(100); page.frame(180); page.frame(260); page.frame(340); page.frame(420);
  assert.ok(strength() > 0 && strength() < normal);
  const partial = strength();
  page.root.dataset.motion = 'paused'; page.window.emit('portfolio:preferences');
  assert.equal(strength(), partial, 'pause freezes the fading field without finishing the reveal');
  page.button.emit('click');
  assert.equal(strength(), normal);
});

test('Escape returns a summoned dragon to signals from any focused project link', () => {
  const page = radar({saved: JSON.stringify(routes)});
  page.api.summon();
  page.document.activeElement = page.signals[2];
  const escape = page.document.emit('keydown', {key: 'Escape', target: page.signals[2]});
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.stopped, true);
  assert.equal(page.plot.dataset.summoned, 'false');
  assert.equal(page.root.dataset.view, 'workspace');
  assert.equal(page.document.activeElement, page.signals[2], 'returning keeps keyboard focus where it was');
  const ordinary = page.document.emit('keydown', {key: 'Escape', target: page.signals[2]});
  assert.equal(ordinary.defaultPrevented, undefined, 'a second Escape remains available to ordinary navigation');
});

test('dragon Escape handling respects other dialogs and modified or composed input', () => {
  const page = radar({saved: JSON.stringify(routes)});
  page.api.summon();
  for (const values of [{isComposing: true}, {ctrlKey: true}, {metaKey: true}, {altKey: true}, {shiftKey: true}, {defaultPrevented: true}]) {
    const event = page.document.emit('keydown', {key: 'Escape', ...values});
    assert.equal(event.stopped, undefined);
    assert.equal(page.plot.dataset.summoned, 'true');
  }
  page.document.openDialog = true;
  const dialogEscape = page.document.emit('keydown', {key: 'Escape'});
  assert.equal(dialogEscape.defaultPrevented, undefined);
  assert.equal(page.plot.dataset.summoned, 'true');
  page.document.openDialog = false;
  page.document.emit('keydown', {key: 'Escape'});
  assert.equal(page.plot.dataset.summoned, 'false');
});


test('the shared game lifecycle pauses radar even before a lazy game dialog exists', () => {
  const page = radar();
  assert.equal(page.frames.size, 1);
  page.root.dataset.training = 'open'; page.window.emit('portfolio:training');
  assert.equal(page.frames.size, 0);
  delete page.root.dataset.training; page.window.emit('portfolio:training');
  assert.equal(page.frames.size, 1);
});
