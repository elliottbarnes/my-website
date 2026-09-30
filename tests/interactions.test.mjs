import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/interactive/interactions.js", import.meta.url), "utf8");
const scriptSource = await readFile(new URL("../script.js", import.meta.url), "utf8");
const markup = await readFile(new URL("../index.html", import.meta.url), "utf8");

// A small DOM test double exercises event/focus behavior against the actual page markup.
// It does not emulate layout, native Tab traversal, or screen readers; those require browser QA.
function browser({ systemReduced = false, inlineDemos = false, loadScript = false } = {}) {
  let document;
  const pendingCloseEvents = [], scrolls = [], openedProjects = [];
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = []; this.parentElement = null; this.attributes = new Map();
      this.dataset = {}; this.className = ""; this.listeners = new Map();
      this.open = false; this.disabled = false; this.value = ""; this.isContentEditable = false;
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, enabled) => {
          const values = new Set(this.className.split(/\s+/).filter(Boolean));
          if (enabled ?? !values.has(name)) values.add(name); else values.delete(name);
          this.className = [...values].join(" ");
        },
      };
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      if (name === "class") this.className = String(value);
      if (name === "id") this.id = String(value);
      if (name === "hidden") this.hidden = true;
      if (name === "value") this.value = String(value);
    }
    getAttribute(name) { return name === "open" ? (this.open ? "" : null) : this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    get hidden() { return Boolean(this._hidden); }
    set hidden(value) {
      this._hidden = Boolean(value);
      if (value && document?.activeElement === this) document.activeElement = document.body;
    }
    get isConnected() { let node = this; while (node.parentElement) node = node.parentElement; return node === document; }
    get firstChild() { return this.children[0]; }
    get textContent() { return this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this.replaceChildren({ textContent: String(value) }); }
    set innerHTML(html) {
      this.replaceChildren();
      const stack = [this];
      for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
        if (token.startsWith("</")) { stack.pop(); continue; }
        if (token.startsWith("<")) {
          const [, tag, attributes] = token.match(/^<([\w-]+)([^>]*)>/) ?? [];
          if (!tag) continue;
          const node = new Element(tag);
          for (const attribute of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
            node.setAttribute(attribute[1], attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
          }
          stack.at(-1).append(node);
          if (!/^(input|img|br|hr|meta|link)$/i.test(tag) && !token.endsWith("/>")) stack.push(node);
        } else stack.at(-1).append({ textContent: token });
      }
    }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this.append(...children); }
    matches(selector) {
      return selector.split(",").some(part => {
        part = part.trim();
        const attributes = [...part.matchAll(/\[([^\]=]+)(?:=['"]?([^\]'"]+)['"]?)?\]/g)];
        const simple = part.replace(/\[[^\]]+\]/g, "");
        const tag = simple.match(/^[\w-]+/)?.[0];
        return (!tag || tag.toUpperCase() === this.tagName) &&
          [...simple.matchAll(/\.([\w-]+)/g)].every(([, name]) => this.classList.contains(name)) &&
          (!simple.includes("#") || this.id === simple.split("#")[1]) &&
          attributes.every(([, name, value]) => this.getAttribute(name) !== null && (value === undefined || this.getAttribute(name) === value));
      });
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node instanceof Element && node.matches(selector)) return node; return null; }
    querySelectorAll(selector) {
      const results = [];
      for (const child of this.children) if (child instanceof Element) {
        if (child.matches(selector)) results.push(child);
        results.push(...child.querySelectorAll(selector));
      }
      return results;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    addEventListener(type, listener, capture = false) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push({ listener, capture: Boolean(capture) });
    }
    emit(type, extra = {}) {
      const event = { type, target: this, button: 0, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
      const path = []; for (let node = this; node; node = node.parentElement) path.push(node);
      const dispatch = (node, capture) => {
        for (const item of node.listeners?.get(type) ?? []) if (item.capture === capture) item.listener(event);
      };
      for (const node of [...path].reverse()) { dispatch(node, true); if (event.stopped) return event; }
      for (const node of path) { dispatch(node, false); if (event.stopped || extra.bubbles === false) break; }
      return event;
    }
    click() { if (!this.disabled) this.emit("click"); }
    focus() { if (!this.disabled && !this.hidden && document.activeElement !== this) { document.activeElement = this; this.emit("focus", { bubbles: false }); } }
    scrollIntoView(options) { scrolls.push({ element: this, ...options }); }
    showModal() { this.previousFocus = document.activeElement; this.open = true; }
    close() {
      if (!this.open) return;
      this.open = false;
      this.previousFocus?.focus();
      pendingCloseEvents.push(() => this.emit("close", { bubbles: false }));
    }
  }
  document = new Element("document");
  document.documentElement = new Element("html"); document.append(document.documentElement);
  document.body = new Element("body"); document.documentElement.append(document.body);
  document.activeElement = document.body;
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.querySelector(`#${id}`);
  document.body.innerHTML = markup.match(/<body\b[^>]*>([\s\S]*)<\/body>/)[1]
    .replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<svg\b[\s\S]*?<\/svg>/g, "");
  const mediaListeners = [];
  const media = { matches: systemReduced, addEventListener: (_, listener) => mediaListeners.push(listener) };
  let inlineOpen = false, inlineOpener;
  const window = {
    addEventListener() {},
    matchMedia: () => media,
    portfolioPlayground: {
      open(id) {
        openedProjects.push(id);
        if (!inlineDemos) { openMockDialog("project"); return; }
        if (!inlineOpen) inlineOpener = document.activeElement;
        inlineOpen = true;
        document.querySelector('[data-console-home]').hidden = true;
        const host = document.querySelector('[data-console-demo]'); host.hidden = false;
        host.innerHTML = `<h2 id="mock-demo-title" tabindex="-1">${id}</h2>`;
        host.querySelector('h2').focus();
      },
      close() {
        if (!inlineOpen) return false;
        inlineOpen = false;
        document.querySelector('[data-console-home]').hidden = false;
        document.querySelector('[data-console-demo]').hidden = true;
        inlineOpener?.focus();
        return true;
      },
      isOpen: () => inlineOpen,
    },
    portfolioArcade: { open() { openMockDialog("arcade"); } },
  };
  function openMockDialog(name) {
    const dialog = document.createElement("dialog"); dialog.className = `${name}-test-dialog`;
    const button = document.createElement("button"); button.textContent = `Close ${name}`;
    dialog.append(button); document.body.append(dialog); dialog.showModal(); button.focus();
  }
  vm.runInNewContext(source, { document, window, HTMLElement: Element, Element });
  if (loadScript) vm.runInNewContext(scriptSource, { document, window, HTMLElement: Element, Date, localStorage: { getItem: () => null, setItem() {} } });
  const query = selector => document.querySelector(selector);
  const terminal = query(".terminal-dialog"), input = terminal.querySelector("input");
  return {
    document, query, terminal, input, scrolls, openedProjects, playground: window.portfolioPlayground,
    flush: () => { while (pendingCloseEvents.length) pendingCloseEvents.shift()(); },
    openTerminal: () => { const launcher = query("[data-terminal-open]"); launcher.focus(); launcher.click(); return launcher; },
    command: value => { input.value = value; terminal.querySelector("form").emit("submit"); },
    key: (key, target = document.activeElement, extra = {}) => target.emit("keydown", { key, ...extra }),
    systemMotion: reduced => { media.matches = reduced; mediaListeners.forEach(listener => listener({ matches: reduced })); },
  };
}

test("terminal destination commands keep destination focus after queued close events", () => {
  for (const [command, target] of [["projects", "#work-title"], ["contact", "#contact-title"], ["toolkit", "#toolkit-title"]]) {
    const page = browser(); page.openTerminal(); page.command(command); page.flush();
    assert.equal(page.terminal.open, false);
    assert.equal(page.document.activeElement, page.query(target));
    assert.equal(page.scrolls.at(-1).behavior, "smooth");
  }
});

test("normal terminal closing restores the launcher and opening another modal retains its focus", () => {
  const page = browser(), launcher = page.openTerminal();
  page.query("[data-terminal-close]").click(); page.flush();
  assert.equal(page.document.activeElement, launcher);
  for (const command of ["arcade", "evaldeck"]) {
    const current = browser(); current.openTerminal(); current.command(command);
    const other = current.document.querySelectorAll("dialog[open]")[0];
    assert.notEqual(other, current.terminal);
    current.flush();
    assert.equal(current.document.activeElement, other.querySelector("button"));
  }
});

test("inherited object keys and markup are harmless unknown terminal commands", () => {
  const page = browser(); page.openTerminal();
  for (const command of ["constructor", "__proto__", "<img src=x onerror=alert(1)>"]) {
    page.command(command); page.flush();
    assert.equal(page.terminal.open, true);
    assert.match(page.query(".terminal-output").textContent, /Unknown command:/);
    assert.ok(page.query(".terminal-output").textContent.includes(command));
    assert.equal(page.query(".terminal-output").querySelectorAll("img").length, 0);
  }
});

test("typing, modified keys, and repeated presses do not activate page shortcuts", () => {
  for (const tag of ["input", "textarea", "select", "div"]) {
    const page = browser(), field = page.document.createElement(tag);
    if (tag === "div") field.isContentEditable = true;
    page.query(".controller-area").append(field); field.focus();
    for (const key of ["/", "a", "b", "ArrowDown"]) assert.equal(page.key(key).defaultPrevented, false);
    assert.equal(page.terminal.open, false);
    assert.equal(page.openedProjects.length, 0);
    assert.equal(page.scrolls.length, 0);
  }
  const page = browser();
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "repeat"]) {
    assert.equal(page.key("/", page.document.body, { [modifier]: true }).defaultPrevented, false);
  }
  assert.equal(page.terminal.open, false);
});

test("terminal input keeps controller letters and arrow keys while a dialog is open", () => {
  const page = browser(); page.openTerminal();
  for (const key of ["/", "a", "b", "ArrowLeft", "ArrowDown"]) {
    assert.equal(page.key(key).defaultPrevented, false);
    assert.equal(page.terminal.open, true);
    assert.equal(page.document.activeElement, page.input);
  }
  assert.equal(page.openedProjects.length, 0);
  assert.equal(page.scrolls.length, 0);
});

test("toolkit reset clears highlights and restores focus to the selected tool", () => {
  const page = browser(), python = page.query('[data-tool="Python"]');
  python.focus(); python.click();
  assert.equal(python.getAttribute("aria-pressed"), "true");
  assert.equal(page.document.querySelectorAll(".tool-match").length, 3);
  assert.equal(page.query("[data-tool-projects]").querySelectorAll("button").length, 3);
  const reset = page.query("[data-tool-reset]"); reset.focus(); reset.click();
  assert.equal(reset.hidden, true);
  assert.equal(page.document.activeElement, python);
  assert.equal(python.getAttribute("aria-pressed"), "false");
  assert.equal(page.document.querySelectorAll(".tool-match").length, 0);
  assert.equal(page.query("[data-tool-projects]").querySelectorAll("button").length, 0);
});

test("controller arrows select projects only inside their controls and collection", () => {
  const page = browser();
  assert.equal(page.key("ArrowDown", page.document.body).defaultPrevented, false);
  const cards = page.document.querySelectorAll("[data-project]"); cards[0].focus();
  assert.equal(page.key("ArrowDown").defaultPrevented, true);
  assert.equal(page.document.activeElement, cards[1]);
  assert.equal(cards[1].getAttribute("aria-current"), "true");
  assert.equal(page.scrolls.at(-1).behavior, "smooth");
  page.key("a");
  assert.deepEqual(page.openedProjects, ["evaldeck"]);
});

test("manual reduced motion removes smooth selection and terminal navigation scrolling", () => {
  const page = browser(); page.query("[data-motion-toggle]").click();
  assert.equal(page.document.documentElement.dataset.motion, "reduced");
  const card = page.query("[data-project]"); card.focus(); page.key("ArrowRight");
  assert.equal(page.scrolls.at(-1).behavior, "auto");
  page.openTerminal(); page.command("contact"); page.flush();
  assert.equal(page.scrolls.at(-1).behavior, "auto");
});

test("system reduced motion is respected live and cannot be overridden by the toggle", () => {
  const page = browser({ systemReduced: true }), toggle = page.query("[data-motion-toggle]");
  assert.equal(toggle.disabled, true);
  assert.equal(page.document.documentElement.dataset.motion, "reduced");
  toggle.click();
  assert.equal(page.document.documentElement.dataset.motion, "reduced");
  page.query("[data-project]").focus(); page.key("ArrowRight");
  assert.equal(page.scrolls.at(-1).behavior, "auto");
  page.systemMotion(false);
  assert.equal(toggle.disabled, false);
  assert.equal(page.document.documentElement.dataset.motion, "full");
  toggle.click(); page.systemMotion(true); page.systemMotion(false);
  assert.equal(page.document.documentElement.dataset.motion, "reduced");
});


test("terminal project commands retain inline demo focus after the terminal close event", () => {
  const page = browser({ inlineDemos: true });
  page.openTerminal(); page.command("evaldeck"); page.flush();
  assert.equal(page.terminal.open, false);
  assert.equal(page.document.querySelectorAll('dialog[open]').length, 0);
  assert.equal(page.document.activeElement, page.query('#mock-demo-title'));
  assert.equal(page.query('[data-console-home]').hidden, true);
  assert.equal(page.query('[data-feature-source]').getAttribute('href'), 'https://github.com/elliottbarnes/evaldeck');
});

test("numeric navigation closes inline demos and focuses the visible destination", () => {
  for (const [key, selector] of [['1', '#work-title'], ['2', '#toolkit-title'], ['3', '#contact-title']]) {
    const page = browser({ inlineDemos: true, loadScript: true });
    page.query('.demo-launch').click();
    assert.equal(page.playground.isOpen(), true);
    assert.equal(page.key(key).defaultPrevented, true);
    assert.equal(page.playground.isOpen(), false);
    assert.equal(page.query('[data-console-home]').hidden, false);
    assert.equal(page.document.activeElement, page.query(selector));
    assert.equal(page.scrolls.at(-1).behavior, 'smooth');
  }
  const reduced = browser({ inlineDemos: true, loadScript: true, systemReduced: true });
  reduced.query('.demo-launch').click(); reduced.key('1');
  assert.equal(reduced.scrolls.at(-1).behavior, 'auto');
});

test("every selected project keeps its source link aligned with the demo", () => {
  const page = browser({ inlineDemos: true });
  for (const card of page.document.querySelectorAll('[data-project]')) {
    card.click();
    assert.equal(page.playground.isOpen(), false);
    assert.equal(page.query('[data-feature-source]').getAttribute('href'), `https://github.com/elliottbarnes/${card.dataset.project}`);
    page.query('.demo-launch').click();
    assert.equal(page.openedProjects.at(-1), card.dataset.project);
    page.playground.close();
  }
});

test("all four project sources remain reachable without JavaScript", () => {
  const fallback = markup.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
  assert.ok(fallback, 'A source-link fallback must be present');
  const links = [...fallback.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(links, ['batchline', 'evaldeck', 'reconcile-kit', 'prism-studio'].map(id => `https://github.com/elliottbarnes/${id}`));
});
