import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { PUBLIC_FILES } from "../scripts/public-files.mjs";

const effectsSource = await readFile(new URL("../assets/entrance-effects.js", import.meta.url), "utf8");
const source = await readFile(new URL("../assets/animation.js", import.meta.url), "utf8");

// Exercise the shipped animation controller and its clock without a browser
// dependency. These checks cover lifecycle and response time; visual quality
// and actual frame cost still need a real browser.
function animation({ reduced = false, paused = false, hidden = false, view = "entrance", density = 1, fieldWidth = 640 } = {}) {
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
        const event = { timeStamp: now, target: this, currentTarget: this,
          pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0,
          defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
        for (const listener of listeners.get(type) || []) listener(event);
        return event;
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
  function node(tagName = "div") {
    const classes = new Set();
    const attributes = new Map();
    return Object.assign(surface(), {
      tagName: tagName.toUpperCase(),
      dataset: {}, style: style(), textContent: "", hidden: false,
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      hasAttribute: (name) => attributes.has(name),
      getAttribute: (name) => attributes.get(name) ?? null,
      append(child) { child.parentElement = this; },
      contains(child) {
        for (let current = child; current; current = current.parentElement) if (current === this) return true;
        return false;
      },
      closest(selector) {
        const matches = selector.split(",").map(value => value.trim());
        for (let current = this; current; current = current.parentElement) {
          if (matches.some(value => {
            if (value.startsWith("#")) return current.id === value.slice(1);
            if (value === "[contenteditable]:not([contenteditable='false'])") return current.hasAttribute("contenteditable") && current.getAttribute("contenteditable") !== "false";
            const attribute = value.match(/^\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
            if (attribute) return attribute[2] === undefined ? current.hasAttribute(attribute[1]) : current.getAttribute(attribute[1]) === attribute[2];
            return value.toUpperCase() === current.tagName;
          })) return current;
        }
        return null;
      },
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
        width: element.style.position === "fixed" ? 1280 : fieldWidth,
        height: element.style.position === "fixed" ? 800 : 320 }),
    });
  }
  const root = node(), entrance = node("section"), scene = node(), field = canvas(), readout = node();
  entrance.id = "entrance";
  entrance.parentElement = root;
  scene.parentElement = entrance;
  field.parentElement = node();
  field.parentElement.parentElement = scene;
  root.dataset = { view, ...(paused ? { motion: "paused" } : {}) };
  const nodes = new Map([["#entrance", entrance], ["#code-field", field], ["#scene", scene], ["[data-pointer-readout]", readout]]);
  for (const selector of ["#code-wall", "[data-scene-file]", "[data-scene-path]", "#typed-command", "#entrance .mode", "#entrance .status-position"]) nodes.set(selector, node());
  const document = Object.assign(surface(), {
    documentElement: root, hidden,
    querySelector: (selector) => selector === "dialog[open]" ? (document.openDialog || null) : nodes.get(selector) || null,
    getElementById: (id) => nodes.get(`#${id}`) || null,
    createElement: (tag) => tag === "canvas" ? canvas() : node(),
  });
  const motion = Object.assign(surface(), { matches: reduced });
  const requestAnimationFrame = (callback) => { const id = nextId++; frames.set(id, callback); return id; };
  const cancelAnimationFrame = (id) => frames.delete(id);
  const performance = { now: () => now };
  const window = Object.assign(surface(), {
    matchMedia: () => motion, innerWidth: 1280, innerHeight: 800, devicePixelRatio: density,
    requestAnimationFrame, cancelAnimationFrame, performance,
  });
  class Image {
    constructor() { this.naturalWidth = 420; this.naturalHeight = 500; images.push(this); }
  }
  vm.runInNewContext(effectsSource, { window });
  vm.runInNewContext(source, {
    document, window, Image, performance, requestAnimationFrame, cancelAnimationFrame,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    root, entrance, scene, field, readout, document, motion, window, frames, timers, images, node,
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
  assert.equal(controls.images[0].src, "/assets/memoji-saiyan.png");
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
  controls.entrance.dispatch("pointermove", { clientX: 480, clientY: 80, target: controls.field });
  assert.match(controls.readout.textContent, /0\.750.*0\.250/);
  controls.frame(16);
  assert.ok(controls.field.calls.clears > draws, "pointer input must not wait for a second 60 Hz display frame");
  assert.equal(controls.frames.size, 1, "input does not duplicate the animation loop");
});

// Dispatch the browser's down/up sequence without advancing a display frame.
// A real touch can begin and end before requestAnimationFrame runs.
function tap(controls, values = {}) {
  const event = { pointerType: "touch", clientX: 80, clientY: 20, target: controls.field, ...values };
  const down = controls.entrance.dispatch("pointerdown", event);
  const up = controls.window.dispatch("pointerup", event);
  return { down, up };
}

function displayFor(controls, milliseconds) {
  for (let time = 0; time < milliseconds; time += 16) controls.frame(16);
}

test("a quick code-line tap reacts on the next frame and remains open after release", () => {
  for (const pointerType of ["touch", "pen"]) {
    const controls = animation();
    controls.frame();
    const before = controls.field.calls.clears;
    const { down, up } = tap(controls, { pointerType });
    controls.frame();
    assert.equal(controls.scene.dataset.phase, "interactive", pointerType);
    assert.ok(controls.field.calls.clears > before, "a fast tap must result in a rendered reaction");
    displayFor(controls, 1000);
    assert.equal(controls.scene.dataset.phase, "interactive", "release must not immediately undo a tap");
    assert.equal(controls.frames.size, 1);
    assert.equal(down.defaultPrevented, false, "the entrance preserves native touch handling");
    assert.equal(up.defaultPrevented, false);
  }
});

test("blank entrance taps retract a graphic without resetting the source sequence", () => {
  const controls = animation();
  tap(controls);
  displayFor(controls, 160);
  assert.equal(controls.scene.dataset.phase, "interactive");
  tap(controls, { clientY: 600, target: controls.entrance });
  displayFor(controls, 450);
  assert.equal(controls.scene.dataset.phase, "editing", "retraction resumes the original source sequence");
  assert.equal(controls.frames.size, 1);
});

test("tapped graphics hold briefly, then return to the uninterrupted source cycle", () => {
  const controls = animation();
  tap(controls);
  displayFor(controls, 5600);
  assert.equal(controls.scene.dataset.phase, "interactive", "a graphic remains available for exploration");
  displayFor(controls, 1000);
  assert.notEqual(controls.scene.dataset.phase, "interactive", "a tap does not indefinitely suspend the source cycle");
  assert.equal(controls.frames.size, 1);
});

test("links, controls, editable content, and dialog backdrops do not trigger graphics", () => {
  for (const kind of ["a", "button", "input", "textarea", "select", "summary", "role-button", "editable", "dialog"]) {
    const controls = animation();
    const target = controls.node(kind === "role-button" || kind === "editable" ? "div" : kind);
    if (kind === "role-button") target.setAttribute("role", "button");
    if (kind === "editable") target.setAttribute("contenteditable", "true");
    target.parentElement = controls.entrance;
    const child = controls.node("span");
    child.parentElement = target;
    if (kind === "dialog") controls.document.openDialog = target;
    tap(controls, { target: kind === "dialog" ? controls.entrance : child });
    controls.frame();
    assert.notEqual(controls.scene.dataset.phase, "interactive", kind);
  }
});

test("hover never launches effects, including after leaving controls or dialogs", () => {
  for (const destination of ["source", "control", "dialog"]) {
    const controls = animation();
    const event = { pointerType: "mouse", clientX: 80, clientY: 20, target: controls.field };
    controls.entrance.dispatch("pointermove", event);
    displayFor(controls, 500);
    assert.notEqual(controls.scene.dataset.phase, "interactive", "passing over code should not immediately open a graphic");
    if (destination === "control") {
      const button = controls.node("button");
      button.parentElement = controls.entrance;
      controls.entrance.dispatch("pointermove", { ...event, target: button });
    } else if (destination === "dialog") controls.document.openDialog = controls.node("dialog");
    displayFor(controls, 500);
    assert.notEqual(controls.scene.dataset.phase, "interactive", destination);
    if (destination === "dialog") {
      controls.document.openDialog = null;
      displayFor(controls, 500);
      assert.notEqual(controls.scene.dataset.phase, "interactive", "closing a dialog must not revive stale hover intent");
    }
    assert.equal(controls.frames.size, 1);
  }
});

test("a second finger cancels the pending primary tap", () => {
  const controls = animation();
  const primary = { pointerId: 1, pointerType: "touch", clientX: 80, clientY: 20, target: controls.field };
  const secondary = { ...primary, pointerId: 2, isPrimary: false, clientX: 140 };
  controls.entrance.dispatch("pointerdown", primary);
  controls.entrance.dispatch("pointerdown", secondary);
  controls.window.dispatch("pointerup", secondary);
  controls.window.dispatch("pointerup", primary);
  controls.frame();
  assert.notEqual(controls.scene.dataset.phase, "interactive", "a pinch must not leave a primary tap waiting to fire");
  assert.equal(controls.frames.size, 1);
});

test("scrolling, long presses, cancellation, and secondary pointers do not count as taps", () => {
  for (const kind of ["drag", "out-and-back", "long", "cancel", "secondary", "right-button", "different-pointer"]) {
    const controls = animation();
    const event = { pointerType: "touch", clientX: 80, clientY: 20, target: controls.field,
      ...(kind === "secondary" ? { isPrimary: false } : {}), ...(kind === "right-button" ? { button: 2 } : {}) };
    controls.entrance.dispatch("pointerdown", event);
    if (kind === "drag" || kind === "out-and-back") {
      const move = controls.entrance.dispatch("pointermove", { ...event, clientY: 80 });
      assert.equal(move.defaultPrevented, false, "scroll movement remains native");
    }
    if (kind === "long") controls.advance(500);
    controls.window.dispatch(kind === "cancel" ? "pointercancel" : "pointerup", {
      ...event, ...(kind === "drag" ? { clientY: 80 } : {}), ...(kind === "different-pointer" ? { pointerId: 2 } : {}),
    });
    controls.frame();
    assert.notEqual(controls.scene.dataset.phase, "interactive", kind);
  }
});

test("motion and view changes discard active graphics and pending gestures", () => {
  for (const state of ["paused", "reduced", "workspace", "hidden"]) {
    for (const pending of [false, true]) {
      const controls = animation();
      const event = { pointerType: "touch", clientX: 80, clientY: 20, target: controls.field };
      if (pending) controls.entrance.dispatch("pointerdown", event);
      else { tap(controls); controls.frame(); }
      const change = (disabled) => {
        if (state === "paused") {
          controls.root.dataset.motion = disabled ? "paused" : "running";
          controls.window.dispatch("portfolio:preferences");
        } else if (state === "reduced") {
          controls.motion.matches = disabled;
          controls.motion.dispatch("change");
        } else if (state === "workspace") {
          controls.root.dataset.view = disabled ? "workspace" : "entrance";
          controls.window.dispatch("portfolio:view");
        } else {
          controls.document.hidden = disabled;
          controls.document.dispatch("visibilitychange");
        }
      };
      change(true);
      assert.equal(controls.frames.size, 0, `${state} stops the frame loop`);
      change(false);
      if (pending) controls.window.dispatch("pointerup", event);
      controls.frame();
      assert.notEqual(controls.scene.dataset.phase, "interactive", `${state}, pending=${pending}`);
      assert.equal(controls.frames.size, 1, `${state} resumes one frame loop`);
    }
  }
});

test("paused or reduced motion never launches a tap reaction", () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    const controls = animation(options);
    tap(controls);
    controls.frame();
    assert.notEqual(controls.scene.dataset.phase, "interactive");
    assert.equal(controls.frames.size, 0);
  }
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

test("unattended typing never launches an effect over multiple complete cycles", () => {
  const controls = animation();
  for (let i = 0; i < 1200; i++) {
    controls.frame(40);
    assert.equal(controls.scene.dataset.phase, "editing");
  }
});

test("mobile code renders at native Retina density while large transitions stay bounded", () => {
  const controls = animation({ density: 3, fieldWidth: 348 });
  assert.equal(controls.field.width, 1044);
  assert.equal(controls.field.height, 960);
  controls.api.enter();
  assert.ok(controls.field.width * controls.field.height < 4010000);
});

test("line-number taps reveal genuine history while source keywords reveal tokens", () => {
  for (const [x, expected] of [[10, "history"], [163, "tokens"], [80, "avatar"]]) {
    const controls = animation();
    controls.entrance.dispatch("pointerdown", { clientX: x, clientY: 20, target: controls.field });
    controls.window.dispatch("pointerup", { clientX: x, clientY: 20, target: controls.field });
    controls.frame(40);
    assert.equal(controls.scene.dataset.effect, expected);
    assert.equal(controls.scene.dataset.phase, "interactive");
  }
});

test("the filename opens history and a second filename click retracts it", () => {
  const controls = animation();
  const filename = controls.document.querySelector("[data-scene-file]");
  filename.dispatch("click");
  controls.frame(40);
  assert.equal(controls.scene.dataset.effect, "history");
  for (let i = 0; i < 20; i++) controls.frame(40);
  filename.dispatch("click");
  for (let i = 0; i < 25; i++) controls.frame(40);
  assert.equal(controls.scene.dataset.phase, "editing");
});
