import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");

function browser({ saved = null, storageBlocked = false, reducedMotion = false, noToggle = false } = {}) {
  const listeners = {}, attrs = {}, scrolls = [];
  const state = { effectsOff: false, stored: null };
  const toggle = { setAttribute: (key, value) => attrs[key] = value, getAttribute: (key) => attrs[key], addEventListener: (name, listener) => listeners[name] = listener };
  const label = { textContent: "" }, year = { textContent: "" };
  const links = ["work", "toolkit", "contact"].map((id, index) => ({ dataset: { shortcut: String(index + 1) }, getAttribute: () => `#${id}` }));
  class Element {
    constructor(tagName = "BODY", editable = false) { this.tagName = tagName; this.isContentEditable = editable; }
  }
  const document = {
    body: { classList: { toggle: (name, value) => { assert.equal(name, "fx-off"); state.effectsOff = value; } } },
    querySelector: (selector) => {
      if (selector === "[data-fx-toggle]") return noToggle ? null : toggle;
      if (selector === "[data-fx-label]") return noToggle ? null : label;
      if (selector === "[data-current-year]") return year;
      if (["#work", "#toolkit", "#contact"].includes(selector)) return { scrollIntoView: (options) => scrolls.push({ selector, behavior: options.behavior }) };
      return null;
    },
    querySelectorAll: () => links,
    addEventListener: (name, listener) => listeners[name] = listener,
  };
  const localStorage = {
    getItem: (key) => { assert.equal(key, "elliott-crt-effects"); if (storageBlocked) throw new Error("unavailable"); return saved; },
    setItem: (key, value) => { assert.equal(key, "elliott-crt-effects"); if (storageBlocked) throw new Error("unavailable"); state.stored = value; },
  };
  vm.runInNewContext(source, { document, localStorage, HTMLElement: Element, window: { matchMedia: () => ({ matches: reducedMotion }) }, Date });
  function key(key, extra = {}) {
    let prevented = false;
    listeners.keydown({ key, target: new Element(), preventDefault: () => prevented = true, ...extra });
    return prevented;
  }
  return { state, attrs, label, year, listeners, scrolls, key, Element };
}

test("texture starts off unless the existing preference explicitly enables it", () => {
  for (const [saved, enabled] of [[null, false], ["on", true], ["off", false], ["invalid", false]]) {
    const current = browser({ saved });
    assert.equal(current.state.effectsOff, !enabled);
    assert.equal(current.attrs["aria-pressed"], String(enabled));
    assert.equal(current.attrs["aria-label"], "Screen texture");
    assert.equal(current.label.textContent, enabled ? "Texture: on" : "Texture: off");
  }
});

test("texture toggle updates visible state, accessibility state, and stored preference", () => {
  const current = browser();
  current.listeners.click();
  assert.equal(current.state.effectsOff, false);
  assert.equal(current.attrs["aria-pressed"], "true");
  assert.equal(current.label.textContent, "Texture: on");
  assert.equal(current.state.stored, "on");
  current.listeners.click();
  assert.equal(current.state.effectsOff, true);
  assert.equal(current.state.stored, "off");
});

test("blocked storage does not prevent toggling", () => {
  const current = browser({ storageBlocked: true });
  assert.equal(current.state.effectsOff, true);
  current.listeners.click();
  assert.equal(current.state.effectsOff, false);
});

test("shortcuts 1–3 navigate to the corresponding sections", () => {
  const current = browser();
  for (const key of ["1", "2", "3"]) assert.equal(current.key(key), true);
  assert.deepEqual(current.scrolls, ["#work", "#toolkit", "#contact"].map((selector) => ({ selector, behavior: "smooth" })));
  assert.equal(current.key("9"), false);
});

test("reduced-motion preference disables smooth shortcut scrolling", () => {
  const current = browser({ reducedMotion: true });
  current.key("1");
  assert.deepEqual(current.scrolls, [{ selector: "#work", behavior: "auto" }]);
});

test("typing targets and modified keys retain their normal behavior", () => {
  const current = browser();
  for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(current.key("1", { target: new current.Element(tag) }), false);
  assert.equal(current.key("1", { target: new current.Element("DIV", true) }), false);
  for (const modifier of ["altKey", "ctrlKey", "metaKey"]) assert.equal(current.key("1", { [modifier]: true }), false);
  assert.deepEqual(current.scrolls, []);
});

test("optional missing toggle does not break shortcuts or year", () => {
  const current = browser({ noToggle: true });
  assert.equal(String(current.year.textContent), String(new Date().getFullYear()));
  assert.equal(current.key("2"), true);
});
