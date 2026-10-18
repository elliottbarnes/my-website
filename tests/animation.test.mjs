import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { PROJECTS } from "../data/projects.mjs";
import { PUBLIC_FILES } from "../scripts/public-files.mjs";

const effectsSource = await readFile(new URL("../assets/entrance-effects.js", import.meta.url), "utf8");
const ecdsaMathSource = await readFile(new URL("../assets/ecdsa-math.js", import.meta.url), "utf8");
const ecdsaEffectSource = await readFile(new URL("../assets/ecdsa-effect.js", import.meta.url), "utf8");
const signalSource = await readFile(new URL("../assets/source-signal-effects.js", import.meta.url), "utf8");
const structureSource = await readFile(new URL("../assets/source-structure-effects.js", import.meta.url), "utf8");
const source = await readFile(new URL("../assets/animation.js", import.meta.url), "utf8");

// Exercise the shipped animation controller and its clock without a browser
// dependency. These checks cover lifecycle and response time; visual quality
// and actual frame cost still need a real browser.
function animation({ reduced = false, paused = false, hidden = false, view = "entrance", density = 1, fieldWidth = 640, featured = "glassbox" } = {}) {
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
      focus() { document.activeElement = this; this.dispatch("focus"); },
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
    const calls = { clears: 0, images: [], text: [] };
    const context = new Proxy({
      clearRect() { calls.clears += 1; calls.text = []; },
      fillText(text, x, y) { calls.text.push({ text, x, y, alpha: this.globalAlpha, font: this.font }); },
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
  for (const selector of ["#code-wall", "[data-scene-file]", "[data-scene-path]", "#typed-command", "#entrance .mode", "#entrance .status-position", "#scene-feedback"]) nodes.set(selector, node());
  const enter = node("a"); enter.setAttribute("href", `#${featured}`); nodes.set("[data-enter]", enter);
  const projectLinks = node("nav"), projectSource = node("a"), projectDemo = node("a"), projectTry = node("button");
  for (const child of [projectSource, projectDemo, projectTry]) child.parentElement = projectLinks;
  nodes.set(".scene-project-links", projectLinks);
  nodes.set("[data-scene-source]", projectSource);
  nodes.set("[data-scene-demo]", projectDemo);
  nodes.set("[data-scene-try]", projectTry);
  for (const project of PROJECTS) {
    const panel = node("article"), demo = node("a");
    panel.dataset = { experiment: project.experiment?.kind, experimentLabel: project.experiment?.label };
    demo.setAttribute("href", project.demo.url); demo.setAttribute("aria-label", project.demo.ariaLabel); demo.textContent = project.demo.label;
    panel.querySelector = selector => selector === "[data-demo]" ? demo : null;
    nodes.set(`#${project.id}`, panel);
  }
  const ecdsaControls = node(), ecdsaButtons = {};
  ecdsaControls.hidden = true;
  ecdsaControls.parentElement = scene;
  nodes.set("[data-ecdsa-controls]", ecdsaControls);
  nodes.set("[data-ecdsa-step]", node());
  for (const name of ["back", "next", "play", "tamper", "close"]) {
    const button = node("button");
    button.parentElement = ecdsaControls;
    ecdsaButtons[name] = button;
    nodes.set(`[data-ecdsa-${name}]`, button);
  }
  const document = Object.assign(surface(), {
    documentElement: root, hidden,
    querySelector: (selector) => selector === "dialog[open]" ? (document.openDialog || null) : nodes.get(selector) || null,
    getElementById: (id) => nodes.get(`#${id}`) || null,
    createElement: (tag) => tag === "canvas" ? canvas() : node(),
  });
  field.parentElement.focus = () => {
    document.activeElement = field.parentElement;
    field.parentElement.dispatch("focus");
  };
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
  vm.runInNewContext(ecdsaMathSource, { window });
  vm.runInNewContext(ecdsaEffectSource, { window });
  vm.runInNewContext(signalSource, { window });
  vm.runInNewContext(structureSource, { window });
  vm.runInNewContext(effectsSource, { window });
  vm.runInNewContext(source, {
    document, window, Image, performance, requestAnimationFrame, cancelAnimationFrame,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    root, entrance, scene, field, readout, document, motion, window, frames, timers, images, node, ecdsaControls, ecdsaButtons, projectLinks, projectSource, projectDemo, projectTry,
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
  assert.equal(controls.images[0].src, "/assets/memoji-saiyan.webp");
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

// Source morphing paints individual glyphs, omitting spaces between them.
const renderedText = controls => controls.field.calls.text.map(call => call.text).join("").replace(/\s/g, "");

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

test("view changes discard active graphics while quiet motion freezes effects and cancels pending taps", () => {
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
      if (!pending && ["paused", "reduced"].includes(state)) {
        assert.equal(controls.scene.dataset.phase, "interactive", `${state} resumes the explicitly opened effect`);
      } else assert.notEqual(controls.scene.dataset.phase, "interactive", `${state}, pending=${pending}`);
      assert.equal(controls.frames.size, 1, `${state} resumes one frame loop`);
    }
  }
});

test("paused or reduced motion permits static code discovery without starting animation", () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    for (const [clientX, expected] of [[10, "history"], [163, "tokens"], [80, "tokens"]]) {
      const controls = animation(options);
      tap(controls, { clientX });
      controls.frame();
      assert.equal(controls.api.state.effect, expected);
      assert.equal(controls.api.state.static, true);
      assert.equal(controls.frames.size, 0);
      tap(controls, { clientX: 30, clientY: 600 });
      assert.equal(controls.api.state.effect, null, "a blank tap dismisses a static preview");
    }
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
  for (const [x, expected] of [[10, "history"], [163, "tokens"], [80, "tokens"]]) {
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

test("source experiments carry real visible code letters", () => {
  const controls = animation();
  tap(controls, { clientX: 80, clientY: 20 });
  controls.frame(40);
  assert.equal(controls.api.state.effect, "tokens");
  assert.ok(controls.api.state.glyphCount > 0);
  tap(controls, { clientX: 30, clientY: 600 });
  displayFor(controls, 600);
  displayFor(controls, 4900);
  tap(controls, { clientX: 80, clientY: 20 });
  controls.frame(40);
  assert.equal(controls.api.state.effect, "interference");
  assert.ok(controls.api.state.glyphCount > 0);
});

test("the filename provides static history with paused or reduced motion", () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    const controls = animation(options);
    const filename = controls.document.querySelector("[data-scene-file]");
    filename.dispatch("click");
    assert.equal(controls.api.state.effect, "history");
    assert.equal(controls.api.state.static, true);
    assert.equal(controls.scene.dataset.phase, "interactive");
    assert.equal(controls.frames.size, 0, "explicit exploration must not restart motion");
    filename.dispatch("click");
    assert.equal(controls.api.state.effect, null);
    assert.equal(controls.scene.dataset.phase, "still");
  }
});

test("keyboard row selection, explicit activation, and Escape work without animation", () => {
  const controls = animation({ reduced: true });
  const surface = controls.field.parentElement;
  surface.dispatch("focus");
  const before = controls.api.state.selectedLine;
  const arrow = surface.dispatch("keydown", { key: "ArrowDown" });
  assert.equal(arrow.defaultPrevented, true);
  assert.ok(controls.api.state.selectedLine > before);
  const space = surface.dispatch("keydown", { key: " " });
  assert.equal(space.defaultPrevented, true);
  assert.equal(controls.api.state.effect, "tokens");
  assert.equal(controls.api.state.static, true);
  assert.equal(controls.frames.size, 0);
  const escape = controls.entrance.dispatch("keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(controls.api.state.effect, null);
});

test("keyboard history selection retains genuine commits and does not navigate", () => {
  const controls = animation({ paused: true });
  controls.document.querySelector("[data-scene-file]").dispatch("click");
  const surface = controls.field.parentElement;
  assert.equal(controls.document.activeElement, surface, "opening history focuses the announced keyboard controls");
  surface.dispatch("keydown", { key: "ArrowLeft" });
  assert.equal(controls.api.state.selectedCommit, "5789eec04c64bea45b2f5b9bce3adc6387128d81");
  surface.dispatch("keydown", { key: "ArrowRight" });
  assert.equal(controls.api.state.selectedCommit, "c7ae7bd3eb374580b0c28e0b554108b5504a1c00");
  assert.equal(controls.api.state.effect, "history");
  assert.equal(controls.frames.size, 0);
  assert.equal(controls.root.dataset.view, "entrance");
});

test("resuming motion gives an explicitly opened static preview an ordinary finite hold", () => {
  const controls = animation({ paused: true });
  controls.document.querySelector("[data-scene-file]").dispatch("click");
  assert.equal(controls.api.state.static, true);
  controls.root.dataset.motion = "running";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(controls.api.state.static, false);
  assert.equal(controls.api.state.effect, "history");
  displayFor(controls, 8500);
  assert.equal(controls.api.state.effect, "history", "resuming retains the preview briefly");
  displayFor(controls, 1200);
  assert.equal(controls.api.state.effect, null, "the preview returns to code after its normal hold");
  assert.equal(controls.scene.dataset.phase, "editing");
});

test("hash hit testing matches the visible glyph layout while history is opening", () => {
  const controls = animation();
  const renderer = controls.window.PortfolioEntranceEffects;
  let drawn;
  controls.window.PortfolioEntranceEffects = {
    ...renderer,
    draw(kind, args) {
      const bounds = renderer.draw(kind, args);
      if (kind === "history") drawn = { amount: args.amount, bounds };
      return bounds;
    },
  };
  controls.document.querySelector("[data-scene-file]").dispatch("click");
  displayFor(controls, 300);
  assert.ok(drawn.amount > .65 && drawn.amount < .95);
  tap(controls, { clientX: drawn.bounds.right - 14, clientY: drawn.bounds.top + 50 });
  assert.equal(controls.api.state.effect, "history");
  assert.equal(controls.api.state.selectedCommit, "c7ae7bd3eb374580b0c28e0b554108b5504a1c00");
});

test("Escape announces that an explicit preview has returned to code", () => {
  const controls = animation({ paused: true });
  controls.document.querySelector("[data-scene-file]").dispatch("click");
  controls.entrance.dispatch("keydown", { key: "Escape" });
  assert.equal(controls.document.querySelector("#scene-feedback").textContent, "returned to source code.");
  assert.equal(controls.api.state.effect, null);
});

test("pausing a partial effect preserves its code, geometry, and remaining hold through theme refreshes", () => {
  const controls = animation();
  const renderer = controls.window.PortfolioEntranceEffects;
  let drawn;
  controls.window.PortfolioEntranceEffects = {
    ...renderer,
    draw(kind, args) {
      drawn = { time: args.time, amount: args.amount, bounds: renderer.draw(kind, args), pull: { ...args.pull } };
      return drawn.bounds;
    },
  };
  controls.document.querySelector("[data-scene-file]").dispatch("click");
  displayFor(controls, 200);
  const snapshot = { ...drawn };
  const sourceSnapshot = [...controls.field.calls.text];
  assert.ok(snapshot.amount > 0 && snapshot.amount < .95);
  controls.root.dataset.motion = "paused";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(controls.api.state.frozen, true);
  assert.deepEqual(drawn, snapshot, "pausing cannot jump to another animation time or shape");
  assert.deepEqual(controls.field.calls.text, sourceSnapshot, "pausing preserves the exact source characters and cursor position");
  controls.advance(30000);
  controls.window.dispatch("portfolio:preferences");
  assert.deepEqual(drawn, snapshot, "theme refreshes preserve the paused frame");
  assert.deepEqual(controls.field.calls.text, sourceSnapshot, "a refresh cannot restart the source typing clock");
  assert.equal(controls.frames.size, 0);
  controls.root.dataset.motion = "running";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(controls.api.state.frozen, false);
  displayFor(controls, 8000);
  assert.equal(controls.api.state.effect, "history", "paused time must not consume the remaining hold");
  displayFor(controls, 1500);
  assert.equal(controls.api.state.effect, null);
});

test("pausing idle typing preserves the visible cursor and source position", () => {
  const controls = animation();
  displayFor(controls, 1800);
  const label = controls.document.querySelector("#entrance .status-position");
  const position = label.textContent;
  controls.root.dataset.motion = "paused";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(label.textContent, position);
  controls.advance(10000);
  controls.window.dispatch("portfolio:preferences");
  assert.equal(label.textContent, position);
  assert.equal(controls.frames.size, 0);
});

test("a cancelled effect drag settles its pull after a second finger, capture loss, or missed release", () => {
  for (const ending of ["second-finger", "capture-loss", "released-buttons"]) {
    const controls = animation();
    controls.document.querySelector("[data-scene-file]").dispatch("click");
    displayFor(controls, 700);
    const event = { pointerType: ending === "released-buttons" ? "mouse" : "touch", buttons: 1,
      clientX: 320, clientY: 130, target: controls.field };
    controls.entrance.dispatch("pointerdown", event);
    controls.window.dispatch("pointermove", { ...event, clientX: 380 });
    displayFor(controls, 180);
    assert.ok(controls.api.state.pull.x > 20);
    if (ending === "second-finger") controls.entrance.dispatch("pointerdown", { ...event, pointerId: 2, isPrimary: false });
    else if (ending === "capture-loss") controls.field.parentElement.dispatch("lostpointercapture", { pointerId: 1 });
    else controls.window.dispatch("pointermove", { ...event, buttons: 0 });
    assert.equal(controls.scene.dataset.dragging, "false");
    displayFor(controls, 600);
    assert.ok(Math.abs(controls.api.state.pull.x) < .1, ending);
    assert.equal(controls.api.state.effect, "history");
  }
});

test("normal mouse and pen releases with no buttons held still activate the tapped code", () => {
  for (const pointerType of ["mouse", "pen"]) {
    const controls = animation();
    const event = { pointerType, clientX: 80, clientY: 20, target: controls.field };
    controls.entrance.dispatch("pointerdown", { ...event, buttons: 1 });
    assert.doesNotThrow(() => controls.window.dispatch("pointerup", { ...event, buttons: 0 }));
    controls.frame(40);
    assert.equal(controls.api.state.effect, "tokens", pointerType);
  }
});

test("touch visitors can select real hashes in a static history preview", () => {
  const controls = animation({ reduced: true });
  const renderer = controls.window.PortfolioEntranceEffects;
  let bounds;
  controls.window.PortfolioEntranceEffects = { ...renderer,
    draw(kind, args) { bounds = renderer.draw(kind, args); return bounds; },
  };
  tap(controls, { clientX: 10, clientY: 20 });
  assert.equal(controls.api.state.effect, "history");
  tap(controls, { clientX: bounds.left + 30, clientY: bounds.top + 50 });
  assert.equal(controls.api.state.selectedCommit, "6baf3aacc2b86458bd42dfb4d3f511721005bcef");
  assert.equal(controls.api.state.static, true);
  assert.equal(controls.frames.size, 0);
});


test("code-discovered interference preserves static discovery without losing the surface", () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    const controls = animation(options);
    for (let i = 0; i < 5; i++) {
      tap(controls);
      if (i < 4) controls.entrance.dispatch("keydown", { key: "Escape" });
    }
    assert.equal(controls.api.state.effect, "interference");
    assert.equal(controls.frames.size, 0);
    assert.ok(controls.field.calls.text.map(call => call.text).join("").includes("twocoherentsources"));
    const before = JSON.stringify(controls.field.calls.text);
    controls.window.dispatch("pointermove", { clientX: 500, clientY: 100, target: controls.field });
    controls.frame(1000);
    assert.equal(JSON.stringify(controls.field.calls.text), before);
  }
});


test("source discoveries show twelve distinct experiments before the much rarer portrait", () => {
  const controls = animation({paused:true}), kinds = [];
  for (let i=0;i<108;i++) {
    tap(controls); kinds.push(controls.api.state.effect);
    assert.ok(controls.api.state.glyphCount > 0);
    controls.entrance.dispatch("keydown", {key:"Escape"});
  }
  assert.equal(new Set(kinds.slice(0,12)).size,12);
  for (const kind of ["fourier", "attractor", "phyllotaxis", "pathfinding", "quadtree", "convolution", "ecdsa"]) {
    assert.ok(kinds.slice(0,12).includes(kind), `${kind} must appear in the first complete deck`);
  }
  assert.deepEqual(kinds.flatMap((kind,i)=>kind==='avatar'?[i+1]:[]),[36,72,108]);
  const experiments = kinds.filter(kind=>kind!=="avatar");
  assert.ok(experiments.every((kind,index)=>!experiments.slice(Math.max(0,index-6),index).includes(kind)), "no recycling within six experiments");
  assert.equal(controls.frames.size,0);
});

test("N discovers the next source experiment without adding a picker or consuming held-key repeats", () => {
  const controls = animation({reduced:true});
  const surface = controls.field.parentElement;
  surface.focus();
  surface.dispatch("keydown", {key:"n"});
  assert.equal(controls.api.state.effect,"tokens");
  surface.dispatch("keydown", {key:"n",repeat:true});
  assert.equal(controls.api.state.effect,"tokens");
  surface.dispatch("keydown", {key:"N"});
  assert.equal(controls.api.state.effect,"fourier");
  assert.ok(controls.api.state.glyphCount>0);
  assert.equal(controls.frames.size,0);
  controls.entrance.dispatch("keydown", {key:"Escape"});
  assert.equal(controls.api.state.effect,null);
});

test("recent experiments are avoided when the displayed project changes", () => {
  const controls = animation(), kinds=[], projects=new Set();
  for(let i=0;i<18;i++) {
    controls.field.parentElement.dispatch("keydown",{key:"n"});
    displayFor(controls,500);
    kinds.push(controls.api.state.effect);
    projects.add(controls.document.querySelector("[data-scene-file]").textContent.split('/')[0]);
    controls.entrance.dispatch("keydown",{key:"Escape"});
    displayFor(controls,5100);
  }
  assert.ok(projects.size>=3,"exercise several source projects");
  assert.ok(kinds.every((kind,i)=>!kinds.slice(Math.max(0,i-6),i).includes(kind)), JSON.stringify(kinds));
});
test("history discovery does not advance the source-effect rotation", () => {
  const controls = animation({paused:true});
  tap(controls,{clientX:10}); assert.equal(controls.api.state.effect,"history");
  controls.entrance.dispatch("keydown",{key:"Escape"});
  tap(controls); assert.equal(controls.api.state.effect,"tokens");
});
test("the sketch selector is absent from the published entrance", async () => {
  const html = await readFile(new URL("../index.html",import.meta.url),"utf8");
  assert.equal(html.includes('scene-experiment'),false);
  assert.equal(source.includes('scene-experiment'),false);
});

test("ECDSA opens directly, renders all six stages, and announces verified arithmetic", () => {
  const controls = animation();
  const label = controls.document.querySelector("[data-ecdsa-step]");
  const feedback = controls.document.querySelector("#scene-feedback");
  assert.equal(controls.ecdsaControls.hidden, true);
  controls.api.openECDSA();
  assert.equal(controls.api.state.effect, "ecdsa");
  assert.equal(controls.document.activeElement, controls.field.parentElement);
  assert.equal(controls.ecdsaControls.hidden, false);
  assert.equal(controls.ecdsaButtons.back.disabled, true);
  const stages = ["the curve", "public key", "one-use nonce", "sign", "verify", "result"];
  for (let step = 0; step < stages.length; step++) {
    if (step) controls.ecdsaButtons.next.dispatch("click");
    displayFor(controls, 500);
    assert.equal(controls.api.state.ecdsaStep, step);
    assert.equal(label.textContent, `${step + 1} / 6`);
    assert.match(feedback.textContent, new RegExp(`ECDSA step ${step + 1} of 6`));
    assert.ok(renderedText(controls).includes(`ECDSA/${stages[step]}`.replace(/\s/g, "")), stages[step]);
  }
  assert.equal(controls.ecdsaButtons.next.disabled, true);
  assert.equal(controls.api.state.ecdsaPlaying, false);
  assert.match(feedback.textContent, /Verified.*\(10, 6\).*r = 10/);
  assert.ok(renderedText(controls).includes("10=10✓ACCEPT"));
});

test("ECDSA tampering and restoration update the actual verification and accessible result", () => {
  const controls = animation({ paused: true });
  const feedback = controls.document.querySelector("#scene-feedback");
  controls.api.openECDSA();
  controls.ecdsaButtons.tamper.dispatch("click");
  assert.equal(controls.api.state.ecdsaStep, 5);
  assert.equal(controls.api.state.ecdsaTampered, true);
  assert.equal(controls.ecdsaButtons.tamper.getAttribute("aria-pressed"), "true");
  assert.equal(controls.ecdsaButtons.tamper.textContent, "restore hash");
  assert.match(feedback.textContent, /Rejected.*\(3, 16\).*does not match r = 10/);
  assert.ok(renderedText(controls).includes("V=(3,16)"));
  assert.ok(renderedText(controls).includes("3≠10×REJECT"));
  controls.ecdsaButtons.back.dispatch("click");
  assert.match(feedback.textContent, /Changed hash z = 12.*u1 = 11 and u2 = 6/);
  controls.ecdsaButtons.tamper.dispatch("click");
  assert.equal(controls.api.state.ecdsaTampered, false);
  assert.equal(controls.ecdsaButtons.tamper.getAttribute("aria-pressed"), "false");
  assert.match(feedback.textContent, /Verified.*\(10, 6\)/);
  assert.ok(renderedText(controls).includes("10=10✓ACCEPT"));
  assert.equal(controls.frames.size, 0);
});

test("reduced motion keeps ECDSA manual, keyboard operable, and free of animation frames", () => {
  const controls = animation({ reduced: true });
  controls.api.openECDSA();
  assert.equal(controls.api.state.ecdsaPlaying, false);
  assert.equal(controls.ecdsaButtons.play.disabled, true);
  assert.equal(controls.frames.size, 0);
  for (let step = 1; step <= 5; step++) {
    const event = controls.field.parentElement.dispatch("keydown", { key: "ArrowRight" });
    assert.equal(event.defaultPrevented, true);
    assert.equal(controls.api.state.ecdsaStep, step);
    assert.equal(controls.frames.size, 0);
  }
  controls.field.parentElement.dispatch("keydown", { key: "ArrowLeft" });
  assert.equal(controls.api.state.ecdsaStep, 4);
  controls.ecdsaButtons.play.dispatch("click");
  controls.advance(60000);
  controls.frame();
  assert.equal(controls.api.state.ecdsaStep, 4);
  assert.equal(controls.api.state.ecdsaPlaying, false);
  assert.equal(controls.frames.size, 0);
});

test("global pause freezes ECDSA mid-step and resumes without consuming paused time", () => {
  const controls = animation();
  controls.api.openECDSA();
  displayFor(controls, 3800);
  assert.equal(controls.api.state.ecdsaStep, 1);
  const rendered = JSON.stringify(controls.field.calls.text);
  controls.root.dataset.motion = "paused";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(controls.api.state.frozen, true);
  assert.equal(controls.ecdsaButtons.play.disabled, true);
  assert.equal(JSON.stringify(controls.field.calls.text), rendered, "pause preserves the in-progress point multiplication");
  controls.advance(60000);
  controls.window.dispatch("portfolio:preferences");
  assert.equal(JSON.stringify(controls.field.calls.text), rendered);
  assert.equal(controls.api.state.ecdsaStep, 1);
  assert.equal(controls.frames.size, 0);
  controls.root.dataset.motion = "running";
  controls.window.dispatch("portfolio:preferences");
  assert.equal(controls.ecdsaButtons.play.disabled, false);
  displayFor(controls, 2800);
  assert.equal(controls.api.state.ecdsaStep, 2);
  assert.equal(controls.frames.size, 1);
});

test("local ECDSA pause preserves the current multiplication point through pause and resume", () => {
  const controls = animation();
  controls.api.openECDSA();
  displayFor(controls, 4200);
  assert.equal(controls.api.state.ecdsaStep, 1);
  assert.ok(renderedText(controls).includes("2G=(6,3)"), "playback has reached the second multiple");
  controls.ecdsaButtons.play.dispatch("click");
  assert.equal(controls.api.state.ecdsaPlaying, false);
  assert.ok(renderedText(controls).includes("2G=(6,3)"), "pause must not jump to the final public key");
  assert.equal(renderedText(controls).includes("7G=(0,6)"), false);
  controls.advance(60000);
  displayFor(controls, 600);
  assert.equal(controls.api.state.ecdsaStep, 1);
  assert.ok(renderedText(controls).includes("2G=(6,3)"), "background frames cannot advance a locally paused stage");
  controls.ecdsaButtons.play.dispatch("click");
  assert.equal(controls.api.state.ecdsaPlaying, true);
  assert.ok(renderedText(controls).includes("2G=(6,3)"), "resume begins at the same scalar and curve point");
  displayFor(controls, 800);
  assert.ok(renderedText(controls).includes("4G=(3,1)"), "resumed playback advances from the preserved point");
});

test("ECDSA playback completes once, remains inspectable, and can replay", () => {
  const controls = animation();
  controls.api.openECDSA();
  displayFor(controls, 20000);
  assert.equal(controls.api.state.ecdsaStep, 5);
  assert.equal(controls.api.state.ecdsaPlaying, false);
  assert.equal(controls.api.state.effect, "ecdsa");
  assert.equal(controls.ecdsaButtons.play.textContent, "replay");
  displayFor(controls, 10000);
  assert.equal(controls.api.state.effect, "ecdsa", "the explanation has no automatic dismissal timer");
  controls.ecdsaButtons.play.dispatch("click");
  assert.equal(controls.api.state.ecdsaStep, 0);
  assert.equal(controls.api.state.ecdsaPlaying, true);
});

test("closing ECDSA returns focus to the source surface without trapping hidden controls", () => {
  for (const paused of [true, false]) {
    const controls = animation({ paused });
    controls.api.openECDSA();
    controls.ecdsaButtons.close.focus();
    controls.ecdsaButtons.close.dispatch("click");
    assert.equal(controls.ecdsaControls.hidden, true);
    assert.equal(controls.document.activeElement, controls.field.parentElement);
    displayFor(controls, 900);
    assert.equal(controls.api.state.effect, null);
    assert.equal(controls.document.querySelector("#scene-feedback").textContent, "returned to source code.");
  }
});

test("hiding the page or entering the workspace stops and clears ECDSA safely", () => {
  for (const state of ["hidden", "workspace"]) {
    const controls = animation();
    controls.api.openECDSA();
    displayFor(controls, 3500);
    controls.ecdsaButtons.next.focus();
    const change = disabled => {
      if (state === "hidden") {
        controls.document.hidden = disabled;
        controls.document.dispatch("visibilitychange");
      } else {
        controls.root.dataset.view = disabled ? "workspace" : "entrance";
        controls.window.dispatch("portfolio:view");
      }
    };
    change(true);
    assert.equal(controls.frames.size, 0, state);
    assert.equal(controls.api.state.effect, null, state);
    assert.equal(controls.ecdsaControls.hidden, true, state);
    const clears = controls.field.calls.clears;
    controls.advance(30000); controls.frame();
    assert.equal(controls.field.calls.clears, clears, `${state} performs no background drawing`);
    change(false);
    assert.equal(controls.api.state.effect, null);
    assert.equal(controls.ecdsaControls.hidden, true);
    assert.equal(controls.frames.size, 1);
  }
});


test("source actions stay on the displayed project and open its related experiment", () => {
  const controls = animation({ paused: true, featured: "architecture-lab" });
  assert.match(controls.projectSource.getAttribute("href"), /architecture-lab\/blob\/.+src\/framebuffer\.js/);
  assert.equal(controls.projectDemo.getAttribute("href"), PROJECTS.find(project => project.id === "architecture-lab").demo.url);
  assert.equal(controls.projectTry.hidden, false);
  controls.projectTry.dispatch("click");
  assert.equal(controls.api.state.effect, "object");
  assert.equal(controls.api.state.static, true);
  assert.equal(controls.document.activeElement, controls.field.parentElement);
});

test("the framebuffer scan finishes before a touch discovery closes", () => {
  for (const fieldWidth of [320, 640]) {
    const controls = animation({ featured: "architecture-lab", fieldWidth });
    tap(controls);
    displayFor(controls, 5100);
    assert.equal(controls.api.state.effect, "object");
    assert.ok(renderedText(controls).includes("framecomplete/80bytes→640pixels"));
    displayFor(controls, 1600);
    assert.equal(controls.api.state.effect, null, "the completed scan still returns to source normally");
  }
});

test("project links hold their destination while hovered or keyboard-focused", () => {
  for (const mode of ["pointer", "keyboard"]) {
    const controls = animation();
    controls.projectLinks.dispatch(mode === "pointer" ? "pointerenter" : "focusin");
    for (let i = 0; i < 180; i++) controls.frame(40);
    assert.equal(controls.projectDemo.getAttribute("href"), PROJECTS.find(project => project.id === "glassbox").demo.url, mode);
    controls.projectLinks.dispatch(mode === "pointer" ? "pointerleave" : "focusout", { relatedTarget: null });
    for (let i = 0; i < 180; i++) controls.frame(40);
    assert.notEqual(controls.projectDemo.getAttribute("href"), PROJECTS.find(project => project.id === "glassbox").demo.url, mode);
    assert.match(controls.projectSource.getAttribute("href"), /github\.com\/elliottbarnes\//);
  }
});

test("lazy arcade loading and every game stop entrance frames until the handoff closes", () => {
  const controls = animation();
  controls.root.dataset.training = "open";
  controls.window.dispatch("portfolio:training");
  assert.equal(controls.frames.size, 0);
  delete controls.root.dataset.training;
  controls.window.dispatch("portfolio:training");
  assert.equal(controls.frames.size, 1);
});
