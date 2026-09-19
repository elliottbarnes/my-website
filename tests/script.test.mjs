import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../script.js", import.meta.url), "utf8");
const markup = await readFile(new URL("../index.html", import.meta.url), "utf8");

function browser({
  saved = null, themeSaved = null, systemDark = false, storageBlocked = false,
  reducedMotion = false, noToggle = false, noThemeToggle = false, noLabels = false, noMeta = false,
} = {}) {
  const listeners = {}, themeListeners = {}, windowListeners = {}, mediaListeners = {}, attrs = {}, themeAttrs = {}, scrolls = [];
  const state = { effectsOff: false, stored: null, themeStored: null, writes: [] };
  const control = (attributes, handlers) => ({
    setAttribute: (key, value) => attributes[key] = value,
    getAttribute: (key) => attributes[key],
    addEventListener: (name, listener) => handlers[name] = listener,
  });
  const toggle = control(attrs, listeners), themeToggle = control(themeAttrs, themeListeners);
  const label = { textContent: "" }, themeLabel = { textContent: "" }, year = { textContent: "" };
  const themeMeta = { setAttribute: (key, value) => { assert.equal(key, "content"); state.themeColor = value; } };
  const links = ["work", "toolkit", "contact"].map((id, index) => ({ dataset: { shortcut: String(index + 1) }, getAttribute: () => `#${id}` }));
  const root = { dataset: { theme: "light" } };
  class Element {
    constructor(tagName = "BODY", editable = false) { this.tagName = tagName; this.isContentEditable = editable; }
  }
  const document = {
    documentElement: root,
    body: { classList: { toggle: (name, value) => { assert.equal(name, "fx-off"); state.effectsOff = value; } } },
    querySelector: (selector) => {
      if (selector === "[data-fx-toggle]") return noToggle ? null : toggle;
      if (selector === "[data-fx-label]") return noToggle || noLabels ? null : label;
      if (selector === "[data-theme-toggle]") return noThemeToggle ? null : themeToggle;
      if (selector === "[data-theme-label]") return noThemeToggle || noLabels ? null : themeLabel;
      if (selector === 'meta[name="theme-color"]') return noMeta ? null : themeMeta;
      if (selector === "[data-current-year]") return year;
      if (["#work", "#toolkit", "#contact"].includes(selector)) return { scrollIntoView: (options) => scrolls.push({ selector, behavior: options.behavior }) };
      return null;
    },
    querySelectorAll: () => links,
    addEventListener: (name, listener) => listeners[name] = listener,
  };
  const storage = new Map([["elliott-crt-effects", saved], ["elliott-color-theme", themeSaved]]);
  const localStorage = {
    getItem: (key) => {
      assert.ok(storage.has(key), `Unexpected preference key: ${key}`);
      if (storageBlocked) throw new Error("unavailable");
      return storage.get(key);
    },
    setItem: (key, value) => {
      assert.ok(storage.has(key), `Unexpected preference key: ${key}`);
      if (storageBlocked) throw new Error("unavailable");
      storage.set(key, value);
      state.writes.push([key, value]);
      if (key === "elliott-crt-effects") state.stored = value;
      else state.themeStored = value;
    },
  };
  const themeMedia = {
    matches: systemDark,
    addEventListener: (name, listener) => { assert.equal(name, "change"); mediaListeners[name] = listener; },
  };
  const window = {
    matchMedia: (query) => {
      if (query === "(prefers-color-scheme: dark)") return themeMedia;
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reducedMotion };
    },
    addEventListener: (name, listener) => windowListeners[name] = listener,
  };
  vm.runInNewContext(source, { document, localStorage, HTMLElement: Element, window, Date });
  function key(key, extra = {}) {
    let prevented = false;
    listeners.keydown({ key, target: new Element(), preventDefault: () => prevented = true, ...extra });
    return prevented;
  }
  function systemTheme(dark) {
    themeMedia.matches = dark;
    mediaListeners.change({ matches: dark });
  }
  function storageChange(newValue, key = "elliott-color-theme", extra = {}) {
    windowListeners.storage({ key, newValue, storageArea: localStorage, ...extra });
  }
  return { state, attrs, themeAttrs, label, themeLabel, year, listeners, themeListeners, scrolls, key, Element, root, systemTheme, storageChange };
}

function expectTheme(current, theme) {
  const dark = theme === "dark";
  assert.equal(current.root.dataset.theme, theme);
  assert.equal(current.themeAttrs["aria-pressed"], String(dark));
  assert.equal(current.themeAttrs["aria-label"], "START: Dark mode");
  assert.equal(current.themeLabel.textContent, dark ? "Dark mode: on" : "Dark mode: off");
  assert.equal(current.state.themeColor, dark ? "#17191f" : "#efede8");
}

test("the pre-stylesheet bootstrap matches runtime theme resolution without storing a preference", () => {
  const bootstrap = /<script\s+data-theme-bootstrap\s*>([\s\S]*?)<\/script>/.exec(markup);
  assert.ok(bootstrap, "Theme bootstrap must be present");
  assert.ok(bootstrap.index < markup.indexOf('rel="stylesheet"'), "Theme must resolve before the stylesheet loads");
  for (const themeSaved of [null, "invalid", "light", "dark"]) {
    for (const systemDark of [false, true]) {
      for (const storageBlocked of [false, true]) {
        const document = { documentElement: { dataset: { theme: "light" } } };
        const localStorage = { getItem: (key) => {
          assert.equal(key, "elliott-color-theme");
          if (storageBlocked) throw new Error("unavailable");
          return themeSaved;
        } };
        const window = { matchMedia: (query) => {
          assert.equal(query, "(prefers-color-scheme: dark)");
          return { matches: systemDark };
        } };
        vm.runInNewContext(bootstrap[1], { document, localStorage, window });
        assert.equal(document.documentElement.dataset.theme, browser({ themeSaved, systemDark, storageBlocked }).root.dataset.theme);
      }
    }
  }
});

test("theme follows the system when no valid explicit preference exists", () => {
  for (const systemDark of [false, true]) {
    for (const themeSaved of [null, "", "invalid", "DARK"]) {
      const current = browser({ systemDark, themeSaved });
      expectTheme(current, systemDark ? "dark" : "light");
      assert.equal(current.state.themeStored, null);
    }
  }
});

test("saved light and dark themes override the system preference", () => {
  for (const themeSaved of ["light", "dark"]) {
    for (const systemDark of [false, true]) {
      const current = browser({ systemDark, themeSaved });
      expectTheme(current, themeSaved);
      assert.equal(current.state.themeStored, null);
    }
  }
});

test("theme button updates the root, visible label, accessible state, browser color, and preference", () => {
  const current = browser();
  current.themeListeners.click();
  expectTheme(current, "dark");
  assert.equal(current.state.themeStored, "dark");
  current.themeListeners.click();
  expectTheme(current, "light");
  assert.equal(current.state.themeStored, "light");
});

test("system theme changes apply live without writing a manual preference", () => {
  const current = browser();
  current.systemTheme(true);
  expectTheme(current, "dark");
  current.systemTheme(false);
  expectTheme(current, "light");
  assert.equal(current.state.themeStored, null);
});

test("saved or manually selected themes resist subsequent system changes", () => {
  const saved = browser({ themeSaved: "light" });
  saved.systemTheme(true);
  expectTheme(saved, "light");
  const manual = browser();
  manual.themeListeners.click();
  manual.systemTheme(true);
  manual.systemTheme(false);
  expectTheme(manual, "dark");
});

test("blocked storage falls back to the system but keeps a manual choice for the page", () => {
  const current = browser({ storageBlocked: true, themeSaved: "light", systemDark: true });
  expectTheme(current, "dark");
  current.systemTheme(false);
  expectTheme(current, "light");
  current.themeListeners.click();
  current.systemTheme(true);
  current.systemTheme(false);
  expectTheme(current, "dark");
  assert.equal(current.state.themeStored, null);
});

test("theme changes from another tab synchronize without writing them back", () => {
  const current = browser();
  const initialWrites = current.state.writes.length;
  current.storageChange("dark");
  expectTheme(current, "dark");
  current.systemTheme(false);
  expectTheme(current, "dark");
  current.storageChange("light");
  expectTheme(current, "light");
  assert.equal(current.state.writes.length, initialWrites);
});

test("clearing or invalidating the stored theme restores live system preference", () => {
  for (const [value, key] of [[null, "elliott-color-theme"], ["invalid", "elliott-color-theme"], [null, null]]) {
    const current = browser({ themeSaved: "dark" });
    current.storageChange(value, key);
    expectTheme(current, "light");
    current.systemTheme(true);
    expectTheme(current, "dark");
  }
});

test("unrelated storage changes leave the selected theme untouched", () => {
  const current = browser({ themeSaved: "dark" });
  current.storageChange("light", "unrelated-preference");
  current.storageChange("light", "elliott-color-theme", { storageArea: {} });
  expectTheme(current, "dark");
});

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

test("blocked storage does not prevent texture toggling", () => {
  const current = browser({ storageBlocked: true });
  assert.equal(current.state.effectsOff, true);
  current.listeners.click();
  assert.equal(current.state.effectsOff, false);
});

test("theme and texture settings remain independent", () => {
  const current = browser();
  current.themeListeners.click();
  assert.equal(current.state.effectsOff, true);
  current.listeners.click();
  expectTheme(current, "dark");
  assert.equal(current.state.themeStored, "dark");
  assert.equal(current.state.stored, "on");
  current.themeListeners.click();
  assert.equal(current.state.effectsOff, false);
  assert.equal(current.state.stored, "on");
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

test("optional missing controls do not break theme, shortcuts, or year", () => {
  const current = browser({ noToggle: true, noThemeToggle: true, systemDark: true });
  assert.equal(String(current.year.textContent), String(new Date().getFullYear()));
  assert.equal(current.key("2"), true);
  assert.equal(current.root.dataset.theme, "dark");
  current.systemTheme(false);
  assert.equal(current.root.dataset.theme, "light");
});

test("optional missing labels and browser theme metadata do not break either button", () => {
  const current = browser({ noLabels: true, noMeta: true });
  current.themeListeners.click();
  assert.equal(current.root.dataset.theme, "dark");
  assert.equal(current.themeAttrs["aria-pressed"], "true");
  current.listeners.click();
  assert.equal(current.state.effectsOff, false);
});
