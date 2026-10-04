import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/interactive/arcade.js', import.meta.url), 'utf8');

// Exercise real UI listeners and focus/visibility transitions without a browser dependency.
// Visual layout, native focus traversal, and real dialogs are covered by browser QA.
function browser({ inline = true, columns = 1 } = {}) {
  let document;
  const events = [], queued = [], scrolls = [];
  let playgroundCloses = 0;
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
    getAttribute(name) {
      if (name === 'open') return this.open ? '' : null;
      if (name === 'hidden') return this.hidden ? '' : null;
      return this.attributes.get(name) ?? null;
    }
    contains(element) { for (let node = element; node; node = node.parentElement) if (node === this) return true; return false; }
    getClientRects() {
      for (let node = this; node; node = node.parentElement) if (node.hidden) return [];
      return this.isConnected ? [{}] : [];
    }
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
      const event = { type, target: this, button: 0, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
      for (let node = this; node; node = node.parentElement) {
        for (const listener of node.listeners?.get(type) ?? []) listener(event);
        if (event.stopped || extra.bubbles === false) break;
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
    ? '<section data-console-home><button class="demo-launch" id="launch">Try demo</button><button class="project-choice">Batchline</button></section><section data-console-arcade hidden></section><button data-arcade-open id="cartridge">Cartridge 05</button>'
    : '<button id="launch">Try demo</button><button data-arcade-open id="cartridge">Cartridge 05</button>';
  const window = {
    document,
    getComputedStyle: () => ({ gridTemplateColumns: Array(columns).fill('100px').join(' ') }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    dispatchEvent: event => events.push(event),
    portfolioPlayground: { close() { playgroundCloses += 1; } },
  };
  vm.runInNewContext(source, {
    window, document, Element, HTMLElement: Element,
    Math: Object.assign(Object.create(Math), { random: () => 0.99999 }),
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  });
  const query = selector => document.querySelector(selector);
  query('#cartridge').focus();
  return { document, query, api: window.portfolioArcade, events, scrolls,
    get playgroundCloses() { return playgroundCloses; },
    flush: () => { while (queued.length) queued.shift()(); },
    key: (key, extra = {}) => document.activeElement.emit('keydown', { key, ...extra }),
  };
}

test('inline trivia replaces home, closes the running demo, and returns to a visible project launcher', () => {
  const page = browser();
  page.query('#cartridge').click();
  assert.equal(page.api.isOpen(), true);
  assert.equal(page.playgroundCloses, 1);
  assert.equal(page.query('[data-console-home]').hidden, true);
  assert.equal(page.query('[data-console-arcade]').hidden, false);
  assert.equal(page.query('dialog'), null);
  assert.equal(page.document.activeElement, page.query('#arcade-title'));
  assert.equal(page.api.open(), false);
  page.query('.arcade-back').click();
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.query('[data-console-home]').hidden, false);
  assert.equal(page.query('[data-console-arcade]').hidden, true);
  assert.equal(page.document.activeElement, page.query('.demo-launch'));
  assert.ok(page.document.activeElement.getClientRects().length);
  assert.equal(page.api.close(), false);
  assert.deepEqual(page.events.map(event => event.type), ['portfolio:arcade-open', 'portfolio:arcade-close']);
});

test('leaving and reopening keeps the current question, answer feedback, and round progress', () => {
  const page = browser();
  page.api.open();
  const answers = page.query('.arcade-board').querySelectorAll('button');
  answers[2].click();
  assert.equal(page.query('.arcade-status').textContent, 'Correct. Bring all seven together to summon Shenron.');
  assert.ok(page.query('.arcade-markers').children[0].classList.contains('just-earned'));
  page.api.close();
  page.api.open();
  assert.equal(page.query('[data-arcade-progress]').textContent, 'Question 1 of 5');
  assert.equal(page.query('.arcade-next').hidden, false);
  assert.equal(answers[2].getAttribute('aria-disabled'), 'true');
  page.query('.arcade-next').click();
  const question = page.query('.arcade-question').textContent;
  page.api.close(); page.api.open();
  assert.equal(page.query('[data-arcade-progress]').textContent, 'Question 2 of 5');
  assert.equal(page.query('.arcade-question').textContent, question);
  assert.equal(page.query('.arcade-next').hidden, true);
});

test('launching an already-open inline game brings it back into view without losing progress or its home trigger', () => {
  const page = browser(), originalTrigger = page.query('.project-choice');
  page.api.open(originalTrigger);
  page.query('.arcade-board').querySelectorAll('button')[2].click();
  page.query('.arcade-next').click();
  const question = page.query('.arcade-question').textContent;
  const scrollCount = page.scrolls.length;
  page.query('#cartridge').focus();
  page.query('#cartridge').click();
  assert.equal(page.document.activeElement, page.query('#arcade-title'));
  assert.equal(page.scrolls.length, scrollCount + 1);
  assert.equal(page.scrolls.at(-1).element, page.query('[data-console-arcade]'));
  assert.equal(page.query('[data-arcade-progress]').textContent, 'Question 2 of 5');
  assert.equal(page.query('.arcade-question').textContent, question);

  // The terminal may have just closed, leaving focus on the body before invoking this API.
  page.document.body.focus();
  page.api.open(page.query('#cartridge'));
  assert.equal(page.document.activeElement, page.query('#arcade-title'));
  assert.equal(page.scrolls.length, scrollCount + 2);
  assert.equal(page.query('[data-arcade-progress]').textContent, 'Question 2 of 5');
  assert.equal(page.query('.arcade-question').textContent, question);
  assert.equal(page.playgroundCloses, 1);
  assert.equal(page.events.filter(event => event.type === 'portfolio:arcade-open').length, 1);
  page.api.close();
  assert.equal(page.document.activeElement, originalTrigger);
});

test('inline Back preserves a visible home trigger but never restores hidden or footer controls', () => {
  const page = browser(), project = page.query('.project-choice');
  page.api.open(project); page.api.close();
  assert.equal(page.document.activeElement, project);
  page.api.open(project); project.hidden = true; page.api.close();
  assert.equal(page.document.activeElement, page.query('.demo-launch'));
  page.api.open(page.query('#cartridge')); page.api.close();
  assert.equal(page.document.activeElement, page.query('.demo-launch'));
});

test('answer arrows follow the rendered columns while section shortcuts can navigate normally', () => {
  const page = browser({ columns: 2 }); page.api.open();
  const answers = page.query('.arcade-board').querySelectorAll('button');
  const received = [];
  page.document.addEventListener('keydown', event => received.push(event.key));
  answers[0].focus();
  assert.equal(page.key('ArrowDown').defaultPrevented, true);
  assert.equal(page.document.activeElement, answers[2]);
  page.key('ArrowRight');
  assert.equal(page.document.activeElement, answers[3]);
  page.key('ArrowUp');
  assert.equal(page.document.activeElement, answers[1]);
  assert.deepEqual(received, []);
  assert.equal(page.key('2').defaultPrevented, false);
  assert.deepEqual(received, ['2']);
});

test('Escape and B close inline trivia without intercepting typing, modified keys, or another modal', () => {
  const page = browser(); page.api.open();
  const textInput = page.document.createElement('input');
  textInput.setAttribute('type', 'text');
  page.query('[data-console-arcade]').append(textInput);
  textInput.focus();
  assert.equal(page.key('b').defaultPrevented, false);
  assert.equal(page.key('Escape').defaultPrevented, false);
  assert.equal(page.api.isOpen(), true);
  page.query('#arcade-title').focus();
  assert.equal(page.key('b', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(page.api.isOpen(), true);
  const modal = page.document.createElement('dialog'); page.document.body.append(modal); modal.showModal();
  assert.equal(page.key('Escape').defaultPrevented, false);
  assert.equal(page.api.isOpen(), true);
  modal.close();
  assert.equal(page.key('Escape').defaultPrevented, true);
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.document.activeElement, page.query('.demo-launch'));
  page.api.open();
  assert.equal(page.key('b').defaultPrevented, true);
  assert.equal(page.api.isOpen(), false);
});

test('Escape and B remain available when the optional save checkbox has focus', () => {
  const page = browser();
  for (const key of ['Escape', 'b']) {
    page.api.open();
    page.query('.arcade-save input').focus();
    assert.equal(page.key(key).defaultPrevented, true);
    assert.equal(page.api.isOpen(), false);
    assert.equal(page.query('[data-console-home]').hidden, false);
    assert.equal(page.document.activeElement, page.query('.demo-launch'));
  }
});

test('pages without a console keep native dialogs and restore their actual opener', () => {
  const page = browser({ inline: false }), trigger = page.query('#cartridge');
  trigger.click();
  assert.equal(page.query('dialog').open, true);
  assert.equal(page.document.activeElement, page.query('.arcade-close'));
  page.query('.arcade-close').click(); page.flush();
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.query('dialog').open, false);
  assert.equal(page.document.activeElement, trigger);
  assert.equal(page.events.filter(event => event.type === 'portfolio:arcade-close').length, 1);
  page.api.open(trigger);
  page.query('dialog').emit('cancel'); page.flush();
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.document.activeElement, trigger);
});

test('queued native close events cannot dismiss or steal focus from a reopened game', () => {
  const page = browser({ inline: false });
  page.api.open(); page.api.close(); page.api.open(); page.flush();
  assert.equal(page.api.isOpen(), true);
  assert.equal(page.query('dialog').open, true);
  assert.equal(page.document.activeElement, page.query('.arcade-close'));
  page.query('dialog').close(); page.flush();
  assert.equal(page.api.isOpen(), false);
  assert.equal(page.document.activeElement, page.query('#cartridge'));
});
