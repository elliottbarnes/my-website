import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/interactive/playground.js', import.meta.url), 'utf8');

// A small DOM double verifies actual demo events and cleanup without a browser dependency.
// Visual layout, native focus traversal, and real dialogs are covered by browser QA.
function browser({ inline = true } = {}) {
  let document;
  const timers = new Map(), events = [], queued = [], scrolls = [];
  let timerId = 0;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.attributes = new Map(); this.listeners = new Map(); this.dataset = {};
      this.className = ''; this.hidden = false; this.open = false; this.value = '';
      const toggle = (name, enabled) => {
        const values = new Set(this.className.split(/\s+/).filter(Boolean));
        if (enabled ?? !values.has(name)) values.add(name); else values.delete(name);
        this.className = [...values].join(' ');
      };
      this.classList = { toggle, add: name => toggle(name, true), remove: name => toggle(name, false), contains: name => this.className.split(/\s+/).includes(name) };
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      if (name === 'class') this.className = String(value);
      if (name === 'id') this.id = String(value);
      if (name === 'value') this.value = String(value);
      if (name === 'hidden') this.hidden = true;
      if (name === 'checked') this.checked = true;
    }
    getAttribute(name) { return name === 'open' ? (this.open ? '' : null) : this.attributes.get(name) ?? null; }
    get isConnected() { let node = this; while (node.parentElement) node = node.parentElement; return node === document; }
    get textContent() { return this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren({ textContent: String(value) }); }
    set innerHTML(html) {
      this.replaceChildren();
      const stack = [this];
      for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
        if (token.startsWith('</')) { stack.pop(); continue; }
        if (token.startsWith('<')) {
          const [, tag, attrs] = token.match(/^<([\w-]+)([^>]*)>/) ?? [];
          if (!tag) continue;
          const node = new Element(tag);
          for (const attr of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) node.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '');
          stack.at(-1).append(node);
          if (!/^(input|img|br|hr|meta|link)$/i.test(tag)) stack.push(node);
        } else stack.at(-1).append({ textContent: token });
      }
      this.querySelectorAll('select').forEach(select => { select.value = select.querySelector('option')?.value ?? ''; });
    }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this.append(...children); }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        const segments = part.split(/\s+/);
        if (segments.length > 1) return this.matches(segments.pop()) && Boolean(this.parentElement?.closest(segments.join(' ')));
        const attrs = [...part.matchAll(/\[([^\]=]+)(?:=['"]?([^\]'"]+)['"]?)?\]/g)];
        const simple = part.replace(/\[[^\]]+\]/g, ''), tag = simple.match(/^[\w-]+/)?.[0];
        return (!tag || tag.toUpperCase() === this.tagName) &&
          [...simple.matchAll(/\.([\w-]+)/g)].every(([, name]) => this.classList.contains(name)) &&
          (!simple.includes('#') || this.id === simple.split('#')[1]) &&
          attrs.every(([, name, value]) => this.getAttribute(name) !== null && (value === undefined || this.getAttribute(name) === value));
      });
    }
    closest(selector) { for (let node = this; node instanceof Element; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelectorAll(selector) {
      const found = [];
      for (const child of this.children) if (child instanceof Element) {
        if (child.matches(selector)) found.push(child);
        found.push(...child.querySelectorAll(selector));
      }
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, extra = {}) {
      const event = { type, target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
      for (let node = this; node; node = node.parentElement) {
        for (const listener of node.listeners?.get(type) ?? []) listener(event);
        if (extra.bubbles === false) break;
      }
      return event;
    }
    click() { return this.emit('click'); }
    focus() { document.activeElement = this; }
    scrollIntoView(options) { scrolls.push({ element: this, ...options }); }
    showModal() { this.open = true; }
    close() { this.open = false; queued.push(() => this.emit('close', { bubbles: false })); }
  }
  document = new Element('document');
  document.documentElement = new Element('html'); document.append(document.documentElement);
  document.body = new Element('body'); document.documentElement.append(document.body);
  document.createElement = tag => new Element(tag); document.activeElement = document.body;
  document.body.innerHTML = inline
    ? '<section data-console-home><button id="launch">Try demo</button><button class="project-card project-choice" data-project="batchline">Batchline</button></section><section data-console-demo hidden></section>'
    : '<button id="launch">Try demo</button><a class="project-card" data-project="batchline">Batchline</a>';
  const window = {
    document, matchMedia: () => ({ matches: false }),
    dispatchEvent: event => events.push(event),
    setInterval: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
  };
  vm.runInNewContext(source, { window, CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } } });
  const query = selector => document.querySelector(selector);
  query('#launch').focus();
  return { document, query, api: window.portfolioPlayground, events, timers, scrolls,
    flush: () => { while (queued.length) queued.shift()(); },
    key: (key, extra = {}) => document.activeElement.emit('keydown', { key, ...extra }),
  };
}

test('inline demos replace the home screen, preserve normal page flow, and restore focus on Back', () => {
  const page = browser(), trigger = page.query('#launch');
  assert.equal(page.api.open('batchline'), true);
  assert.equal(page.query('[data-console-home]').hidden, true);
  assert.equal(page.query('[data-console-demo]').hidden, false);
  assert.equal(page.document.activeElement, page.query('#playground-title'));
  assert.equal(page.query('dialog'), null);
  assert.equal(page.document.body.classList.contains('playground-open'), false);
  assert.equal(page.api.isOpen(), true);
  page.query('[data-batch-step]').click();
  assert.equal(page.query('[data-batch-queue-label]').textContent, '2 / 18 slots');
  page.query('.playground-close').click();
  assert.equal(page.query('[data-console-home]').hidden, false);
  assert.equal(page.query('[data-console-demo]').hidden, true);
  assert.equal(page.query('[data-console-demo]').children.length, 0);
  assert.equal(page.document.activeElement, trigger);
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.api.close(), false);
  assert.deepEqual(page.events.map(event => event.type), ['portfolio:playground-open', 'portfolio:playground-close']);
});

test('switching or closing inline demos stops running work and restores the original trigger', () => {
  const page = browser(), trigger = page.query('#launch');
  page.api.open('batchline'); page.query('[data-batch-run]').click();
  assert.equal(page.timers.size, 1);
  assert.equal(page.document.listeners.get('visibilitychange').size, 1);
  page.api.open('prism-studio');
  assert.equal(page.timers.size, 0);
  assert.equal(page.document.listeners.get('visibilitychange').size, 0);
  assert.match(page.query('.demo-note').textContent, /not actual Prism Studio model outputs/);
  assert.equal(page.key('Escape').defaultPrevented, true);
  assert.equal(page.document.activeElement, trigger);
  page.api.open('batchline'); page.query('[data-batch-run]').click(); page.api.close();
  assert.equal(page.timers.size, 0);
  assert.equal(page.document.listeners.get('visibilitychange').size, 0);
});

test('Escape leaves inline demos alone while another dialog owns focus or handled the key', () => {
  const page = browser(); page.api.open('batchline');
  assert.equal(page.key('Escape', { defaultPrevented: true }).defaultPrevented, true);
  assert.equal(page.api.isOpen(), true);
  const dialog = page.document.createElement('dialog'); page.document.body.append(dialog); dialog.showModal(); dialog.focus();
  assert.equal(page.key('Escape').defaultPrevented, false);
  assert.equal(page.api.isOpen(), true);
});

test('project choices select without launching and invalid project IDs do not change state', () => {
  const page = browser();
  page.query('.project-choice').click();
  assert.equal(page.api.isOpen(), false);
  for (const id of ['unknown', '__proto__', 'constructor']) assert.equal(page.api.open(id), false);
  assert.equal(page.query('[data-console-home]').hidden, false);
  page.api.open('evaldeck');
  assert.equal(page.query('#playground-title').textContent, 'EvalDeck');
  page.api.open('reconcile-kit');
  page.query('[data-reconcile-check]').click();
  assert.match(page.query('[data-reconcile-status]').textContent, /1 issue found/);
  page.api.close();
});

test('pages without a console host retain the native dialog lifecycle', () => {
  const page = browser({ inline: false }), trigger = page.query('.project-card');
  trigger.focus(); trigger.click();
  const dialog = page.query('dialog');
  assert.equal(dialog.open, true);
  assert.equal(page.document.body.classList.contains('playground-open'), true);
  page.query('[data-batch-run]').click();
  assert.equal(page.timers.size, 1);
  page.query('.playground-close').click(); page.flush();
  assert.equal(dialog.open, false);
  assert.equal(page.timers.size, 0);
  assert.equal(page.document.activeElement, trigger);
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.events.filter(event => event.type === 'portfolio:playground-close').length, 1);
});
