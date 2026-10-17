import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/source-structure-effects.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window });
const effects = window.PortfolioStructureEffects;
const plain = value => JSON.parse(JSON.stringify(value));

test('maze trace visits reachable cells in breadth-first order and reconstructs an optimal legal route', () => {
  const model = effects.data.pathfinding;
  const { columns, rows, start, goal, distances, visitOrder, path } = model;
  const neighbors = id => {
    const x = id % columns, y = Math.floor(id / columns);
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => nx >= 0 && nx < columns && ny >= 0 && ny < rows && model.grid[ny][nx] !== '#')
      .map(([nx, ny]) => ny * columns + nx);
  };
  assert.equal(path[0], start);
  assert.equal(path.at(-1), goal);
  assert.equal(new Set(visitOrder).size, visitOrder.length);
  assert.ok(path.length > 10, 'the maze contains a meaningful detour');
  for (let i = 1; i < visitOrder.length; i++) assert.ok(distances[visitOrder[i]] >= distances[visitOrder[i - 1]]);
  for (let i = 1; i < path.length; i++) {
    assert.ok(neighbors(path[i - 1]).includes(path[i]), 'each route edge is orthogonal and never crosses a wall');
    assert.equal(distances[path[i]], i);
  }
  // Independent relaxation checks both the optimal distance and completeness.
  const shortest = Array(columns * rows).fill(Infinity); shortest[start] = 0;
  for (let pass = 0; pass < rows * columns; pass++) {
    let changed = false;
    for (let id = 0; id < shortest.length; id++) {
      if (!Number.isFinite(shortest[id])) continue;
      for (const next of neighbors(id)) if (shortest[next] > shortest[id] + 1) {
        shortest[next] = shortest[id] + 1; changed = true;
      }
    }
    if (!changed) break;
  }
  assert.equal(path.length - 1, shortest[goal]);
  for (let id = 0; id < shortest.length; id++) assert.equal(distances[id], Number.isFinite(shortest[id]) ? shortest[id] : -1);
});

test('quadtree partitions every point exactly once and only subdivides overflowing buckets', () => {
  const { root, points, capacity, maxDepth } = effects.data.quadtree;
  const leafIds = [], leafDepths = new Set();
  function visit(node) {
    assert.ok(node.depth <= maxDepth);
    for (const id of node.ids) {
      const point = points[id];
      assert.ok(point.x >= node.x && point.x < node.x + node.size);
      assert.ok(point.y >= node.y && point.y < node.y + node.size);
    }
    if (!node.children.length) {
      assert.ok(node.ids.length <= capacity || node.depth === maxDepth);
      leafIds.push(...node.ids); leafDepths.add(node.depth); return;
    }
    assert.ok(node.ids.length > capacity);
    assert.equal(node.children.length, 4);
    assert.deepEqual(plain(node.children).flatMap(child => child.ids).sort((a, b) => a - b), plain(node.ids).sort((a, b) => a - b));
    for (const child of node.children) {
      assert.equal(child.size, node.size / 2);
      assert.equal(child.depth, node.depth + 1);
      visit(child);
    }
  }
  visit(root);
  assert.deepEqual(leafIds.sort((a, b) => a - b), plain(points).map(point => point.id));
  assert.ok(leafDepths.size >= 2, 'sparse and dense areas retain different subdivision depths');
});

test('convolution is the exact valid Laplacian response of the displayed input', () => {
  const { input, kernel, output } = effects.data.convolution;
  assert.equal(input.length, 7);
  assert.equal(output.length, 5);
  assert.deepEqual(plain(kernel), [[0, -1, 0], [-1, 4, -1], [0, -1, 0]]);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const cy = y + 1, cx = x + 1;
    const response = input[cy][cx] * 4 - input[cy - 1][cx] - input[cy + 1][cx] - input[cy][cx - 1] - input[cy][cx + 1];
    assert.equal(output[y][x], response);
    assert.ok(Math.abs(response) <= 4);
  }
  assert.ok(output.flat().some(value => value > 0));
  assert.ok(output.flat().some(value => value < 0));
  assert.equal(output[2][2], 0, 'the flat interior has no edge response');
});

function render(kind, { width = 278, height = 260, ...overrides } = {}) {
  const calls = [], saves = [];
  const context = { save() { saves.push(true); }, restore() { assert.ok(saves.pop()); } };
  const args = { context, width, height, amount: 1, time: 0, ...overrides };
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const helpers = {
    clamp,
    smooth(value) { const t = clamp(value); return t * t * (3 - 2 * t); },
    layout(values, desiredHeight) {
      const w = Math.min(values.width - 24, 540), h = Math.min(values.height - 30, desiredHeight);
      return { w, h, left: 12, top: 15, right: 12 + w, bottom: 15 + h, scale: 1 };
    },
    begin(values) { values.context.save(); return values.context; },
    text(ctx, value, x, y, color, alpha, size = 9) { calls.push({ type: 'text', value, x, y, color, alpha, size }); },
    carry(ctx, value, x, y, color, alpha, size = 9) { calls.push({ type: 'glyph', value, x, y, color, alpha, size }); },
    segment(ctx, x, y, endX, endY, color, alpha) { calls.push({ type: 'line', x, y, endX, endY, color, alpha }); },
  };
  const bounds = effects.draw(kind, args, helpers);
  assert.equal(saves.length, 0, 'each draw restores its canvas state');
  return { calls, bounds };
}

test('all three scenes show useful static content at time zero', () => {
  const maze = render('pathfinding');
  assert.ok(maze.calls.some(call => call.value === 'S'));
  assert.ok(maze.calls.some(call => call.value === 'G'));
  assert.ok(maze.calls.filter(call => call.value === '▪').length > 40);
  const tree = render('quadtree');
  assert.ok(tree.calls.filter(call => call.type === 'line' && call.alpha > 0).length > 8, 'initial static view already contains subdivisions');
  const convolution = render('convolution');
  assert.ok(convolution.calls.filter(call => call.value === '▪').length > 10);
  assert.ok(convolution.calls.some(call => call.value === '4'), 'the displayed kernel includes its center weight');
});

test('the route and edge map finish before the six-second touch auto-return', () => {
  assert.ok(render('pathfinding', { time: 5000 }).calls.some(call => call.value?.includes('steps / shortest path')));
  assert.ok(render('convolution', { time: 5000 }).calls.some(call => call.value === '25/25 outputs · edge map complete'));
});

test('all scenes stay finite and readable within small and large canvases throughout a cycle', () => {
  for (const kind of effects.kinds) for (const width of [260, 278, 348, 564]) {
    for (const time of [0, 700, 2400, 4800, 6700, 8400, 10000, 12600, -100, 1e10]) {
      for (const pointer of [-1, 0, 1]) {
        const { calls, bounds } = render(kind, { width, time, pointerX: pointer, pointerY: -pointer });
        const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
        assert.ok(calls.length > 20 && calls.length < 500, 'draw work stays bounded');
        for (const call of calls) {
          assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y), `${kind} emits finite coordinates`);
          assert.ok(call.x >= 0 && call.x <= w && call.y >= 0 && call.y <= h, `${kind} starts inside its box`);
          assert.ok(call.alpha >= 0 && call.alpha <= 1, `${kind} emits valid alpha`);
          if (call.type === 'line') assert.ok(call.endX >= 0 && call.endX <= w && call.endY >= 0 && call.endY <= h);
          else assert.ok(call.x + call.value.length * call.size * .6 <= w + .5, `${kind} label '${call.value}' fits horizontally`);
        }
      }
    }
  }
});

test('draws are time-derived, pause-stable, source-carried and keep the cached models immutable', () => {
  const before = JSON.stringify(effects.data);
  for (const kind of effects.kinds) {
    const first = render(kind, { time: 3640 }).calls;
    render(kind, { time: 8950, pointerX: 1, pointerY: 1 });
    assert.deepEqual(render(kind, { time: 3640 }).calls, first);
    assert.ok(first.filter(call => call.type === 'glyph').length > 25);
    assert.notDeepEqual(render(kind, { time: 0 }).calls, render(kind, { time: 7500 }).calls);
  }
  assert.equal(JSON.stringify(effects.data), before);
  assert.ok(Object.isFrozen(effects.data.quadtree.root.children[0].ids));
  assert.ok(Object.isFrozen(effects.data.convolution.output[0]));
  assert.equal(effects.draw('unknown', {}, {}), null);
  assert.equal(effects.draw('quadtree', {}, {}), null);
});
