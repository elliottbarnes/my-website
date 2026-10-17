import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const uiSource = await readFile(new URL("../assets/goku-adventure.js", import.meta.url), "utf8");
const storySource = await readFile(new URL("../assets/goku-story.js", import.meta.url), "utf8");

// Execute both production modules. This harness models browser event/focus
// contracts; viewport and software-keyboard geometry still require browser QA.
function setup() {
  let document;
  class Element {
    constructor(tag = "div", id = "") {
      this.tagName = tag.toUpperCase(); this.id = id; this.handlers = new Map();
      this.children = []; this.parentElement = null; this.dataset = {}; this.attributes = {};
      this._text = ""; this.open = false; this.hidden = false; this.disabled = false;
      this.isConnected = true; this.value = ""; this.scrollTop = 0; this.scrollCalls = [];
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = String(value); this.replaceChildren(); }
    append(...children) { for (const child of children) { child.parentElement = this; child.isConnected = this.isConnected; this.children.push(child); } }
    replaceChildren(...children) {
      for (const child of this.children) { child.parentElement = null; child.isConnected = false; }
      this.children = []; this.append(...children);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    closest(selector) {
      if (selector === "[hidden], dialog:not([open])") {
        for (let node = this; node; node = node.parentElement) if (node.hidden || node.tagName === "DIALOG" && !node.open) return node;
      }
      return null;
    }
    focus() { document.activeElement = this; }
    scrollIntoView(options) { this.scrollCalls.push({ ...options }); }
    addEventListener(type, callback) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(callback); }
    emit(type, properties = {}) {
      const event = { type, target: this, defaultPrevented: false, propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...properties };
      for (const callback of this.handlers.get(type) || []) callback(event);
      if (type === "cancel" && !event.defaultPrevented) this.close();
      return event;
    }
    showModal() { this.open = true; }
    close() { if (!this.open) return; this.open = false; this.emit("close"); }
  }
  const ids = new Map();
  const add = (tag, id) => { const node = new Element(tag, id); ids.set(id, node); return node; };
  const root = add("html", "root"), body = add("body", "body"), opener = add("button", "opener");
  const fallback = add("button", "fallback"); root.append(body); body.append(opener, fallback);
  const dialog = add("dialog", "goku-dialog"); body.append(dialog);
  for (const [tag, id] of [["h2", "goku-title"], ["button", "goku-close"], ["p", "goku-objective"], ["p", "goku-progress"],
    ["div", "goku-scroll"], ["section", "goku-scene"], ["h3", "goku-scene-title"], ["div", "goku-prose"],
    ["p", "goku-memory"], ["div", "goku-choices"], ["details", "goku-journal"], ["ol", "goku-history"],
    ["p", "goku-status"], ["form", "goku-form"], ["input", "goku-input"], ["button", "goku-help"], ["button", "goku-restart"]]) dialog.append(add(tag, id));
  for (const id of ["training-dialog", "arcade-dialog", "theme-dialog"]) body.append(add("dialog", id));
  document = Object.assign(new Element("document"), { documentElement: root, body, activeElement: opener, hidden: false,
    getElementById: id => ids.get(id) || null, createElement: tag => new Element(tag),
    querySelector: selector => selector === "dialog[open]" ? [...ids.values()].find(node => node.tagName === "DIALOG" && node.open) || null
      : selector === "[data-command-open]" ? fallback : null,
  });
  const events = [], window = new Element("window");
  window.dispatchEvent = event => { events.push(event); window.emit(event.type, { detail: event.detail }); };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const noSideEffect = () => { throw new Error("adventure must not start timers, storage, or network activity"); };
  const context = vm.createContext({ window, document, CustomEvent, setTimeout: noSideEffect, requestAnimationFrame: noSideEffect, fetch: noSideEffect });
  vm.runInContext(storySource, context); vm.runInContext(uiSource, context);
  const get = id => ids.get(id), input = get("goku-input"), form = get("goku-form");
  const buttons = () => get("goku-choices").children;
  const button = command => buttons().find(node => node.children[0].textContent === command);
  const click = command => { const node = button(command); assert.ok(node, `available choice ${command}`); node.emit("click"); };
  const type = (command, properties = {}) => {
    input.focus(); input.value = command;
    const event = input.emit("keydown", { key: "Enter", ...properties });
    if (!event.defaultPrevented) form.emit("submit", properties);
    return event;
  };
  const snapshot = () => JSON.stringify({ title: get("goku-scene-title").textContent, prose: get("goku-prose").textContent,
    memory: get("goku-memory").textContent, choices: buttons().map(node => node.textContent), history: get("goku-history").textContent,
    progress: get("goku-progress").textContent });
  return { get, document, window, root, opener, fallback, dialog, input, form, events, buttons, button, click, type, snapshot,
    open: trigger => window.PortfolioGoku.open(trigger ?? opener), close: () => window.PortfolioGoku.close() };
}

test("opening starts at an explicit begin choice, focuses the scene, and suspends site motion without timers", () => {
  const h = setup(); assert.equal(h.open(), true);
  assert.equal(h.dialog.open, true); assert.equal(h.root.dataset.training, "open");
  assert.equal(h.document.activeElement, h.get("goku-scene"));
  assert.ok(h.button("begin")); assert.equal(h.get("goku-progress").textContent, "0 / 3 decisions");
  assert.equal(h.events.at(-1).type, "portfolio:training"); assert.equal(h.events.at(-1).detail.open, true);
  const before = h.snapshot(); h.open(); assert.equal(h.snapshot(), before, "opening twice never resets the episode");
});

test("typed commands and tap choices use the same production story and preserve the appropriate focus", () => {
  const typed = setup(), tapped = setup(); typed.open(); tapped.open();
  typed.type(" :  BeGiN  "); tapped.click("begin");
  assert.equal(typed.snapshot(), tapped.snapshot()); assert.equal(typed.document.activeElement, typed.input);
  assert.equal(tapped.document.activeElement, tapped.get("goku-scene"));
  typed.type("hold"); tapped.click("hold");
  assert.equal(typed.snapshot(), tapped.snapshot()); assert.equal(typed.input.value, "");
  assert.match(typed.get("goku-status").textContent, /pressure.*next:.*available: continue/i, "typed play announces the consequence and available action");
  assert.equal(tapped.get("goku-journal").hidden, false); assert.ok(tapped.get("goku-history").textContent.length);
  assert.equal(tapped.get("goku-scroll").scrollTop, 0);
});

test("invalid input leaves the scene and history intact, while help lists only current actions and utilities", () => {
  const h = setup(); h.open(); h.click("begin"); const before = h.snapshot();
  h.type("<img src=x onerror=alert(1)>"); assert.equal(h.snapshot(), before);
  assert.equal(h.input.value, "<img src=x onerror=alert(1)>");
  h.type("help"); assert.equal(h.snapshot(), before);
  assert.match(h.get("goku-status").textContent, /hold/); assert.match(h.get("goku-status").textContent, /drain/);
  assert.match(h.get("goku-status").textContent, /exit.*restart/);
  h.get("goku-help").emit("click"); assert.equal(h.snapshot(), before);
});

test("detached choices and an empty repeated submit cannot advance another scene", () => {
  const h = setup(); h.open(); const oldBegin = h.button("begin"); oldBegin.emit("click");
  const banks = h.snapshot(); oldBegin.emit("click"); assert.equal(h.snapshot(), banks);
  h.type("hold"); const after = h.snapshot(); h.form.emit("submit"); assert.equal(h.snapshot(), after);
  const oldContinue = h.button("continue"); oldContinue.emit("click"); const survey = h.snapshot();
  oldContinue.emit("click"); assert.equal(h.snapshot(), survey);
});

test("scene changes reset both portrait reading scroll and the landscape dialog scroller", () => {
  const h = setup(); h.open();
  assert.equal(h.input.scrollCalls.length, 0, "opening never raises or scrolls to the software keyboard");
  h.get("goku-scroll").scrollTop = 420; h.dialog.scrollTop = 560;
  h.click("begin");
  assert.equal(h.get("goku-scroll").scrollTop, 0); assert.equal(h.dialog.scrollTop, 0);
  assert.equal(h.input.scrollCalls.length, 0, "tapping a choice starts reading the new scene");
  h.get("goku-scroll").scrollTop = 320; h.dialog.scrollTop = 630;
  h.type("hold");
  assert.equal(h.get("goku-scroll").scrollTop, 0); assert.equal(h.dialog.scrollTop, 0);
  assert.equal(h.document.activeElement, h.input, "scrolling must not summon or dismiss the keyboard by changing focus");
  assert.deepEqual(h.input.scrollCalls, [{ block: "nearest", inline: "nearest", behavior: "instant" }],
    "typed play requests the smallest immediate scroll that keeps its focused prompt visible");
});

test("IME composition, modifier Enter and held Enter do not choose an action", () => {
  const h = setup(); h.open(); const before = h.snapshot();
  for (const property of ["repeat", "isComposing", "ctrlKey", "metaKey", "altKey", "shiftKey"]) {
    assert.equal(h.type("begin", { [property]: true }).defaultPrevented, true);
    assert.equal(h.snapshot(), before);
  }
  assert.equal(h.type("begin", { keyCode: 229 }).defaultPrevented, true);
  h.input.emit("compositionstart"); h.form.emit("submit"); assert.equal(h.snapshot(), before);
  assert.equal(h.type("begin").defaultPrevented, true);
  h.input.emit("compositionend"); h.type("begin"); assert.notEqual(h.snapshot(), before);
});

test("restart keeps progress until confirmed and cancel restores the same scene", () => {
  const h = setup(); h.open(); const originalBegin = h.button("begin"); h.click("begin"); h.click("hold"); const before = h.snapshot();
  h.type("restart"); assert.ok(h.button("confirm")); assert.ok(h.button("cancel"));
  const pending = h.snapshot(); h.type("continue"); assert.equal(h.snapshot(), pending);
  h.type("cancel"); assert.equal(h.snapshot(), before);
  h.get("goku-restart").emit("click"); h.click("confirm");
  assert.ok(h.button("begin")); assert.equal(h.get("goku-journal").hidden, true);
  assert.equal(h.get("goku-progress").textContent, "0 / 3 decisions");
  const restarted = h.snapshot(); originalBegin.emit("click");
  assert.equal(h.snapshot(), restarted, "an old button stays stale even after the story revision resets to zero");
});

test("exit during restart confirmation preserves progress and reopening cancels the pending restart", () => {
  const h = setup(); h.open(); h.click("begin"); h.click("drain"); const before = h.snapshot();
  h.type("restart"); h.type("exit"); assert.equal(h.dialog.open, false);
  assert.equal(h.document.activeElement, h.opener); assert.equal(h.root.dataset.training, undefined);
  assert.equal(h.events.at(-1).detail.open, false);
  h.open(); assert.equal(h.snapshot(), before); assert.equal(h.document.activeElement, h.get("goku-scene"));
});

test("all eight decision routes finish through the same interface with accessible ending actions", () => {
  for (const approach of ["hold", "drain"]) for (const method of ["timing", "probe"]) for (const resolution of ["lift", "pulse"]) {
    const h = setup(); h.open();
    for (const command of ["begin", approach, "continue", method, "continue", resolution]) h.click(command);
    assert.equal(h.get("goku-progress").textContent, "episode complete", `${approach}/${method}/${resolution}`);
    assert.ok(h.get("goku-memory").textContent.length, "ending reflects earlier decisions");
    h.type("help"); assert.match(h.get("goku-status").textContent, /exit.*restart/);
    h.type("exit"); assert.equal(h.document.activeElement, h.opener);
  }
});

test("native Escape and visible close restore a connected opener, with a fallback for detached triggers", () => {
  const h = setup(); h.open(); const event = h.dialog.emit("cancel");
  assert.equal(event.propagationStopped, true); assert.equal(event.defaultPrevented, false);
  assert.equal(h.dialog.open, false); assert.equal(h.document.activeElement, h.opener);
  h.open(); h.opener.isConnected = false; h.get("goku-close").emit("click");
  assert.equal(h.document.activeElement, h.fallback);
});

test("other game/theme modals are not stacked and a queued close cannot disrupt a reopened episode", () => {
  const h = setup();
  for (const id of ["training-dialog", "arcade-dialog", "theme-dialog"]) {
    h.get(id).open = true; assert.equal(h.open(), false); assert.equal(h.dialog.open, false); h.get(id).open = false;
  }
  h.open(); h.click("begin"); const before = h.snapshot();
  h.dialog.open = false; h.open(); h.dialog.emit("close");
  assert.equal(h.dialog.open, true); assert.equal(h.root.dataset.training, "open"); assert.equal(h.snapshot(), before);
  assert.equal(h.document.activeElement, h.get("goku-scene"));
});

test("a remaining game keeps motion suspended and receives no focus steal from Goku cleanup", () => {
  const h = setup(); h.open(); h.get("training-dialog").open = true; h.get("training-dialog").focus(); h.close();
  assert.equal(h.root.dataset.training, "open"); assert.equal(h.events.at(-1).detail.open, true);
  assert.equal(h.document.activeElement, h.get("training-dialog"));
});

test("rotation, visibility and background events cannot advance or reset a deliberate story", () => {
  const h = setup(); h.open(); h.click("begin"); h.click("hold"); const before = h.snapshot();
  h.window.emit("resize"); h.document.hidden = true; h.document.emit("visibilitychange"); h.window.emit("pagehide");
  h.document.hidden = false; h.document.emit("visibilitychange"); h.window.emit("pageshow");
  assert.equal(h.snapshot(), before); assert.equal(h.dialog.open, true);
  h.window.emit("portfolio:view"); assert.equal(h.dialog.open, false); h.open(); assert.equal(h.snapshot(), before);
});
