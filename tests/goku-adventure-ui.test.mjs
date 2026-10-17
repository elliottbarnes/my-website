import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const sources = await Promise.all(["goku-story", "goku-terminal", "goku-adventure"].map(name =>
  readFile(new URL(`../assets/${name}.js`, import.meta.url), "utf8")));

// Execute all three production modules. Only browser event/focus contracts are
// mocked; software-keyboard and viewport geometry still require browser QA.
function setup() {
  let document, currentState;
  class Element {
    constructor(tag = "div", id = "") {
      this.tagName = tag.toUpperCase(); this.id = id; this.handlers = new Map();
      this.children = []; this.parentElement = null; this.dataset = {}; this.attributes = {};
      this._text = ""; this.open = false; this.hidden = false; this.disabled = false;
      this.isConnected = true; this.value = ""; this.scrollTop = 0; this.scrollHeight = 1200; this.scrollCalls = [];
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = String(value); this.replaceChildren(); }
    get firstElementChild() { return this.children[0] || null; }
    append(...children) { for (const child of children) { child.parentElement = this; child.isConnected = this.isConnected; this.children.push(child); } }
    replaceChildren(...children) {
      for (const child of this.children) { child.parentElement = null; child.isConnected = false; }
      this.children = []; this.append(...children);
    }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null; this.isConnected = false;
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
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
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
  for (const [tag, id] of [["h2", "goku-title"], ["button", "goku-close"], ["p", "goku-location"],
    ["div", "goku-output"], ["div", "goku-transcript"], ["nav", "goku-choices"],
    ["p", "goku-status"], ["form", "goku-form"], ["input", "goku-input"]]) dialog.append(add(tag, id));
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
  vm.runInContext(sources[0], context);
  // Observe the genuine state transitions without adding a production debug API.
  const realStory = window.PortfolioGokuStory;
  window.PortfolioGokuStory = { ...realStory,
    create(...args) { currentState = realStory.create(...args); return currentState; },
    choose(...args) { const result = realStory.choose(...args); currentState = result.state; return result; },
  };
  vm.runInContext(sources[1], context); vm.runInContext(sources[2], context);
  const get = id => ids.get(id), input = get("goku-input"), form = get("goku-form");
  const output = get("goku-output"), transcript = get("goku-transcript");
  const buttons = () => get("goku-choices").children;
  const button = command => buttons().find(node => node.dataset.command === command);
  const click = command => { const node = button(command); assert.ok(node, `available command ${command}`); node.emit("click"); };
  const edit = value => { input.value = value; input.emit("input"); };
  const key = (name, properties = {}) => input.emit("keydown", { key: name, ...properties });
  const type = (command, properties = {}) => {
    input.focus(); edit(command); const event = key("Enter", properties);
    if (!event.defaultPrevented) form.emit("submit", properties);
    return event;
  };
  const state = () => JSON.parse(JSON.stringify(currentState));
  const last = () => transcript.children.at(-1);
  return { get, document, window, root, opener, fallback, dialog, input, form, events, output, transcript,
    buttons, button, click, edit, key, type, state, last,
    open: trigger => window.PortfolioGoku.open(trigger ?? opener), close: () => window.PortfolioGoku.close() };
}

test("opening shows a terminal scene with decorative ASCII, explicit begin, and no automatic input or timers", () => {
  const h = setup(); assert.equal(h.open(), true);
  assert.equal(h.dialog.open, true); assert.equal(h.root.dataset.training, "open");
  assert.equal(h.document.activeElement, h.output); assert.equal(h.state().revision, 0);
  assert.ok(h.button("begin")); assert.ok(h.button("help"));
  assert.match(h.transcript.textContent, /capsule corp.*You are Goku/s);
  const art = h.last().children.find(node => node.className === "goku-ascii");
  assert.equal(art.tagName, "PRE"); assert.equal(art.getAttribute("aria-hidden"), "true");
  assert.ok(art.textContent.includes("\n"));
  assert.equal(h.events.at(-1).type, "portfolio:training"); assert.equal(h.events.at(-1).detail.open, true);
  const entries = [...h.transcript.children]; h.open(); assert.deepEqual(h.transcript.children, entries);
  assert.equal(h.input.scrollCalls.length, 0);
});

test("typed verbs and compact tappable commands apply identical decisions and append rather than replace prior output", () => {
  const typed = setup(), tapped = setup(); typed.open(); tapped.open();
  const entries = [...typed.transcript.children]; typed.type(" :  BeGiN  "); tapped.click("begin");
  assert.deepEqual(typed.state(), tapped.state()); assert.equal(typed.document.activeElement, typed.input);
  assert.equal(tapped.document.activeElement, tapped.output);
  assert.deepEqual(typed.transcript.children.slice(0, entries.length), entries);
  assert.equal(typed.last().children[0].textContent, "> begin");
  typed.type("brace gate"); tapped.click("brace gate");
  assert.deepEqual(typed.state(), tapped.state()); assert.equal(typed.input.value, "");
  assert.match(typed.last().textContent, /frame stops twisting.*still pounds/s);
  assert.match(typed.get("goku-status").textContent, /available: continue/);
  assert.deepEqual(typed.input.scrollCalls.at(-1), { block: "nearest", inline: "nearest", behavior: "instant" });
  assert.equal(tapped.output.scrollTop, tapped.output.scrollHeight);
});

test("inspection verbs append relevant replies while preserving every story choice and revision", () => {
  const h = setup(); h.open(); h.type("begin"); h.type("brace gate"); const state = h.state();
  for (const command of ["look", "look gate", "look rock", "look channel", "talk", "talk bulma", "map", "status", "read", "help"]) {
    const count = h.transcript.children.length; h.type(command);
    assert.deepEqual(h.state(), state, command); assert.equal(h.transcript.children.length, count + 1, command);
    assert.equal(h.last().children[0].textContent, `> ${command}`); assert.ok(h.last().children.length > 1);
  }
  for (const command of ["look", "talk bulma", "map", "status", "read"]) assert.ok(h.button(command), `${command} becomes tappable through help`);
  assert.match(h.last().textContent, /clear.*keep progress/);
});

test("clear erases the display alone and redraws the current room without resetting preparations", () => {
  const h = setup(); h.open(); h.type("begin"); h.type("clear channel"); h.type("continue");
  const before = h.state(), previous = [...h.transcript.children]; h.type("clear");
  assert.deepEqual(h.state(), before); assert.equal(h.transcript.children.length, 1);
  assert.ok(previous.every(entry => !h.transcript.children.includes(entry)));
  assert.equal(h.last().children[0].textContent, "> clear"); assert.ok(h.button("wait")); assert.ok(h.button("probe rock"));
  h.type("status"); assert.match(h.last().textContent, /relieved pressure; unsupported frame/);
  assert.deepEqual(h.state(), before);
});

test("map renders as one preformatted block so its branches and current-position marker keep their alignment", () => {
  const h = setup(); h.open(); const before = h.state(); h.type("map");
  const map = h.last().children.find(node => node.className === "goku-map");
  assert.ok(map, "the ASCII map needs a preformatted block, not separately wrapped paragraphs");
  assert.equal(map.tagName, "PRE"); assert.ok(map.textContent.startsWith("      [mountain reservoir]"));
  assert.ok(map.textContent.split("\n").length >= 7); assert.match(map.textContent, /<- you/);
  assert.deepEqual(h.state(), before);
});

test("invalid input is literal transcript text and preserves state while blank submits add no duplicate turn", () => {
  const h = setup(); h.open(); h.click("begin"); const before = h.state();
  h.type("<img src=x onerror=alert(1)>"); assert.deepEqual(h.state(), before);
  assert.equal(h.last().children[0].textContent, "> <img src=x onerror=alert(1)>");
  assert.ok(h.last().children.every(node => node.tagName !== "IMG")); assert.match(h.last().textContent, /try brace gate or clear channel/);
  const count = h.transcript.children.length; h.form.emit("submit"); assert.equal(h.transcript.children.length, count);
  assert.deepEqual(h.state(), before); assert.match(h.get("goku-status").textContent, /type a command/);
});

test("old command buttons cannot advance a new scene or a restarted story with the same revision", () => {
  const h = setup(); h.open(); const oldBegin = h.button("begin"); oldBegin.emit("click");
  const banks = h.state(), count = h.transcript.children.length; oldBegin.emit("click");
  assert.deepEqual(h.state(), banks); assert.equal(h.transcript.children.length, count);
  h.type("brace gate"); const oldContinue = h.button("continue"); oldContinue.emit("click");
  const survey = h.state(); oldContinue.emit("click"); assert.deepEqual(h.state(), survey);
  h.type("restart"); h.click("confirm"); oldBegin.emit("click");
  assert.equal(h.state().node, "arrival"); assert.equal(h.state().revision, 0);
  const freshBegin = h.button("begin"); h.type("clear"); freshBegin.emit("click"); assert.equal(h.state().revision, 0);
});

test("history preserves an unfinished draft, handles its boundaries and never executes recalled commands", () => {
  const h = setup(); h.open(); h.type("begin"); h.type("look"); h.type("look"); h.edit("sta");
  const before = h.state(), count = h.transcript.children.length;
  assert.equal(h.key("ArrowUp").defaultPrevented, true); assert.equal(h.input.value, "look");
  h.key("ArrowUp"); assert.equal(h.input.value, "begin", "consecutive duplicates occupy one history slot");
  h.key("ArrowUp"); assert.equal(h.input.value, "begin");
  h.key("ArrowDown"); assert.equal(h.input.value, "look");
  h.key("ArrowDown"); assert.equal(h.input.value, "sta");
  h.key("ArrowDown"); assert.equal(h.input.value, "sta");
  assert.equal(h.input.selectionStart, 3); assert.equal(h.input.selectionEnd, 3);
  assert.deepEqual(h.state(), before); assert.equal(h.transcript.children.length, count);
  h.key("ArrowUp"); h.edit("look gate"); h.key("ArrowUp"); h.key("ArrowDown"); assert.equal(h.input.value, "look gate");
});

test("command history and scrollback are bounded independently without changing story state", () => {
  const h = setup(); h.open(); const before = h.state();
  for (let index = 0; index < 95; index++) h.type(`unknown${index}`);
  assert.equal(h.transcript.children.length, 80); assert.deepEqual(h.state(), before);
  assert.match(h.transcript.children[0].textContent, /^> unknown15/); assert.match(h.last().textContent, /^> unknown94/);
  for (let index = 0; index < 60; index++) h.key("ArrowUp");
  assert.equal(h.input.value, "unknown45", "only the latest 50 commands remain recallable");
});

test("Tab completes unique prefixes and leaves native focus navigation for empty, ambiguous, complete or unknown commands", () => {
  const h = setup(); h.open(); h.edit("beg");
  assert.equal(h.key("Tab").defaultPrevented, true); assert.equal(h.input.value, "begin"); assert.equal(h.state().revision, 0);
  for (const value of ["", "look", "loo", "begin", "nonsense"]) {
    h.edit(value); assert.equal(h.key("Tab").defaultPrevented, false, value); assert.equal(h.input.value, value);
  }
  h.edit("beg"); assert.equal(h.key("Tab", { shiftKey: true }).defaultPrevented, false); assert.equal(h.input.value, "beg");
  h.type("begin"); h.edit("brace"); assert.equal(h.key("Tab").defaultPrevented, true); assert.equal(h.input.value, "brace gate");
});

test("IME composition, modifiers and held Enter never execute, recall or complete a command", () => {
  const h = setup(); h.open(); const before = h.state(), count = h.transcript.children.length;
  for (const property of ["repeat", "isComposing", "ctrlKey", "metaKey", "altKey", "shiftKey"]) {
    assert.equal(h.type("begin", { [property]: true }).defaultPrevented, true);
    assert.deepEqual(h.state(), before); assert.equal(h.transcript.children.length, count);
  }
  assert.equal(h.type("begin", { keyCode: 229 }).defaultPrevented, true);
  h.input.emit("compositionstart"); h.form.emit("submit"); assert.deepEqual(h.state(), before);
  h.edit("beg"); assert.equal(h.key("Tab").defaultPrevented, false); assert.equal(h.input.value, "beg");
  h.input.emit("compositionend"); h.type("begin"); h.edit("sta");
  assert.equal(h.key("ArrowUp", { altKey: true }).defaultPrevented, false); assert.equal(h.input.value, "sta");
  assert.equal(h.key("ArrowUp", { repeat: true }).defaultPrevented, false); assert.equal(h.input.value, "sta");
});

test("restart requires confirmation; cancel and exit keep the story and inspection never bypasses the pending choice", () => {
  const h = setup(); h.open(); h.type("begin"); h.type("brace gate"); const before = h.state();
  h.type("restart"); assert.ok(h.button("confirm")); assert.ok(h.button("cancel"));
  h.type("continue"); assert.deepEqual(h.state(), before); assert.match(h.last().textContent, /restart is waiting/);
  h.type("look"); assert.deepEqual(h.state(), before); assert.match(h.last().textContent, /restart is waiting/);
  h.click("cancel"); assert.deepEqual(h.state(), before); assert.ok(h.button("continue"));
  h.type("restart"); h.click("confirm"); assert.equal(h.state().node, "arrival"); assert.equal(h.state().revision, 0);
  assert.equal(h.transcript.children.length, 1); assert.equal(h.last().children[0].textContent, "> restart");
  h.edit("unsent"); assert.equal(h.key("ArrowUp").defaultPrevented, false, "restart resets input history deliberately");
});

test("closing and reopening retains state and transcript but cancels a pending restart", () => {
  const h = setup(); h.open(); h.type("begin"); h.type("clear channel"); const before = h.state();
  h.type("restart"); const entries = [...h.transcript.children]; h.type("exit");
  assert.equal(h.dialog.open, false); assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.root.dataset.training, undefined); assert.equal(h.events.at(-1).detail.open, false);
  h.open(); assert.deepEqual(h.state(), before); assert.equal(h.document.activeElement, h.output);
  assert.deepEqual(h.transcript.children.slice(0, entries.length), entries); assert.match(h.last().textContent, /session resumed/);
  assert.ok(h.button("continue")); assert.equal(h.button("confirm"), undefined);
});

test("all eight decision routes finish using the advertised terminal verbs", () => {
  for (const approach of ["brace gate", "clear channel"]) for (const method of ["wait", "probe rock"]) for (const resolution of ["lift gate", "ki pulse"]) {
    const h = setup(); h.open();
    for (const command of ["begin", approach, "continue", method, "continue", resolution]) h.click(command);
    assert.equal(h.state().node, "ending", `${approach}/${method}/${resolution}`); assert.equal(h.state().revision, 6);
    assert.match(h.last().textContent, /Village saved/); assert.match(h.get("goku-location").textContent, /^@ village$/);
    assert.ok(h.button("restart")); assert.ok(h.button("exit"));
    h.type("status"); assert.match(h.last().textContent, /village: safe/);
    h.click("exit"); assert.equal(h.document.activeElement, h.opener);
  }
});

test("native Escape and visible exit restore a connected opener, with a fallback for detached triggers", () => {
  const h = setup(); h.open(); const event = h.dialog.emit("cancel");
  assert.equal(event.propagationStopped, true); assert.equal(event.defaultPrevented, false);
  assert.equal(h.dialog.open, false); assert.equal(h.document.activeElement, h.opener);
  h.open(); h.opener.isConnected = false; h.get("goku-close").emit("click");
  assert.equal(h.document.activeElement, h.fallback);
});

test("other modals are not stacked and a queued close cannot disrupt a reopened terminal", () => {
  const h = setup();
  for (const id of ["training-dialog", "arcade-dialog", "theme-dialog"]) {
    h.get(id).open = true; assert.equal(h.open(), false); assert.equal(h.dialog.open, false); h.get(id).open = false;
  }
  h.open(); h.click("begin"); const before = h.state();
  h.dialog.open = false; h.open(); h.dialog.emit("close");
  assert.equal(h.dialog.open, true); assert.equal(h.root.dataset.training, "open"); assert.deepEqual(h.state(), before);
  assert.equal(h.document.activeElement, h.output);
});

test("another remaining game keeps motion suspended and receives no focus steal", () => {
  const h = setup(); h.open(); h.get("training-dialog").open = true; h.get("training-dialog").focus(); h.close();
  assert.equal(h.root.dataset.training, "open"); assert.equal(h.events.at(-1).detail.open, true);
  assert.equal(h.document.activeElement, h.get("training-dialog"));
});

test("rotation, visibility and backgrounding cannot advance or rewrite terminal history", () => {
  const h = setup(); h.open(); h.click("begin"); h.click("brace gate");
  const before = h.state(), entries = [...h.transcript.children];
  h.window.emit("resize"); h.document.hidden = true; h.document.emit("visibilitychange"); h.window.emit("pagehide");
  h.document.hidden = false; h.document.emit("visibilitychange"); h.window.emit("pageshow");
  assert.deepEqual(h.state(), before); assert.deepEqual(h.transcript.children, entries); assert.equal(h.dialog.open, true);
  h.window.emit("portfolio:view"); assert.equal(h.dialog.open, false); h.open(); assert.deepEqual(h.state(), before);
});
