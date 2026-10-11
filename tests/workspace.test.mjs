import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/workspace.js", import.meta.url), "utf8");

// The contour canvas is absent so these tests exercise only the real wheel's
// event handlers, with pointer capture and the parent's route-selection click.
function wheel() {
  function surface() {
    const listeners = new Map();
    return {
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatch(type, values = {}) {
        const event = {
          pointerId: 1, pointerType: "mouse", button: 0, buttons: 1,
          isPrimary: true, clientX: 30, clientY: 100, cancelable: true,
          defaultPrevented: false, stopped: false,
          preventDefault() { this.defaultPrevented = true; },
          stopImmediatePropagation() { this.stopped = true; },
          ...values,
        };
        for (const listener of listeners.get(type) || []) {
          listener(event);
          if (event.stopped) break;
        }
        return event;
      },
    };
  }
  const navigation = surface(), window = surface();
  const captures = new Set();
  let selected = 0, now = 0;
  function click(index, detail = 1) {
    const event = navigation.dispatch("click", { detail });
    if (!event.stopped && !event.defaultPrevented) selected = index;
    return event;
  }
  const buttons = Array.from({ length: 6 }, (_, index) => ({
    getAttribute: name => name === "aria-pressed" ? String(index === selected) : null,
    click: () => click(index, 0),
  }));
  Object.assign(navigation, {
    querySelectorAll: () => buttons,
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  });
  window.matchMedia = () => ({ matches: false });
  const document = {
    documentElement: { dataset: { view: "workspace", motion: "running" } },
    hidden: false,
    getElementById: () => null,
    querySelector: selector => selector === ".file-list" ? navigation : null,
  };
  vm.runInNewContext(source, { window, document, performance: { now: () => now } });
  return {
    navigation, window, captures, click,
    get selected() { return selected; },
    advance(ms) { now += ms; },
  };
}

test("release outside the wheel cannot turn a later hover into a project change", () => {
  for (const pointerType of ["mouse", "pen"]) {
    for (const releaseObserved of [true, false]) {
      const controls = wheel();
      controls.navigation.dispatch("pointerdown", { pointerType });
      if (releaseObserved) controls.window.dispatch("pointerup", { pointerType, buttons: 0 });
      controls.navigation.dispatch("pointermove", { pointerType, clientY: 60, buttons: 0 });
      assert.equal(controls.selected, 0, `${pointerType}; release observed: ${releaseObserved}`);
      assert.equal(controls.captures.size, 0);
      controls.navigation.dispatch("pointerdown", { pointerType });
      controls.navigation.dispatch("pointermove", { pointerType, clientY: 60 });
      assert.equal(controls.selected, 1, "a fresh drag still works");
    }
  }
});

test("cancellation, capture loss, or released buttons end an active drag and release capture", () => {
  for (const ending of ["cancel", "lostcapture", "releasedbuttons"]) {
    const controls = wheel();
    controls.navigation.dispatch("pointerdown");
    controls.navigation.dispatch("pointermove", { clientY: 60 });
    assert.equal(controls.selected, 1);
    assert.ok(controls.captures.has(1));
    if (ending === "cancel") controls.window.dispatch("pointercancel");
    else if (ending === "lostcapture") {
      controls.captures.delete(1);
      controls.navigation.dispatch("lostpointercapture");
    } else controls.navigation.dispatch("pointermove", { clientY: 20, buttons: 0 });
    assert.equal(controls.captures.size, 0, ending);
    controls.navigation.dispatch("pointermove", { clientY: 0 });
    assert.equal(controls.selected, 1, `${ending} must clear the old drag`);
  }
});

test("normal mouse and touch drags select a project and suppress their trailing click", () => {
  for (const pointerType of ["mouse", "touch"]) {
    const controls = wheel();
    controls.navigation.dispatch("pointerdown", { pointerType });
    // Touch input remains valid even when the browser does not supply a button mask.
    controls.navigation.dispatch("pointermove", { pointerType, clientY: 70, buttons: pointerType === "touch" ? 0 : 1 });
    assert.equal(controls.selected, 1);
    controls.navigation.dispatch("pointerup", { pointerType, buttons: 0 });
    assert.equal(controls.captures.size, 0);
    assert.ok(controls.click(0).defaultPrevented, "the release must not also activate the card below it");
    assert.equal(controls.selected, 1);
    controls.click(2, 0);
    assert.equal(controls.selected, 2, "keyboard activation is not suppressed");
    controls.advance(501);
    controls.click(3);
    assert.equal(controls.selected, 3, "later intentional clicks still work");
  }
});
