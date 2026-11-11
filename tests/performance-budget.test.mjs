import test from "node:test";
import assert from "node:assert/strict";
import { checkBudgets, entryResourcePaths, staticModuleImports } from "../scripts/check-performance.mjs";

const measurement = { eagerJavaScript: { rawBytes: 100, count: 2 }, eagerCSS: { rawBytes: 50 }, htmlBytes: 20, publicBytes: 500 };
const budget = { eagerJavaScriptBytes: 100, eagerScriptCount: 2, eagerCSSBytes: 50, htmlBytes: 20, publicBytes: 500 };
test("performance gates permit the boundary and reject each independent regression", () => {
  assert.equal(checkBudgets(measurement, budget).length, 5);
  for (const key of Object.keys(budget)) {
    assert.throws(() => checkBudgets(measurement, { ...budget, [key]: budget[key] - 1 }), /exceeds budget/);
    assert.throws(() => checkBudgets(measurement, { ...budget, [key]: null }), /invalid budget/);
  }
});

test("static module imports count toward entry bytes while lazy imports do not", () => {
  assert.deepEqual(staticModuleImports(`import { createWorld, stepWorld } from './ring-physics.mjs';
    import './bootstrap.js';
    import * as geometry from "./geometry.mjs";
    const lazy = () => import('./playground.mjs');`),
  ['./ring-physics.mjs', './bootstrap.js', './geometry.mjs']);
});

test("entry budgets count valid attribute spellings and exclude comments and inline data", () => {
  assert.deepEqual(entryResourcePaths(`<SCRIPT defer SRC='/one.js'></SCRIPT>
    <script src=/two.js></script><link HREF='/one.css' REL='alternate STYLESHEET'>
    <link rel="stylesheet" href="/two.css" data-label="x > y">
    <!-- <script src='/comment.js'></script> -->
    <script type="application/ld+json">{"example":"<link rel='stylesheet' href='/data.css'>"}</script>`),
  { scripts: ['/one.js', '/two.js'], styles: ['/one.css', '/two.css'] });
  assert.throws(() => entryResourcePaths('<link rel=stylesheet>'), /empty URL/);
  assert.throws(() => entryResourcePaths('<script src=""></script>'), /empty URL/);
});
