import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const engineSource = await readFile(new URL("../assets/brick-breaker.js", import.meta.url), "utf8");
const source = await readFile(new URL("../assets/training-chamber.js", import.meta.url), "utf8");

function chamber() {
  class Element {
    constructor() { this.listeners = new Map(); this.dataset = {}; this.textContent = ""; this.attributes = new Map(); }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    dispatch(type, values = {}) { for (const callback of this.listeners.get(type) || []) callback({ target: this, ...values }); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    focus() {}
  }
  const root = new Element(), dialog = new Element(), canvas = new Element();
  const action = new Element(), pause = new Element(), status = new Element();
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatch("close"); };
  dialog.querySelectorAll = () => [];
  let renders = 0;
  const drawnImages = [], drawnText = [];
  const context = new Proxy({
    clearRect() { renders++; },
    drawImage(image) { drawnImages.push(image); },
    fillText(text) { drawnText.push(text); },
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, name) => target[name] ?? (() => {}) });
  canvas.getContext = () => context;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 480 });
  const nodes = new Map([
    ["training-dialog", dialog], ["training-canvas", canvas], ["training-action", action],
    ["training-pause", pause], ["training-status", status],
    ["training-score", new Element()], ["training-lives", new Element()],
  ]);
  const document = Object.assign(new Element(), {
    documentElement: root, activeElement: action, hidden: false,
    getElementById: id => nodes.get(id), querySelectorAll: () => [],
  });
  const window = Object.assign(new Element(), {
    matchMedia: () => Object.assign(new Element(), { matches: false }),
    dispatchEvent() {}, devicePixelRatio: 1,
  });
  const images = [], requests = [], frames = new Map();
  let nextFrame = 0, state;
  class Image {
    constructor() { this.complete = false; this.naturalWidth = 0; images.push(this); }
    set src(value) { this.url = value; requests.push(value); }
    load() { this.complete = true; this.naturalWidth = 1254; this.onload(); }
  }
  vm.runInNewContext(engineSource, { window });
  const engine = window.PortfolioBreakerEngine;
  window.PortfolioBreakerEngine = { ...engine, create() { state = engine.create(); return state; } };
  vm.runInNewContext(source, {
    document, window, Image, Element, HTMLElement: Element,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    ResizeObserver: class { observe() {} },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return {
    api: window.PortfolioTraining, action, pause, status, window, document, dialog, images, requests, frames, drawnImages, drawnText,
    get state() { return state; }, get renders() { return renders; },
  };
}

test("training sprites wait for entry, then load only once across reopening", () => {
  const controls = chamber();
  assert.equal(controls.requests.length, 0, "a visitor who never opens the game does not request its sprites");
  assert.equal(controls.images.length, 0);
  controls.api.open();
  assert.deepEqual(controls.requests, Array.from({ length: 7 }, (_, index) => `/assets/dragon-ball-${index + 1}.webp`));
  assert.ok(controls.images.every(image => image.decoding === "async"));
  controls.api.close();
  controls.api.open();
  assert.equal(controls.requests.length, 7, "reopening reuses the first set of sprites");
});

test("the game starts with fallback balls while sprites load, and late loads respect closure", () => {
  const controls = chamber();
  controls.api.open();
  assert.ok(controls.renders > 0, "the ready board appears before image loading completes");
  assert.equal(controls.drawnImages.length, 0);
  controls.action.dispatch("click");
  assert.equal(controls.state.phase, "playing", "sprite loading does not block launching the ball");
  assert.equal(controls.frames.size, 1);
  controls.images[0].load();
  assert.ok(controls.drawnImages.includes(controls.images[0]), "a loaded sprite replaces its fallback");
  controls.api.close();
  const before = controls.renders;
  controls.images[1].load();
  assert.equal(controls.renders, before, "a late load must not redraw a closed game");
  assert.equal(controls.frames.size, 0);
});

test("completed training results survive blur and hidden-tab changes", () => {
  for (const phase of ["won", "lost"]) {
    const controls = chamber();
    controls.api.open();
    controls.state.phase = phase;
    // A sprite redraw exercises the actual completion overlay before blur.
    controls.images[0].load();
    const title = phase === "won" ? "wish granted" : "another round?";
    assert.equal(controls.drawnText.at(-2), title);
    controls.window.dispatch("blur");
    controls.document.hidden = true;
    controls.document.dispatch("visibilitychange");
    controls.images[1].load();
    assert.equal(controls.drawnText.at(-2), title, 'completion must not become a paused overlay');
    assert.notEqual(controls.status.textContent, "training paused");
    assert.equal(controls.frames.size, 0);
  }
});
