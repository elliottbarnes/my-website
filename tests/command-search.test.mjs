import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const text = value => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

// Run the actual controller against the current public project copy. This
// fixture models only the native DOM operations the command menu needs.
function setup({ unlocked = false } = {}) {
  let document;
  class Element {}
  class Node extends Element {
    constructor(tag = "div", properties = {}) {
      super();
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
      this.attributes = new Map(); this.handlers = new Map(); this._text = "";
      this.style = { setProperty() {} }; this.hidden = false; this.isConnected = true;
      this.open = false; this.value = ""; Object.assign(this, properties);
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this._text = String(value); this.children = []; }
    append(...children) { children.forEach(child => {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(sibling => sibling !== child);
      child.parentElement = this; this.children.push(child);
    }); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) {
      if (name === "id") return this.id || null;
      if (name === "class") return this.className || null;
      if (name.startsWith("data-")) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? this.attributes.get(name) ?? null;
      return this.attributes.get(name) ?? null;
    }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) { this.attributes.delete(name); }
    matches(selector) {
      if (selector.startsWith("#")) return this.id === selector.slice(1);
      if (selector.startsWith(".")) return this.className?.split(" ").includes(selector.slice(1));
      const attribute = selector.match(/^\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
      if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
      return this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector) {
      const selectors = selector.split(",").map(part => part.trim());
      const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll("*")]);
      return selector === "*" ? descendants : descendants.filter(child => selectors.some(part => child.matches(part)));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) {
      const selectors = selector.split(",").map(part => part.trim());
      for (let node = this; node; node = node.parentElement) if (selectors.some(part => node.matches(part))) return node;
      return null;
    }
    contains(child) { for (let node = child; node; node = node.parentElement) if (node === this) return true; return false; }
    addEventListener(type, callback) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(callback); }
    emit(type, properties = {}) {
      const event = { target: this, currentTarget: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...properties };
      for (const callback of this.handlers.get(type) || []) callback(event);
      if (type === "cancel" && !event.defaultPrevented) this.close();
      return event;
    }
    focus() { document.activeElement = this; this.emit("focus"); }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.emit("close"); }
  }
  const root = new Node("html"), body = new Node("body"); root.append(body);
  const entrance = new Node("section", { id: "entrance" });
  const enter = new Node("a", { dataset: { enter: "" } }); entrance.append(enter);
  const workspace = new Node("section", { id: "workspace" });
  workspace.append(new Node("div", { className: "terminal" }));
  body.append(entrance, workspace);
  for (const match of html.matchAll(/<article\b[^>]*data-panel="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const panel = new Node("article", { dataset: { panel: match[1] } });
    const title = match[2].match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    if (title) panel.append(new Node("h2", { textContent: text(title) }));
    for (const className of ["project-kind", "project-description", "about-text"]) {
      const copy = match[2].match(new RegExp(`<p class="${className}">([\\s\\S]*?)<\\/p>`))?.[1];
      if (copy) panel.append(new Node("p", { className, textContent: text(copy) }));
    }
    workspace.append(panel);
  }
  const opener = new Node("button", { dataset: { commandOpen: "" } }); body.append(opener);
  const dialog = new Node("dialog", { id: "command-dialog" });
  const form = new Node("form", { id: "command-form" });
  const input = new Node("input", { id: "command-input" }); form.append(input);
  const results = new Node("div", { className: "command-options" });
  for (const match of html.matchAll(/<button[^>]*data-command="([^"]+)"[^>]*>([^<]*)<\/button>/g)) {
    results.append(new Node("button", { dataset: { command: match[1] }, textContent: text(match[2]) }));
  }
  const feedback = new Node("p", { id: "command-feedback" });
  dialog.append(form, results, feedback); body.append(dialog);
  const summonButton = new Node("button", { dataset: { radarSummon: "" } }); workspace.append(summonButton);
  document = Object.assign(new Node("document"), {
    documentElement: root, body, activeElement: opener,
    querySelectorAll: selector => root.querySelectorAll(selector),
    querySelector: selector => root.querySelector(selector),
    getElementById: id => root.querySelector(`#${id}`), createElement: tag => new Node(tag),
  });
  const calls = { training: 0, summons: 0, themes: [], ecdsa: [] };
  const window = new Node("window");
  Object.assign(window, { location: { hash: "" }, localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {}, dispatchEvent() {},
    PortfolioTraining: { open: () => { calls.training++; } },
    PortfolioAnimation: { openECDSA: () => calls.ecdsa.push({ dialogOpen: dialog.open, view: root.dataset.view, hash: window.location.hash }) },
    PortfolioRadar: { unlocked, summon: () => { calls.summons++; return unlocked; } },
    PortfolioThemes: { current: "blackmoney", label: "saiyan", names: ["blackmoney", "carbon"], labels: ["saiyan", "carbon"],
      apply: name => calls.themes.push(name), open: () => calls.themes.push("picker") },
  });
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source, { document, window, Element, CustomEvent });
  const search = (value, properties) => { input.value = value; input.emit("input", properties); };
  const visible = () => results.children.filter(button => !button.hidden).sort((a, b) => Number(a.style.order) - Number(b.style.order));
  const submit = properties => form.emit("submit", properties);
  const key = (value, properties) => input.emit("keydown", { key: value, ...properties });
  const escape = () => { document.emit("keydown", { key: "Escape", target: input }); dialog.emit("cancel"); };
  opener.emit("click");
  return { root, window, document, opener, input, dialog, results, feedback, calls, summonButton, search, visible, submit, key, escape };
}

test("project ideas find genuine projects using current public descriptions without navigating while typing", () => {
  for (const [query, route] of [["compiler", "glassbox"], ["mac", "architecture-lab"], ["regex", "automata-lab"],
    ["batching", "batchline"], ["attention", "ellmiott"], ["output contracts", "evaldeck"]]) {
    const page = setup(); page.search(query);
    assert.equal(page.visible()[0].dataset.command, route, query);
    assert.equal(page.window.location.hash, "", "typing is never navigation");
    assert.equal(page.dialog.open, true);
    page.submit(); assert.equal(page.window.location.hash, `#${route}`);
  }
});

test("prefixes, multiword queries, deterministic ranking, and arrow selection choose a visible result", () => {
  const page = setup(); page.search(" :  COMPILER ");
  assert.deepEqual(page.visible().slice(0, 3).map(button => button.dataset.command), ["glassbox", "pixel-language", "automata-lab"]);
  assert.equal(page.visible()[0].dataset.searchActive, "true");
  assert.equal(page.key("ArrowDown").defaultPrevented, true);
  assert.equal(page.visible()[1].dataset.searchActive, "true");
  page.submit(); assert.equal(page.window.location.hash, "#pixel-language");
  const another = setup(); another.search("/regular expression"); another.submit();
  assert.equal(another.window.location.hash, "#automata-lab");
});

test("empty input retains ordinary buttons and deliberate arrow selection can be submitted", () => {
  const page = setup();
  assert.equal(page.visible().length, 13);
  assert.equal(page.results.dataset.searching, "false");
  assert.ok(page.visible().every(button => button.dataset.searchActive === "false"));
  page.key("ArrowDown"); page.submit();
  assert.equal(page.window.location.hash, "#about");
  const last = setup(); last.key("ArrowUp");
  assert.equal(last.visible().at(-1).dataset.searchActive, "true");
});

test("exact commands and theme aliases win over search selection", () => {
  const page = setup(); page.search(":pixel"); page.key("ArrowDown"); page.submit();
  assert.equal(page.window.location.hash, "#pixel-language");
  for (const name of ["saiyan", "blackmoney"]) {
    const theme = setup(); theme.search(`theme ${name}`); theme.submit();
    assert.deepEqual(theme.calls.themes, [name]);
    assert.equal(theme.window.location.hash, "");
  }
});

test("unknown and punctuation-only searches do not navigate or clear the query", () => {
  for (const query of ["does-not-exist", "!!!", "<img onerror=alert(1)>"]) {
    const page = setup(); page.search(query); page.submit();
    assert.equal(page.visible().length, 0);
    assert.equal(page.window.location.hash, "");
    assert.equal(page.input.value, query);
    assert.match(page.feedback.textContent, /no matching/);
  }
  const reserved = setup(); reserved.search("?"); reserved.submit();
  assert.match(reserved.feedback.textContent, /Commands:/);
});

test("IME composition and modifier shortcuts never choose a result", () => {
  const page = setup(); page.search("compiler");
  assert.equal(page.key("ArrowDown", { ctrlKey: true }).defaultPrevented, false);
  assert.equal(page.visible()[0].dataset.searchActive, "true");
  page.input.emit("compositionstart"); page.submit();
  assert.equal(page.window.location.hash, "");
  assert.equal(page.key("Enter", { isComposing: true }).defaultPrevented, true);
  page.input.emit("compositionend");
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
    page.submit({ [modifier]: true });
    assert.equal(page.window.location.hash, "");
  }
  page.submit(); assert.equal(page.window.location.hash, "#glassbox");
});

test("native result buttons, feedback relationships, and Escape focus restoration stay intact", () => {
  const page = setup(); page.search("batching");
  assert.equal(page.input.getAttribute("aria-controls"), page.results.id);
  assert.equal(page.input.getAttribute("aria-describedby"), "command-feedback");
  assert.equal(page.input.getAttribute("role"), null);
  assert.equal(page.results.getAttribute("role"), "group");
  assert.equal(page.visible()[0].tagName, "BUTTON");
  page.visible()[0].emit("click"); assert.equal(page.window.location.hash, "#batchline");
  const cancelled = setup(); cancelled.search("mac"); cancelled.escape();
  assert.equal(cancelled.document.activeElement, cancelled.opener);
  assert.equal(cancelled.window.location.hash, "");
});

test("native Tab order matches ranked search results and resets with the empty query", () => {
  const page = setup();
  const original = page.results.children.map(button => button.dataset.command);
  page.search("checks");
  assert.equal(page.results.children[0].dataset.command, "evaldeck");
  assert.deepEqual(page.results.children.filter(button => !button.hidden).map(button => button.dataset.command),
    page.visible().map(button => button.dataset.command));
  page.search("");
  assert.deepEqual(page.results.children.map(button => button.dataset.command), original);
  assert.equal(page.results.children.length, 13, "existing buttons are moved, never duplicated");
});

test("native button focus synchronizes the highlighted and announced result without moving its DOM node", () => {
  const page = setup(); page.search("compiler");
  const buttons = page.visible();
  const originalOrder = [...page.results.children];
  assert.equal(buttons[0].dataset.searchActive, "true");
  buttons[1].focus();
  assert.equal(page.document.activeElement, buttons[1]);
  assert.equal(buttons[1].dataset.searchActive, "true");
  assert.equal(buttons[0].dataset.searchActive, "false");
  assert.match(page.feedback.textContent, /^pixel, graphics language\. 2 of /);
  assert.deepEqual(page.results.children, originalOrder, "focus updates never reorder or re-append native buttons");
  buttons[1].emit("click");
  assert.equal(page.window.location.hash, "#pixel-language");
});

test("training and dragon wishes require exact secret commands and never enter the result list", () => {
  const training = setup(); training.search("tra");
  assert.ok(training.visible().every(button => !["training", "breaker", "kamehameha", "wish", "shenron"].includes(button.dataset.command)));
  training.search("/kamehameha"); training.submit(); assert.equal(training.calls.training, 1);
  const locked = setup(); locked.search(":wish"); locked.submit();
  assert.equal(locked.calls.summons, 0); assert.equal(locked.window.location.hash, "");
  assert.equal(locked.feedback.textContent, "follow all seven project signals first.");
  const unlocked = setup({ unlocked: true }); unlocked.search("shenron"); unlocked.submit();
  assert.equal(unlocked.calls.summons, 1); assert.equal(unlocked.window.location.hash, "#about");
  assert.equal(unlocked.document.activeElement, unlocked.summonButton);
});

test("ECDSA search and exact commands open the experiment only after dismissing the command dialog", () => {
  for (const query of [":ecdsa", "elliptic curve", "signature"]) {
    const page = setup();
    page.root.dataset.view = "workspace";
    page.window.location.hash = "#about";
    page.search(query);
    assert.equal(page.visible()[0].dataset.command, "ecdsa");
    assert.equal(page.calls.ecdsa.length, 0, "searching alone does not open an animation");
    page.submit();
    assert.deepEqual(page.calls.ecdsa, [{ dialogOpen: false, view: "entrance", hash: "" }]);
    assert.equal(page.dialog.open, false);
  }
  const clicked = setup();
  clicked.visible().find(button => button.dataset.command === "ecdsa").emit("click");
  assert.equal(clicked.calls.ecdsa.length, 1);
  assert.equal(clicked.calls.ecdsa[0].dialogOpen, false);
});
