import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const story = require("../assets/goku-story.js");

test("the first encounter states the objective and the costs before either decision", () => {
  const opening = story.create();
  assert.equal(story.view(opening).objective, "release the spillway safely and keep the village below dry");
  const start = story.choose(opening, "begin");
  assert.equal(start.accepted, true);
  assert.deepEqual(story.view(start.state).choices.map(choice => choice.command), ["hold", "drain"]);
  const text = story.view(start.state).paragraphs.join(" ");
  assert.match(text, /runners straight/);
  assert.match(text, /pressure off the jam/);
  assert.match(text, /unsupported/);
});

test("both first decisions produce immediate, distinct consequences without mutating the input", () => {
  const before = story.choose(story.create(), "begin").state;
  const snapshot = JSON.stringify(before);
  for (const command of ["hold", "drain"]) {
    const result = story.choose(before, command);
    assert.equal(result.accepted, true);
    assert.equal(result.state.node, "aftermath");
    assert.equal(result.state.choices.approach, command);
    assert.equal(result.state.revision, before.revision + 1);
    assert.equal(JSON.stringify(before), snapshot);
    assert.equal(result.state.trail.at(-1).command, command);
    assert.match(story.view(result.state).paragraphs.join(" "), command === "hold" ? /brace holds/ : /mark on the reservoir wall begins to emerge/);
  }
});

test("invalid and stale input cannot advance the encounter", () => {
  const state = story.choose(story.create(), "begin").state;
  for (const [command, revision] of [["blast", 1], ["hold", 0], ["", 1]]) {
    const result = story.choose(state, command, revision);
    assert.equal(result.accepted, false);
    assert.equal(result.state, state);
  }
});

function traverse() {
  const pending = [{ state: story.create(), inputs: [], views: [] }];
  const visited = [];
  while (pending.length) {
    assert.ok(visited.length < 100, "the episode must have a finite graph, without a hidden replay loop");
    const item = pending.shift();
    const scene = story.view(item.state);
    item.views.push(scene);
    visited.push(item);
    for (const choice of scene.choices) {
      const result = story.choose(item.state, choice.command, item.state.revision);
      assert.equal(result.accepted, true, `advertised command ${choice.command} must be accepted in ${scene.id}`);
      pending.push({ state: result.state, inputs: [...item.inputs, choice.command], views: [...item.views] });
    }
  }
  return visited;
}

const outcomes = new Map([
  ["hold/timing/lift", "gate preserved"],
  ["hold/timing/pulse", "runner needs repair"],
  ["hold/probe/lift", "gate preserved"],
  ["hold/probe/pulse", "gate preserved"],
  ["drain/timing/lift", "gate preserved"],
  ["drain/timing/pulse", "gate preserved"],
  ["drain/probe/lift", "runner needs repair"],
  ["drain/probe/pulse", "gate preserved"],
]);

test("all eight decision paths terminate with no empty scene, hidden action or softlock", () => {
  const visited = traverse();
  const endings = visited.filter(({ state }) => story.view(state).complete);
  assert.equal(endings.length, 8);
  assert.deepEqual([...new Set(visited.map(({ state }) => state.node))].sort(),
    ["aftermath", "arrival", "banks", "ending", "prepared", "release", "survey"]);
  for (const { state, inputs, views } of visited) {
    const scene = views.at(-1);
    assert.ok(scene.title && scene.objective && scene.paragraphs.length, `${scene.id} must be readable`);
    assert.ok(scene.paragraphs.every(text => typeof text === "string" && text.length > 0));
    assert.ok(scene.complete || scene.choices.length > 0, `${scene.id} must offer a way forward`);
    assert.equal(new Set(scene.choices.map(choice => choice.command)).size, scene.choices.length);
    assert.equal(state.revision, inputs.length);
    assert.equal(state.trail.length, inputs.length);
    assert.ok(state.revision <= 6, "one episode must end within six transitions");
    assert.deepEqual(Object.keys(state).sort(), ["choices", "node", "revision", "trail"]);
    assert.deepEqual(Object.keys(state.choices).sort(), ["approach", "method", "resolution"]);
    const decisions = Object.values(state.choices).filter(Boolean).length;
    assert.ok(decisions <= 3);
    assert.ok(scene.decision >= 0 && scene.decision <= 3);
    if (scene.complete) {
      assert.equal(decisions, 3);
      assert.equal(inputs.length, 6);
      assert.equal(scene.choices.length, 0);
    }
  }
});

test("ending and pre-release stakes honor all eight documented cause-and-effect fixtures", () => {
  const routes = new Set();
  for (const { state, views } of traverse().filter(({ state }) => story.view(state).complete)) {
    const { approach, method, resolution } = state.choices;
    const route = `${approach}/${method}/${resolution}`;
    routes.add(route);
    const ending = views.at(-1);
    assert.match(ending.summary[2], new RegExp(outcomes.get(route)));
    assert.match(ending.summary[3], /village safe/);
    assert.match(ending.summary[0], approach === "hold" ? /braced frame/ : /relieved pressure/);
    assert.match(ending.summary[1], method === "timing" ? /quiet beat learned/ : /seam found/);
    assert.match(ending.summary[2], resolution === "lift" ? /controlled lift/ : /ki pulse/);
    const text = ending.paragraphs.join(" ");
    assert.match(text, approach === "hold" ? /beam you placed/ : /relief channel you cleared/);
    assert.match(text, method === "timing" ? /Learning Bulma's quiet beat/ : /test pulse revealed/);
    assert.match(text, /flour|flour sack/);
    const releaseChoice = views.at(-2).choices.find(choice => choice.command === resolution);
    assert.match(releaseChoice.detail, outcomes.get(route) === "gate preserved" ? /remains usable/ : /need repair/);
    const journal = state.trail.at(-1).response.join(" ");
    assert.match(journal, outcomes.get(route) === "gate preserved" ? /remains usable/ : /needs repair/);
  }
  assert.deepEqual([...routes].sort(), [...outcomes.keys()].sort());
});

test("replaying identical commands yields identical states and prose", () => {
  for (const route of traverse().filter(({ state }) => story.view(state).complete)) {
    let state = story.create();
    const views = [story.view(state)];
    for (const command of route.inputs) {
      state = story.choose(state, command).state;
      views.push(story.view(state));
    }
    assert.deepEqual(state, route.state);
    assert.deepEqual(views, route.views);
  }
});

test("invalid input preserves every reachable state and never executes or coerces input", () => {
  const badObject = { toString() { throw new Error("must not coerce arbitrary input"); } };
  const invalid = ["", " ", "unknown", "hold drain", "<script>alert(1)</script>", "x".repeat(1000), null, undefined, 1, [], badObject];
  for (const { state } of traverse()) {
    const before = JSON.stringify(state);
    for (const raw of invalid) {
      const result = story.choose(state, raw);
      assert.equal(result.accepted, false);
      assert.equal(result.state, state);
      assert.equal(JSON.stringify(state), before);
    }
  }
});

test("a stale action cannot consume a new scene even when its command remains meaningful", () => {
  for (const { state } of traverse()) {
    for (const choice of story.view(state).choices) {
      const next = story.choose(state, choice.command, state.revision).state;
      for (const nextChoice of story.view(next).choices) {
        const stale = story.choose(next, nextChoice.command, state.revision);
        assert.equal(stale.accepted, false);
        assert.equal(stale.state, next);
      }
      const repeated = story.choose(next, choice.command, state.revision);
      assert.equal(repeated.accepted, false);
      assert.equal(repeated.state, next);
    }
  }
});

test("states and journal entries are immutable while returned views are disposable", () => {
  let state = story.choose(story.create(), "begin").state;
  state = story.choose(state, "hold").state;
  const before = JSON.stringify(state);
  assert.throws(() => { state.node = "ending"; }, TypeError);
  assert.throws(() => { state.choices.method = "probe"; }, TypeError);
  assert.throws(() => state.trail.push({}), TypeError);
  assert.throws(() => { state.trail[0].command = "pulse"; }, TypeError);
  assert.throws(() => state.trail[0].response.push("changed"), TypeError);
  const scene = story.view(state);
  scene.paragraphs[0] = "changed";
  scene.choices[0].command = "changed";
  assert.notEqual(story.view(state).paragraphs[0], "changed");
  assert.equal(story.view(state).choices[0].command, "continue");
  assert.equal(JSON.stringify(state), before);
});

test("commands normalize only short text with an optional terminal prefix", () => {
  for (const [input, expected] of [[" HOLD ", "hold"], [":probe", "probe"], ["/timing", "timing"], ["\n  : LIFT \t", "lift"], ["", ""], ["a".repeat(65), ""], [null, ""]]) {
    assert.equal(story.normalize(input), expected);
  }
  const state = story.choose(story.create(), ":BEGIN").state;
  assert.equal(story.choose(state, "/HOLD").state.choices.approach, "hold");
});

test("all interface labels stay lowercase and narrative commands remain explicit", () => {
  for (const { state } of traverse()) {
    const scene = story.view(state);
    for (const text of [scene.title, scene.objective, ...scene.summary, ...scene.choices.flatMap(choice => [choice.command, choice.label, choice.detail])]) {
      assert.equal(text, text.toLowerCase());
    }
    for (const choice of scene.choices) assert.match(choice.command, /^[a-z]+$/);
  }
});

test("journal records a short consequence per transition, not duplicate scene prose", () => {
  for (const { state } of traverse()) {
    for (const entry of state.trail) {
      assert.deepEqual(Object.keys(entry).sort(), ["command", "label", "response", "title"]);
      assert.ok(entry.title && entry.label && entry.command && entry.response.length);
      assert.ok(entry.response.join(" ").split(/\s+/).length <= 30);
    }
  }
});

test("browser and Node expose the same deterministic API without timers or network access", async () => {
  const window = {};
  vm.runInNewContext(await readFile(new URL("../assets/goku-story.js", import.meta.url), "utf8"), { window });
  assert.deepEqual(Object.keys(window.PortfolioGokuStory).sort(), ["choose", "create", "normalize", "view"]);
  assert.deepEqual(JSON.parse(JSON.stringify(window.PortfolioGokuStory.create())), story.create());
  let state = window.PortfolioGokuStory.create();
  for (const input of ["begin", "drain", "continue", "probe", "continue", "lift"]) {
    state = window.PortfolioGokuStory.choose(state, input).state;
  }
  assert.equal(window.PortfolioGokuStory.view(state).complete, true);
  assert.match(window.PortfolioGokuStory.view(state).summary[2], /runner needs repair/);
});
