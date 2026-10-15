import vm from "node:vm";

// Synthetic DOM and virtual display clock, not a browser or human playtest.
// Production engine/UI bytes run unchanged; wrappers only observe their state.
export function trainingHarness({ engineSource, uiSource, cssWidth = 360 }) {
  let document, wallMs = 0, state, nextId = 0, paints = 0;
  const frames = new Map(), timers = new Map(), requests = [], images = [], engineSteps = [];
  let drawing = [];
  class Element {
    constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.listeners = new Map(); this.dataset = {}; this.attributes = new Map(); this.textContent = ""; this.style = {}; this.isConnected = true; }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
    emit(type, values = {}) {
      const event = { type, target: this, currentTarget: this, timeStamp: wallMs, isPrimary: true,
        pointerId: 1, pointerType: "touch", button: 0, buttons: type === "pointerup" ? 0 : 1,
        defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...values };
      for (const handler of this.listeners.get(type) || []) handler(event);
      return event;
    }
    dispatch(type, values) { return this.emit(type, values); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    focus() { document.activeElement = this; }
    closest(selector) { return selector.split(",").some(tag => tag.trim().toUpperCase() === this.tagName) ? this : null; }
  }
  const root = new Element("html"), dialog = new Element("dialog"), canvas = new Element("canvas");
  const action = new Element("button"), pause = new Element("button"), status = new Element("p");
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.emit("close"); };
  dialog.querySelectorAll = () => [];
  const observeDraw = (method, args) => drawing.push({ method, args: [...args], fillStyle: context.fillStyle,
    strokeStyle: context.strokeStyle, globalAlpha: context.globalAlpha, font: context.font, shadowBlur: context.shadowBlur });
  const paintProperties = ["fillStyle", "strokeStyle", "globalAlpha", "font", "shadowBlur", "shadowColor", "lineWidth", "textAlign"];
  const paintStack = [];
  const context = new Proxy({ globalAlpha: 1, shadowBlur: 0, lineWidth: 1,
    fillStyle: "#000000", strokeStyle: "#000000", font: "10px sans-serif", shadowColor: "transparent", textAlign: "start",
    clearRect() { paints++; drawing = []; },
    save() { paintStack.push(Object.fromEntries(paintProperties.map(key => [key, context[key]]))); },
    restore() { const saved = paintStack.pop(); if (saved) Object.assign(context, saved); },
    fillText(...args) { observeDraw("fillText", args); }, drawImage(...args) { observeDraw("drawImage", args); },
    fillRect(...args) { observeDraw("fillRect", args); }, roundRect(...args) { observeDraw("roundRect", args); },
    arc(...args) { observeDraw("arc", args); },
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  canvas.getContext = () => context;
  let bounds = { left: 50, top: 60, width: cssWidth, height: cssWidth * 4 / 3 };
  canvas.getBoundingClientRect = () => ({ ...bounds });
  let capture = null;
  canvas.setPointerCapture = id => { capture = id; };
  canvas.hasPointerCapture = id => capture === id;
  canvas.releasePointerCapture = id => { if (capture === id) { capture = null; canvas.emit("lostpointercapture", { pointerId: id }); } };
  const nodes = new Map([["training-dialog", dialog], ["training-canvas", canvas], ["training-action", action],
    ["training-pause", pause], ["training-status", status], ["training-score", new Element()], ["training-lives", new Element()]]);
  document = Object.assign(new Element(), { documentElement: root, activeElement: action, hidden: false,
    getElementById: id => nodes.get(id), querySelectorAll: () => [], querySelector: () => null });
  const motion = Object.assign(new Element(), { matches: false });
  const window = Object.assign(new Element(), { devicePixelRatio: 1,
    matchMedia: () => motion, dispatchEvent() {} });
  const performance = { now: () => wallMs };
  class Image {
    constructor() { this.complete = false; this.naturalWidth = 0; images.push(this); }
    set src(value) { this.url = value; requests.push(value); }
    load() { this.complete = true; this.naturalWidth = 128; this.onload?.(); }
  }
  vm.runInNewContext(engineSource, { window });
  const actualEngine = window.PortfolioBreakerEngine;
  window.PortfolioBreakerEngine = { ...actualEngine,
    create() { state = actualEngine.create(); return state; },
    step(game, seconds) {
      const before = game.time;
      actualEngine.step(game, seconds);
      engineSteps.push({ wallMs, requestedSeconds: seconds, advancedSeconds: game.time - before });
      return game;
    },
  };
  const requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  const cancelAnimationFrame = id => frames.delete(id);
  const setTimeout = (callback, delay = 0) => { const id = ++nextId; timers.set(id, { at: wallMs + delay, callback }); return id; };
  const clearTimeout = id => timers.delete(id);
  Object.assign(window, { performance, requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout });
  vm.runInNewContext(uiSource, { document, window, Image, Element, HTMLElement: Element, performance,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    ResizeObserver: class { observe() {} }, getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout,
  });
  const snapshot = () => ({ phase: state.phase, lives: state.lives, score: state.score, simulationSeconds: state.time,
    paddleX: state.paddle.x, ball: { ...state.ball },
    activeBricks: state.bricks.filter(brick => brick.active).map(brick => [brick.id, brick.health]) });
  function advanceTo(time) {
    if (time < wallMs - 1e-7) throw new Error("Virtual wall clock cannot run backwards");
    for (;;) {
      const pending = [...timers].filter(([, timer]) => timer.at <= time).sort((a, b) => a[1].at - b[1].at)[0];
      if (!pending) break;
      wallMs = pending[1].at; timers.delete(pending[0]); pending[1].callback();
    }
    wallMs = time;
  }
  function displayFrame(time) {
    advanceTo(time);
    const current = [...frames.values()]; frames.clear();
    current.forEach(callback => callback(time));
    return snapshot();
  }
  function input(event) {
    advanceTo(event.at);
    if (event.type === "launch") action.emit("click");
    else if (event.type.startsWith("pointer")) {
      const rect = canvas.getBoundingClientRect();
      canvas.emit(event.type, { ...event, clientX: rect.left + event.x * rect.width,
        clientY: rect.top + (event.y ?? .85) * rect.height });
    } else document.emit(event.type, { ...event, target: canvas });
    return snapshot();
  }
  return { window, document, root, motion, canvas, dialog, action, pause, status, engine: actualEngine, engineSteps, requests, images,
    open: () => window.PortfolioTraining.open(), displayFrame, advanceTo, input, snapshot,
    api: window.PortfolioTraining,
    setBounds(next) { bounds = { ...bounds, ...next }; },
    get state() { return state; }, get paints() { return paints; }, get pendingFrames() { return frames.size; },
    get drawing() { return drawing; } };
}

export function loadEngine(source) {
  const window = {};
  vm.runInNewContext(source, { window });
  return window.PortfolioBreakerEngine;
}
