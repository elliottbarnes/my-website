import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/themes.js", import.meta.url), "utf8");

// A small DOM boundary for exercising the shipped controller without a browser
// dependency. Layout and native touch scrolling still require browser checks.
function setup({ compact = false, saved = null, denyStorage = false } = {}) {
  let document;
  const events = [];
  const storage = { theme: saved };
  class Node {
    constructor(tag) {
      this.tagName = tag;
      this.attributes = {};
      this.dataset = {};
      this.children = [];
      this.handlers = {};
      this.parentElement = null;
      this.textContent = "";
      this.value = "";
      this.scrollTop = 0;
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
    }
    get id() { return this.attributes.id; }
    get open() { return this.hasAttribute("open"); }
    get isConnected() { return this === root || Boolean(this.parentElement?.isConnected); }
    get clientHeight() { return this.id === "theme-picker-options" ? (compact ? 256 : 104) : 0; }
    get offsetHeight() { return compact ? 32 : 13; }
    get offsetTop() { return Math.max(0, this.parentElement?.children.indexOf(this) ?? 0) * this.offsetHeight; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
    removeAttribute(key) { delete this.attributes[key]; }
    append(...nodes) {
      for (const child of nodes) { child.parentElement = this; this.children.push(child); }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.scrollTop = 0;
      this.append(...nodes);
    }
    focus() { document.activeElement = this; }
    showModal() {
      this.setAttribute("open", "");
      // Model the initial native-dialog focus step, before the explicit focus.
      descendants(this).find((child) => child.autofocus)?.focus();
    }
    close() { this.removeAttribute("open"); }
    getBoundingClientRect() { return { left: 100, right: 432, top: 100, bottom: 269 }; }
    addEventListener(type, handler) { (this.handlers[type] ??= []).push(handler); }
    emit(type, properties = {}) {
      const event = {
        target: this,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        ...properties,
      };
      for (const handler of this.handlers[type] || []) handler(event);
      return event;
    }
    matches(selector) {
      if (selector === 'meta[name="theme-color"]') return this.tagName === "meta";
      const match = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
      return match && this.hasAttribute(match[1]) && (match[2] === undefined || this.attributes[match[1]] === match[2]);
    }
  }
  function descendants(node) { return node.children.flatMap((child) => [child, ...descendants(child)]); }
  const root = new Node("html");
  const body = new Node("body");
  const button = new Node("button");
  button.setAttribute("data-theme-toggle", "");
  root.append(body);
  body.append(button);
  document = {
    documentElement: root, body, activeElement: button,
    createElement: (tag) => new Node(tag),
    querySelectorAll: (selector) => descendants(root).filter((node) => node.matches(selector)),
    querySelector: (selector) => descendants(root).find((node) => node.matches(selector)) || null,
  };
  const window = {
    matchMedia: () => ({ matches: compact }),
    localStorage: {
      getItem() { if (denyStorage) throw new Error("Storage denied"); return storage.theme; },
      setItem(key, value) { if (denyStorage) throw new Error("Storage denied"); storage.theme = value; },
    },
    dispatchEvent: (event) => events.push(event),
  };
  class CustomEvent { constructor(type, { detail }) { this.type = type; this.detail = detail; } }
  vm.runInNewContext(source, { document, window, CustomEvent });
  const find = (predicate) => descendants(root).find(predicate);
  const get = (id) => find((node) => node.id === id);
  const dialog = get("theme-dialog");
  const input = get("theme-picker-search");
  const list = get("theme-picker-options");
  const cancel = find((node) => node.getAttribute("class") === "theme-picker-cancel");
  const key = (value, target = input) => dialog.emit("keydown", { key: value, target });
  const search = (value) => { input.value = value; input.emit("input"); };
  return { api: window.PortfolioThemes, root, button, dialog, input, list, cancel, key, search, document, storage, events };
}

test("all 28 themes remain in the scrollable list and touch pointers keep native behavior", () => {
  const page = setup();
  page.button.emit("click");
  assert.equal(page.document.activeElement, page.input);
  assert.equal(page.list.children.length, 28);
  assert.equal(page.list.children.at(-1).getAttribute("data-theme-option"), "whitegold");
  assert.equal(page.list.handlers.wheel, undefined, "scrolling must not be hijacked to select or repaint rows");
  const row = page.list.children[0];
  assert.equal(row.emit("pointerdown", { pointerType: "touch" }).defaultPrevented, undefined);
  assert.equal(row.emit("pointerdown", { pointerType: "mouse" }).defaultPrevented, true);
  assert.equal(page.api.current, "blackmoney");
  assert.equal(page.api.label, "terminal");
  assert.equal(page.button.getAttribute("aria-label"), "Choose colorscheme; current theme: terminal");
  const labels = page.list.children.map((row) => row.children[1].textContent);
  assert.equal(new Set(labels).size, 28);
  assert.ok(labels.every((label) => label && label.length <= 14));
});

test("keyboard previews stay transient, reveal offscreen options, and Escape restores the saved theme", () => {
  const page = setup({ saved: "blackmoney" });
  page.api.open();
  for (let index = 0; index < 8; index++) page.key("ArrowDown");
  assert.equal(page.api.current, "kanso");
  assert.equal(page.input.getAttribute("aria-activedescendant"), "theme-option-kanso");
  assert.ok(page.list.scrollTop > 0, "keyboard selection must be revealed beyond the first eight rows");
  assert.equal(page.storage.theme, "blackmoney");
  page.key("Escape");
  assert.equal(page.api.current, "blackmoney");
  assert.equal(page.storage.theme, "blackmoney");
  assert.equal(page.dialog.open, false);
  assert.equal(page.document.activeElement, page.button);
});

test("search previews and explicit selection commits without evaluating query text", () => {
  const page = setup({ saved: "blackmoney" });
  page.api.open();
  page.search("WHITE");
  assert.equal(page.list.children.length, 1);
  assert.equal(page.api.current, "whitegold");
  assert.equal(page.api.label, "paperwhite");
  assert.equal(page.storage.theme, "blackmoney");
  page.list.children[0].emit("click");
  assert.equal(page.storage.theme, "whitegold");
  assert.equal(page.dialog.open, false);
  page.api.open();
  page.search("<img src=x onerror=alert(1)>");
  assert.equal(page.list.children[0].textContent, "no match");
  assert.equal(page.input.getAttribute("aria-activedescendant"), null);
  page.search("blue hour");
  page.key("Enter");
  assert.equal(page.storage.theme, "sapphire");
  assert.equal(page.api.apply("parchment"), true);
  assert.equal(page.api.current, "roseofdune", "a displayed name must take priority over a legacy command alias");
  assert.equal(page.api.apply("blue hour"), true);
  assert.equal(page.storage.theme, "sapphire", "renamed commands still store stable IDs");
  assert.equal(setup({ saved: "parchment" }).api.current, "whitegold", "old stored aliases retain their original colours");
});

test("compact opening avoids the search keyboard and offers a real Cancel action", () => {
  const page = setup({ compact: true, saved: "whitegold" });
  page.api.open();
  assert.equal(page.document.activeElement, page.cancel);
  assert.equal(page.cancel.autofocus, true);
  assert.equal(page.input.autofocus, false);
  assert.equal(page.list.children.length, 28);
  assert.ok(page.list.scrollTop > 0, "a saved theme near the end should be visible on opening");
  assert.equal(page.key("Tab", page.cancel).defaultPrevented, undefined, "Tab should reach the search field");
  assert.equal(page.key("Enter", page.cancel).defaultPrevented, undefined, "native button activation should reach Cancel");
  page.search("terminal");
  page.cancel.emit("click");
  assert.equal(page.api.current, "whitegold");
  assert.equal(page.storage.theme, "whitegold");
  assert.equal(page.document.activeElement, page.button);
});

test("storage denial does not break commit or native dialog cancellation", () => {
  const page = setup({ denyStorage: true });
  page.api.open();
  page.search("sea glass");
  page.key("Enter");
  assert.equal(page.api.current, "harbor");
  page.api.open();
  page.search("terminal");
  assert.equal(page.dialog.emit("cancel").defaultPrevented, true);
  assert.equal(page.api.current, "harbor");
  assert.equal(page.root.dataset.theme, "harbor");
  assert.equal(page.events.at(-1).type, "portfolio:theme-picker");
  assert.equal(page.events.at(-1).detail.open, false);
});
