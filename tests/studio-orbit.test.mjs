import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/studio-orbit.js', import.meta.url), 'utf8');
function harness({ reduced = false } = {}) {
  class Element {
    constructor() { this.listeners = {}; this.dataset = {}; this.style = {}; this.attributes = new Map(); this.hidden = false; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    fire(name, extra = {}) {
      const event = { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 100, clientY: 100,
        cancelable: true, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
      this.listeners[name]?.forEach(callback => callback(event));
      return event;
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    hasAttribute(name) { return this.attributes.has(name); }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture(id) { this.capture = null; this.fire('lostpointercapture', { pointerId: id }); }
    focus() { this.focused = true; }
  }
  const root = new Element(), stage = new Element(), controls = new Element(), pause = new Element(), reset = new Element(), status = new Element();
  const cards = [-9, 8, -4, 12, -8].map(angle => { const card = new Element(); card.dataset.angle = String(angle); return card; });
  const nodes = { '[data-orbit-stage]': stage, '[data-orbit-controls]': controls, '[data-orbit-pause]': pause,
    '[data-orbit-reset]': reset, '[data-orbit-status]': status };
  root.querySelector = selector => nodes[selector];
  root.querySelectorAll = () => cards;
  stage.clientWidth = 500; stage.clientHeight = 400;
  const document = new Element(); document.querySelector = () => root; document.hidden = false;
  const window = new Element(), preference = new Element(); preference.matches = reduced;
  const frames = new Map(); let nextId = 1, time = 0, intersection;
  window.matchMedia = () => preference;
  window.requestAnimationFrame = callback => { const id = nextId++; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.IntersectionObserver = class { constructor(callback) { intersection = callback; } observe() {} };
  vm.runInNewContext(source, { window, document });
  return { root, stage, controls, pause, reset, status, cards, window, document, frames, preference,
    inView(value) { intersection([{ isIntersecting: value }]); },
    step(milliseconds = 16) {
      time += milliseconds;
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time));
    },
    transform: () => cards.map(card => card.style.transform),
  };
}

test('reduced motion starts still but exposes working keyboard and reset controls', () => {
  const h = harness({ reduced: true }), initial = h.transform();
  assert.equal(h.controls.hidden, false);
  assert.equal(h.stage.tabIndex, 0);
  assert.equal(h.root.dataset.orbitPaused, 'true');
  assert.equal(h.pause.attributes.get('aria-pressed'), 'true');
  assert.equal(h.frames.size, 0);
  h.stage.fire('keydown', { key: 'ArrowRight' });
  assert.notDeepEqual(h.transform(), initial);
  h.step(); assert.equal(h.frames.size, 0);
  h.stage.fire('keydown', { key: 'r' });
  assert.deepEqual(h.transform(), initial);
  assert.equal(h.stage.fire('keydown', { key: 'Tab' }).prevented, false, 'Tab remains native');
});

test('pause freezes the exact frame, resume preserves it and reset preserves pause preference', () => {
  const h = harness(); h.step(); h.step(32); h.step(32);
  h.pause.fire('click'); const still = h.transform();
  assert.equal(h.frames.size, 0); h.step(5000); assert.deepEqual(h.transform(), still);
  h.pause.fire('click'); assert.equal(h.frames.size, 1); h.step(5000);
  assert.deepEqual(h.transform(), still, 'first resumed frame has no elapsed-time jump');
  h.step(16); assert.notDeepEqual(h.transform(), still);
  h.stage.fire('keydown', { key: ' ' }); h.reset.fire('click');
  assert.equal(h.root.dataset.orbitPaused, 'true');
  assert.equal(h.frames.size, 0);
  assert.ok(h.transform().every(value => value.startsWith('translate3d(0.000px, 0.000px, 0)')));
  assert.equal(h.stage.fire('keydown', { key: ' ', repeat: true }).prevented, true);
  assert.equal(h.root.dataset.orbitPaused, 'true', 'holding Space does not alternate pause state');
});

test('native vertical touch scrolling wins, horizontal drag is bounded and cancellation releases capture', () => {
  const h = harness({ reduced: true }), initial = h.transform();
  h.stage.fire('pointerdown', { pointerType: 'touch' });
  assert.equal(h.stage.capture, undefined);
  const vertical = h.stage.fire('pointermove', { pointerType: 'touch', clientX: 101, clientY: 130 });
  assert.equal(vertical.prevented, false); assert.deepEqual(h.transform(), initial);
  h.stage.fire('pointerdown', { pointerType: 'touch' });
  h.stage.fire('pointermove', { pointerType: 'touch', clientX: 10000, clientY: 110 });
  assert.equal(h.stage.capture, 1); assert.equal(h.root.dataset.orbitDragging, 'true');
  const translated = Number(h.cards[0].style.transform.match(/translate3d\(([-\d.]+)/)[1]);
  assert.ok(translated > 0 && translated < 50, 'huge drags stay inside the bounded surface');
  const beforeCancel = h.transform();
  h.window.fire('pointercancel');
  assert.equal(h.stage.capture, null); assert.equal(h.root.dataset.orbitDragging, undefined);
  h.stage.fire('pointermove', { clientX: 0, clientY: 0 });
  assert.deepEqual(h.transform(), beforeCancel, 'cancelled input cannot keep moving cards');
});

test('hidden, offscreen and blurred compositions stop animation and clear dragging', () => {
  const h = harness();
  h.stage.fire('pointerdown'); h.stage.fire('pointermove', { clientX: 160 });
  h.document.hidden = true; h.document.fire('visibilitychange');
  assert.equal(h.frames.size, 0); assert.equal(h.stage.capture, null);
  h.document.hidden = false; h.document.fire('visibilitychange'); assert.equal(h.frames.size, 1);
  h.inView(false); assert.equal(h.frames.size, 0);
  h.inView(true); assert.equal(h.frames.size, 1);
  h.window.fire('blur'); assert.equal(h.frames.size, 0);
  h.window.fire('focus'); assert.equal(h.frames.size, 1);
  h.preference.fire('change', { matches: true });
  assert.equal(h.frames.size, 0); assert.equal(h.root.dataset.orbitPaused, 'true');
  h.pause.fire('click'); assert.equal(h.frames.size, 1, 'explicit resume remains available');
});

test('long frame gaps are bounded and motion is approximately frame-rate independent', () => {
  const slow = harness(), fast = harness(); slow.step(0); fast.step(0);
  for (let i = 0; i < 60; i++) slow.step(1000 / 60);
  for (let i = 0; i < 120; i++) fast.step(1000 / 120);
  assert.deepEqual(slow.transform(), fast.transform());
  const delayed = harness(); delayed.step(0); delayed.step(100000);
  const x = Number(delayed.cards[0].style.transform.match(/translate3d\(([-\d.]+)/)[1]);
  assert.ok(Math.abs(x) < 0.1, 'background time cannot become a large movement');
});
