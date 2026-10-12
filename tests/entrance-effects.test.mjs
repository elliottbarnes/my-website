import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/entrance-effects.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window });
const effects = window.PortfolioEntranceEffects;

// Record the visible drawing operations, including their canvas coordinates.
function surface() {
  const calls = { text: [], boxes: [], curves: [], lines: [], dots: [] };
  let transform = { x: 0, y: 0, scale: 1 }, start = null;
  const saved = [];
  const point = (x, y) => ({ x: transform.x + x * transform.scale, y: transform.y + y * transform.scale });
  const context = {
    save() { saved.push({ ...transform }); },
    restore() { transform = saved.pop(); },
    translate(x, y) { transform.x += x * transform.scale; transform.y += y * transform.scale; },
    scale(x, y) { assert.equal(x, y); transform.scale *= x; },
    fillText(value, x, y) { calls.text.push({ value, ...point(x, y) }); },
    strokeRect(x, y, width, height) {
      calls.boxes.push({ ...point(x, y), width: width * transform.scale, height: height * transform.scale });
    },
    beginPath() { start = null; },
    moveTo(x, y) { start = point(x, y); },
    lineTo(x, y) { calls.lines.push({ start, end: point(x, y) }); },
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      calls.curves.push({ start, control1: point(x1, y1), control2: point(x2, y2), end: point(x, y) });
    },
    arc(x, y, radius) { calls.dots.push({ ...point(x, y), radius: radius * transform.scale }); },
    stroke() {}, fill() {},
  };
  return { context, calls };
}

function draw(kind, overrides = {}) {
  const { context, calls } = surface();
  const bounds = effects.draw(kind, {
    context, width: 348, height: 360, amount: 1, time: 1200,
    anchor: { x: .5, y: .5, sourceX: .3, sourceY: .4, text: "const value = 42;" },
    snippet: { repo: "glassbox", path: "docs/core.js", code: "const value = 42; // source comment" },
    ...overrides,
  });
  return { calls, bounds };
}

const sha = {
  root: "a123456" + "0".repeat(33),
  left: "b234567" + "0".repeat(33),
  right: "c345678" + "0".repeat(33),
  merge: "d456789" + "0".repeat(33),
};

test("history displays supplied commit hashes and connects their actual parent relationships", () => {
  const { calls } = draw("history", { history: [
    { sha: sha.merge, parents: [{ sha: sha.left }, { sha: sha.right }], message: "Merge experiment\nDetails" },
    { sha: sha.right, parents: [sha.root], message: "Right branch" },
    { sha: sha.left, parents: [sha.root], message: "Left branch" },
    { sha: sha.root, parents: [], message: "Initial source" },
  ] });
  const hashes = calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value));
  assert.deepEqual(hashes.map(entry => entry.value).sort(), Object.values(sha).map(value => value.slice(0, 7)).sort());
  assert.equal(calls.curves.length, 4, "a merge has two real parents, rather than an invented linear chain");
  const node = hash => {
    const label = hashes.find(entry => entry.value === hash.slice(0, 7));
    return calls.boxes.find(box => label.x >= box.x && label.x < box.x + box.width
      && label.y >= box.y && label.y <= box.y + box.height);
  };
  for (const [parent, child] of [[sha.root, sha.left], [sha.root, sha.right], [sha.left, sha.merge], [sha.right, sha.merge]]) {
    const from = node(parent), to = node(child);
    assert.ok(calls.curves.some(curve => curve.start.x === from.x + from.width && curve.start.y === from.y + from.height / 2
      && curve.end.x === to.x && curve.end.y === to.y + to.height / 2), "every drawn edge must end at its supplied child");
  }
  assert.ok(calls.text.some(entry => entry.value === "merge experiment"));
  assert.ok(calls.text.some(entry => entry.value === "glassbox/"));
  assert.ok(calls.text.some(entry => entry.value.includes("core.js")));
});

test("history does not imply ancestry for unrelated commits and marks omitted parents only with a stub", () => {
  const unrelated = draw("history", { history: [{ sha: sha.left }, { sha: sha.root }] });
  assert.equal(unrelated.calls.curves.length, 0);
  assert.equal(unrelated.calls.dots.length, 0);
  const omitted = draw("history", { history: [{ sha: sha.left, parents: [sha.root] }] });
  assert.equal(omitted.calls.curves.length, 1);
  assert.equal(omitted.calls.dots.length, 0, "an omitted parent should not receive a fabricated traveling commit");
  const edge = omitted.calls.curves[0];
  const commit = omitted.calls.boxes[0];
  assert.equal(edge.end.x, commit.x);
  assert.ok(edge.end.x - edge.start.x > 0 && edge.end.x - edge.start.x < commit.width,
    "the omitted parent should be a short continuation into the visible commit");
  assert.deepEqual(omitted.calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value)).map(entry => entry.value), [sha.left.slice(0, 7)]);
});

test("empty or malformed history falls back to pinned source without inventing commit hashes", () => {
  for (const history of [undefined, [], [{ sha: "not-a-commit", parents: [sha.root] }], [null]]) {
    const { calls } = draw("history", { history });
    assert.ok(calls.text.some(entry => entry.value === "commit-pinned source"));
    assert.equal(calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value)).length, 0);
    assert.equal(calls.curves.length, 0);
    assert.equal(calls.boxes.length, 0);
  }
});

test("compile sketches show real source tokens and identify each project's output", () => {
  for (const [repo, output] of [["glassbox", "wasm"], ["pixel-language", "glsl"], ["architecture-lab", "pixels"], ["automata-lab", "dfa"], ["other", "output"]]) {
    const { calls } = draw("tokens", {
      anchor: { text: "return 17;" },
      snippet: { repo, path: "src/example.js", code: "const visible = 42; // ignored" },
    });
    const labels = calls.text.map(entry => entry.value);
    assert.ok(labels.includes(output), `${repo} should identify its own illustrative output`);
    assert.ok(labels.includes("return"));
    assert.ok(labels.includes("17"));
    assert.ok(labels.includes("visible"));
    assert.equal(labels.includes("ignored"), false, "comment prose should not become a source token");
    assert.equal(labels.includes("undefined"), false);
  }
  assert.doesNotThrow(() => draw("tokens", { snippet: {}, anchor: {} }));
});

test("effects stay within a narrow mobile canvas while expanding from taps near its edges", () => {
  for (const kind of ["history", "tokens"]) {
    for (const width of [320, 348, 390]) {
      const height = 280;
      for (const amount of [0, .08, .2, .5, .8, 1]) {
        for (const corner of [0, 1]) {
          const { calls, bounds } = draw(kind, {
            width, height, amount,
            anchor: { x: corner, y: corner, sourceX: corner, sourceY: corner, text: "const x = 42;" },
            history: [{ sha: sha.left, parents: [sha.root] }, { sha: sha.root, parents: [] }],
          });
          assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= width && bounds.bottom <= height,
            `${kind} reveal must fit ${width}px at amount ${amount}`);
          for (const box of calls.boxes) {
            assert.ok(box.x >= bounds.left && box.y >= bounds.top && box.x + box.width <= bounds.right + .001 && box.y + box.height <= bounds.bottom + .001);
          }
          for (const label of calls.text) {
            assert.ok(Number.isFinite(label.x) && Number.isFinite(label.y));
            assert.ok(label.x >= bounds.left && label.x <= bounds.right && label.y >= bounds.top && label.y <= bounds.bottom);
          }
        }
      }
    }
  }
});

test("unsupported effects and unavailable canvases are harmless", () => {
  assert.equal(effects.draw("history", {}), null);
  assert.equal(effects.draw("history", { context: surface().context, width: 0, height: 360 }), null);
  assert.equal(draw("unknown").bounds, null);
});
