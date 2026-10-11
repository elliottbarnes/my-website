import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { PUBLIC_FILES } from "../scripts/public-files.mjs";

const source = await readFile(new URL("../assets/animation.js", import.meta.url), "utf8");

// Exercise the shipped animation controller and its clock without a browser
// dependency. These checks cover lifecycle and response time; visual quality
// and actual frame cost still need a real browser.
function animation({ reduced = false, paused = false, hidden = false, view = "entrance" } = {}) {
  let now = 100, nextId = 1;
  const frames = new Map(), timers = new Map(), images = [];
  function surface() {
    const listeners = new Map();
    return {
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatch(type, values = {}) {
        for (const listener of listeners.get(type) || []) listener({ timeStamp: now, ...values });
      },
    };
  }
  function style() {
    const values = {};
    Object.defineProperty(values, "cssText", {
      get: () => Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("; "),
      set(text) {
        for (const key of Object.keys(values)) delete values[key];
        for (const declaration of text.split(";")) {
          const separator = declaration.indexOf(":");
          if (separator >= 0) values[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim();
        }
      },
    });
    return values;
  }
  function node() {
    const classes = new Set();
    return Object.assign(surface(), {
      dataset: {}, style: style(), textContent: "", hidden: false,
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      setAttribute() {}, append(child) { child.parentElement = this; },
    });
  }
  function canvas() {
    const element = node();
    const calls = { clears: 0, images: [] };
    const context = new Proxy({
      clearRect() { calls.clears += 1; },
      measureText: () => ({ width: 7.2 }),
      drawImage(...arguments_) { calls.images.push(arguments_); },
      getImageData: () => ({ data: new Uint8ClampedArray(120 * 120 * 4) }),
    }, { get: (target, property) => target[property] ?? (() => {}) });
    return Object.assign(element, {
      calls, getContext: () => context,
      getBoundingClientRect: () => ({ left: 0, top: 0,
        width: element.style.position === "fixed" ? 1280 : 640,
        height: element.style.position === "fixed" ? 800 : 320 }),
    });
  }
  const root = node(), scene = node(), field = canvas(), readout = node();
  field.parentElement = node();
  root.dataset = { view, ...(paused ? { motion: "paused" } : {}) };
  const nodes = new Map([["#code-field", field], ["#scene", scene], ["[data-pointer-readout]", readout]]);
  for (const selector of ["#code-wall", "[data-scene-file]", "[data-scene-path]", "#typed-command", "#entrance .mode", "#entrance .status-position"]) nodes.set(selector, node());
  const document = Object.assign(surface(), {
    documentElement: root, hidden,
    querySelector: (selector) => nodes.get(selector) || null,
    createElement: (tag) => tag === "canvas" ? canvas() : node(),
  });
  const motion = Object.assign(surface(), { matches: reduced });
  const requestAnimationFrame = (callback) => { const id = nextId++; frames.set(id, callback); return id; };
  const cancelAnimationFrame = (id) => frames.delete(id);
  const performance = { now: () => now };
  const window = Object.assign(surface(), {
    matchMedia: () => motion, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    requestAnimationFrame, cancelAnimationFrame, performance,
  });
  class Image {
    constructor() { this.naturalWidth = 420; this.naturalHeight = 500; images.push(this); }
  }
  vm.runInNewContext(source, {
    document, window, Image, performance, requestAnimationFrame, cancelAnimationFrame,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    root, scene, field, readout, document, motion, window, frames, timers, images,
    api: window.PortfolioAnimation,
    frame(ms = 16) {
      now += ms;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.due <= now) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

test("the entrance portrait uses the published Memoji asset", () => {
  const controls = animation();
  assert.equal(controls.images.length, 1);
  assert.equal(controls.images[0].src, "/assets/memoji.png");
  assert.ok(PUBLIC_FILES.includes(controls.images[0].src.slice(1)), "the requested image must be in the deployment artifact");
  assert.doesNotThrow(() => controls.images[0].onload());
});

test("enter completes promptly even if animation frames stop, and restores the canvas", async () => {
  const controls = animation();
  const originalCanvasStyle = controls.field.style.cssText;
  const originalParentStyle = controls.field.parentElement.style.cssText;
  let completed = false;
  const entry = controls.api.enter().then(() => { completed = true; });
  controls.advance(550);
  await Promise.resolve();
  assert.equal(completed, true, "entry must not leave navigation waiting more than 550 ms");
  await entry;
  assert.equal(controls.root.classList.contains("is-leaving"), false);
  assert.equal(controls.field.style.cssText, originalCanvasStyle);
  assert.equal(controls.field.parentElement.style.cssText, originalParentStyle);
  assert.equal(controls.timers.size, 0);
});

test("the animated entry finishes within half a second and repeated requests share it", async () => {
  const controls = animation();
  const entry = controls.api.enter();
  assert.equal(controls.api.enter(), entry);
  let completed = false;
  entry.then(() => { completed = true; });
  // Drive animation frames without firing the fallback timeout.
  for (let frame = 0; frame < 30; frame += 1) controls.frame(1000 / 60);
  await Promise.resolve();
  assert.equal(completed, true, "the visual transition should finish within 500 ms");
  assert.equal(controls.timers.size, 0);
});

test("paused and reduced-motion entrance skips the transition entirely", async () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    const controls = animation(options);
    await controls.api.enter();
    assert.equal(controls.root.classList.contains("is-leaving"), false);
    assert.equal(controls.timers.size, 0);
    assert.equal(controls.frames.size, 0);
  }
});

test("hidden, workspace, and paused states stop frames and resume only when visible and running", () => {
  for (const state of ["hidden", "workspace", "paused"]) {
    const controls = animation();
    assert.equal(controls.frames.size, 1);
    const change = (disabled) => {
      if (state === "hidden") {
        controls.document.hidden = disabled;
        controls.document.dispatch("visibilitychange");
      } else if (state === "workspace") {
        controls.root.dataset.view = disabled ? "workspace" : "entrance";
        controls.window.dispatch("portfolio:view");
      } else {
        controls.root.dataset.motion = disabled ? "paused" : "running";
        controls.window.dispatch("portfolio:preferences");
      }
    };
    change(true);
    assert.equal(controls.frames.size, 0, state);
    const draws = controls.field.calls.clears;
    controls.frame();
    assert.equal(controls.field.calls.clears, draws, `${state} does not animate in the background`);
    change(false);
    assert.equal(controls.frames.size, 1, `${state} resumes with one scheduled frame`);
  }
});

test("pointer input is reflected on the next display frame", () => {
  const controls = animation();
  controls.frame();
  const draws = controls.field.calls.clears;
  controls.field.dispatch("pointermove", { clientX: 480, clientY: 80 });
  assert.match(controls.readout.textContent, /0\.750.*0\.250/);
  controls.frame(16);
  assert.ok(controls.field.calls.clears > draws, "pointer input must not wait for a second 60 Hz display frame");
  assert.equal(controls.frames.size, 1, "input does not duplicate the animation loop");
});

test("cancelling entry or hiding the document settles pending navigation once", async () => {
  for (const cancel of ["explicit", "hidden"]) {
    const controls = animation();
    let completions = 0;
    const entry = controls.api.enter().then(() => { completions += 1; });
    if (cancel === "explicit") controls.api.cancel();
    else { controls.document.hidden = true; controls.document.dispatch("visibilitychange"); }
    await entry;
    controls.api.cancel();
    controls.advance(1000);
    assert.equal(completions, 1, cancel);
    assert.equal(controls.root.classList.contains("is-leaving"), false);
    assert.equal(controls.timers.size, 0);
  }
});
