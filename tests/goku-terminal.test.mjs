import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const story = require("../assets/goku-story.js");
const terminal = require("../assets/goku-terminal.js");
const phrases = { begin: "begin", hold: "brace gate", drain: "clear channel", continue: "continue",
  timing: "wait", probe: "probe rock", lift: "lift gate", pulse: "ki pulse" };

function reachable() {
  const pending = [story.create()];
  const states = [];
  while (pending.length) {
    assert.ok(states.length < 30, "the unchanged episode graph should stay finite");
    const state = pending.shift();
    states.push(state);
    for (const choice of story.view(state).choices) pending.push(story.choose(state, choice.command).state);
  }
  return states;
}

function route(...decisions) {
  const commands = ["begin", decisions[0], "continue", decisions[1], "continue", decisions[2]].filter(Boolean);
  return commands.reduce((state, command) => story.choose(state, command).state, story.create());
}

test("every reachable state has a compact terminal scene with bounded ASCII art", () => {
  const states = reachable();
  assert.equal(states.length, 22);
  for (const state of states) {
    const view = terminal.screen(state);
    assert.deepEqual(Object.keys(view).sort(), ["actions", "art", "description", "facts", "location", "title"]);
    assert.ok(view.location && view.title && view.description.length);
    const words = view.description.join(" ").trim().split(/\s+/).length;
    assert.ok(words >= 40 && words <= 90, `${state.node}/${Object.values(state.choices).join("/")} has ${words} words`);
    assert.match(view.art, /^[\x20-\x7e\n]+$/);
    assert.ok(view.art.split("\n").every(line => line.length <= 34));
    assert.ok(view.art.split("\n").length <= 10, "art must leave room for prose and input on mobile");
    assert.match(view.art, /goku/);
    assert.match(view.art, /reservoir/);
    assert.ok(view.facts.length >= 3);
    for (const label of [view.location, view.title, ...view.facts, ...view.actions.flatMap(action => [action.command, action.label])]) {
      assert.equal(label, label.toLowerCase());
    }
  }
});

test("canonical verb phrases and original short commands resolve to the same current actions", () => {
  for (const state of reachable()) {
    const actions = story.view(state).choices;
    assert.deepEqual(terminal.screen(state).actions.map(action => action.command), actions.map(action => phrases[action.command]));
    for (const action of actions) {
      for (const raw of [action.command, phrases[action.command], ` /${phrases[action.command].toUpperCase()} `, `:${phrases[action.command]}`]) {
        const parsed = terminal.parse(state, raw);
        assert.equal(parsed.kind, "action");
        assert.equal(parsed.command, action.command);
        assert.ok(parsed.echo.length <= 64);
        assert.equal(parsed.echo, parsed.echo.toLowerCase());
      }
    }
    for (const unavailable of Object.keys(phrases).filter(command => !actions.some(action => action.command === command))) {
      assert.equal(terminal.parse(state, phrases[unavailable]).kind, "invalid", `${unavailable} is unavailable at ${state.node}`);
    }
  }
});

test("all eight canonical-input routes preserve the original story choices and outcomes", () => {
  const outcomes = new Map([
    ["hold/timing/lift", true], ["hold/timing/pulse", false],
    ["hold/probe/lift", true], ["hold/probe/pulse", true],
    ["drain/timing/lift", true], ["drain/timing/pulse", true],
    ["drain/probe/lift", false], ["drain/probe/pulse", true],
  ]);
  for (const [choices, intact] of outcomes) {
    const [approach, method, resolution] = choices.split("/");
    let state = story.create();
    for (const command of ["begin", approach, "continue", method, "continue", resolution]) {
      const parsed = terminal.parse(state, phrases[command]);
      assert.equal(parsed.kind, "action");
      const next = story.choose(state, parsed.command, state.revision);
      assert.equal(next.accepted, true);
      state = next.state;
    }
    assert.deepEqual(state, route(approach, method, resolution));
    assert.equal(story.view(state).complete, true);
    const view = terminal.screen(state);
    const text = view.description.join(" ");
    assert.match(text, approach === "hold" ? /braced the frame, leaving high pressure/ : /relieved pressure, leaving the frame unsupported/);
    assert.match(text, method === "timing" ? /learned the quiet beat, not the seam/ : /found the seam, not the quiet beat/);
    assert.match(text, resolution === "lift" ? /Goku lifts/ : /Goku releases ki/);
    assert.match(text, intact ? /gate remains usable/ : /runner bends.*for repair/);
    assert.match(text, /family returns to a dry noodle shop/);
    assert.equal(view.actions.length, 0);
    assert.match(view.facts[0], intact ? /gate: usable/ : /runner needs repair/);
  }
});

test("pre-release prose states the exact two dangerous combinations before the action", () => {
  const holdTiming = route("hold", "timing");
  const drainProbe = route("drain", "probe");
  assert.equal(holdTiming.node, "release");
  assert.equal(drainProbe.node, "release");
  const first = terminal.screen(holdTiming).description;
  assert.match(first[1], /lift gate:.*brace.*stay usable/);
  assert.match(first[2], /ki pulse: pressure is high and the seam unknown.*runner will bend/);
  const second = terminal.screen(drainProbe).description;
  assert.match(second[1], /lift gate: the frame is unsupported and the quiet beat unknown.*runner will bend/);
  assert.match(second[2], /ki pulse:.*known seam.*stay usable/);
});

test("look, inspect, talk, status, map and read never mutate any reachable state", () => {
  const commands = ["look", "l", "look gate", "look rock", "look channel", "talk", "talk bulma", "status", "map", "read"];
  for (const state of reachable()) {
    const before = JSON.stringify(state);
    for (const command of commands) {
      const parsed = terminal.parse(state, command);
      assert.equal(parsed.kind, "read");
      assert.equal(parsed.echo, command);
      assert.ok(parsed.lines.length && parsed.lines.every(line => typeof line === "string" && line.length));
      assert.equal(JSON.stringify(state), before);
      parsed.lines[0] = "modified by caller";
      assert.notEqual(terminal.parse(state, command).lines[0], "modified by caller");
    }
    assert.deepEqual(terminal.parse(state, "look").lines, terminal.screen(state).description);
    assert.deepEqual(terminal.parse(state, "l").lines, terminal.screen(state).description);
    assert.deepEqual(terminal.parse(state, "read").lines, story.view(state).paragraphs);
    assert.match(terminal.parse(state, "status").lines[0], /goal: release the spillway safely/);
    assert.ok(terminal.parse(state, "map").lines[0].includes("\n"), "keep the map in one preformatted block");
    assert.ok(terminal.parse(state, "map").lines.flatMap(block => block.split("\n")).every(line => /^[\x20-\x7e]+$/.test(line) && line.length <= 34));
  }
});

test("inspection and Bulma's advice remember preparation, knowledge and final damage", () => {
  const hold = story.choose(story.choose(story.create(), "begin").state, "hold").state;
  const drain = story.choose(story.choose(story.create(), "begin").state, "drain").state;
  assert.match(terminal.parse(hold, "look gate").lines.join(" "), /beam braces.*pressure is high/);
  assert.match(terminal.parse(drain, "look channel").lines.join(" "), /cleared relief ditch.*Pressure is lower/);
  assert.match(terminal.parse(hold, "look channel").lines.join(" "), /prepared the gate's brace instead/);
  assert.match(terminal.parse(route("drain", "timing"), "look gate").lines.join(" "), /quiet beat you learned/);
  assert.match(terminal.parse(route("hold", "timing"), "look rock").lines.join(" "), /studied the water's rhythm/);
  assert.match(terminal.parse(route("hold", "probe"), "look rock").lines.join(" "), /test revealed a seam/);
  assert.match(terminal.parse(route("hold", "timing"), "talk").lines.join(" "), /pulse will bend/);
  assert.match(terminal.parse(route("drain", "probe"), "talk bulma").lines.join(" "), /lift will bend/);
  assert.match(terminal.parse(route("hold", "probe", "pulse"), "look gate").lines.join(" "), /moves on its runners/);
  assert.match(terminal.parse(route("hold", "timing", "pulse"), "look gate").lines.join(" "), /bent runner needs replacement/);
});

test("utility commands and exit aliases are parsed without changing the story", () => {
  const aliases = { help: "help", "?": "help", exit: "exit", quit: "exit", bye: "exit", restart: "restart",
    confirm: "confirm", cancel: "cancel", clear: "clear" };
  for (const state of reachable()) {
    const before = JSON.stringify(state);
    for (const [input, command] of Object.entries(aliases)) {
      assert.deepEqual(terminal.parse(state, input), { kind: "utility", command, echo: input });
    }
    assert.equal(JSON.stringify(state), before);
  }
});

test("invalid text is bounded, unexecuted and gets current-verb guidance", () => {
  const state = story.choose(story.create(), "begin").state;
  let coerced = false;
  const hostile = { toString() { coerced = true; throw new Error("do not coerce"); } };
  for (const input of [null, undefined, 1, hostile, "", " ", "hold drain", "north", "inventory", "constructor", "__proto__", "<script>alert(1)</script>", "a".repeat(65), "begin".repeat(10000)]) {
    const result = terminal.parse(state, input);
    assert.equal(result.kind, "invalid");
    assert.ok(result.echo.length <= 64);
    assert.ok(result.lines.length);
  }
  assert.equal(coerced, false);
  assert.equal(terminal.parse(state, "<script>alert(1)</script>").echo, "<script>alert(1)</script>");
  const hint = terminal.parse(state, "north").lines.join(" ");
  assert.match(hint, /brace gate or clear channel/);
  assert.equal(terminal.parse(state, "  : BRACE\t GATE  ").command, "hold");
  const ended = route("hold", "timing", "lift");
  assert.match(terminal.parse(ended, "north").lines.join(" "), /episode is complete.*restart.*exit/);
});

test("art changes with preparations and distinguishes restored from damaged gates", () => {
  const original = terminal.screen(story.create()).art;
  const braced = terminal.screen(story.choose(story.choose(story.create(), "begin").state, "hold").state).art;
  const drained = terminal.screen(story.choose(story.choose(story.create(), "begin").state, "drain").state).art;
  assert.notEqual(braced, original);
  assert.notEqual(drained, original);
  assert.notEqual(braced, drained);
  const safe = terminal.screen(route("hold", "timing", "lift")).art;
  const repair = terminal.screen(route("hold", "timing", "pulse")).art;
  assert.notEqual(safe, repair);
  assert.match(safe, /village: safe/);
  assert.match(repair, /repair needed/);
  assert.doesNotMatch(safe, /\[#\]|\[@\]/);
});

test("browser and CommonJS wrappers produce identical output without DOM or clock APIs", async () => {
  const window = {};
  for (const file of ["goku-story.js", "goku-terminal.js"]) {
    vm.runInNewContext(await readFile(new URL(`../assets/${file}`, import.meta.url), "utf8"), { window });
  }
  assert.deepEqual(Object.keys(window.PortfolioGokuTerminal).sort(), ["parse", "screen"]);
  for (const state of reachable()) {
    assert.deepEqual(JSON.parse(JSON.stringify(window.PortfolioGokuTerminal.screen(state))), terminal.screen(state));
    for (const command of ["look", "talk bulma", "map", "read", "help", "brace gate", "wait", "ki pulse"]) {
      assert.deepEqual(JSON.parse(JSON.stringify(window.PortfolioGokuTerminal.parse(state, command))), terminal.parse(state, command));
    }
  }
});
