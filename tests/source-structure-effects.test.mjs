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

function render(kind, { width = 354, height = 350, ...overrides } = {}) {
  const calls = [], saves = [];
  let arc = null;
  const context = {
    globalAlpha: 1, lineWidth: 1,
    save() { saves.push(true); },
    restore() { assert.ok(saves.pop()); },
    fillRect(x, y, w, h) { calls.push({ type: 'rect', x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha }); },
    beginPath() { arc = null; },
    arc(x, y, radius) { arc = { x, y, radius }; },
    fill() { assert.ok(arc); calls.push({ type: 'circle', ...arc, color: this.fillStyle, alpha: this.globalAlpha }); },
  };
  const args = { context, width, height, amount: 1, time: 0,
    ink: '#eee', muted: '#678', accent: '#09f', highlight: '#fd0', ...overrides };
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
    segment(ctx, x, y, endX, endY, color, alpha) { calls.push({ type: 'line', x, y, endX, endY, color, alpha, width: ctx.lineWidth }); },
  };
  const bounds = effects.draw(kind, args, helpers);
  assert.equal(saves.length, 0, 'each draw restores its canvas state');
  return { calls, bounds };
}

test('time-zero scenes have solid walls, filled adaptive partitions and a nine-cell numeric kernel', () => {
  const maze = render('pathfinding');
  assert.ok(maze.calls.some(call => call.value === 'S'));
  assert.ok(maze.calls.some(call => call.value === 'G'));
  assert.ok(maze.calls.filter(call => call.type === 'rect' && call.alpha === .34).length > 20);
  const tree = render('quadtree');
  assert.ok(tree.calls.filter(call => call.type === 'line' && call.alpha > 0).length > 8);
  assert.ok(tree.calls.filter(call => call.type === 'rect' && call.alpha > 0).length > 5);
  assert.ok(tree.calls.filter(call => call.type === 'circle' && call.radius >= 2.7).length >= 32);
  const convolution = render('convolution');
  assert.ok(convolution.calls.filter(call => call.type === 'rect' && call.alpha > 0).length > 80);
  const weights = convolution.calls.filter(call => /^-?\d$/.test(call.value));
  assert.deepEqual(weights.map(call => Number(call.value)), plain(effects.data.convolution.kernel).flat());
  assert.ok(weights.every(call => call.size === 10));
});

test('continuous filled wall runs cover exactly the maze walls without gaps or blocked corridors', () => {
  const { calls, bounds } = render('pathfinding');
  const model = effects.data.pathfinding, w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
  const cell = Math.min((w - 24) / model.columns, (h - 100) / model.rows);
  const left = (w - cell * model.columns) / 2;
  const walls = calls.filter(call => call.type === 'rect' && call.alpha === .34);
  assert.ok(walls.some(wall => Math.abs(wall.w - cell * model.columns) < 1e-9), 'outer wall spans the full width continuously');
  for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.columns; x++) {
    const cx = left + (x + .5) * cell, cy = 54 + (y + .5) * cell;
    const covered = walls.some(wall => cx > wall.x && cx < wall.x + wall.w && cy > wall.y && cy < wall.y + wall.h);
    assert.equal(covered, model.grid[y][x] === '#', `wall coverage at ${x},${y}`);
  }
});

test('painted search cells and wavefront follow the actual BFS distance at the current time', () => {
  const time = 1400, { calls, bounds } = render('pathfinding', { time });
  const model = effects.data.pathfinding, w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
  const cell = Math.min((w - 24) / model.columns, (h - 100) / model.rows), left = (w - cell * model.columns) / 2;
  const reached = calls.filter(call => call.type === 'rect' && (call.color === '#09f' || call.alpha === .58));
  const ids = reached.map(call => Math.round((call.y - 54 - .5) / cell) * model.columns + Math.round((call.x - left - .5) / cell));
  const wave = time / 2800 * model.maxDistance;
  assert.deepEqual(ids.sort((a, b) => a - b), plain(model.visitOrder).filter(id => model.distances[id] <= wave).sort((a, b) => a - b));
  for (const cellFill of reached.filter(call => call.alpha === .58)) {
    const id = Math.round((cellFill.y - 54 - .5) / cell) * model.columns + Math.round((cellFill.x - left - .5) / cell);
    assert.ok(wave - model.distances[id] < 1.6, 'only the current BFS frontier receives the bright fill');
  }
  assert.ok(reached.some(call => call.alpha === .58));
});

test('the thick route traces exactly the cached shortest path and finishes before touch auto-return', () => {
  const { calls, bounds } = render('pathfinding', { time: 5000 });
  const model = effects.data.pathfinding, w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
  const cell = Math.min((w - 24) / model.columns, (h - 100) / model.rows), left = (w - cell * model.columns) / 2;
  const route = calls.filter(call => call.type === 'line' && call.alpha === .95);
  assert.equal(route.length, model.path.length - 1);
  for (let i = 0; i < route.length; i++) {
    const a = model.path[i], b = model.path[i + 1], edge = route[i];
    assert.ok(edge.width >= 3);
    assert.equal(edge.x, left + (a % model.columns + .5) * cell);
    assert.equal(edge.y, 54 + (Math.floor(a / model.columns) + .5) * cell);
    assert.equal(edge.endX, left + (b % model.columns + .5) * cell);
    assert.equal(edge.endY, 54 + (Math.floor(b / model.columns) + .5) * cell);
  }
  assert.ok(calls.some(call => call.value?.includes('steps / shortest path')));
  assert.ok(render('convolution', { time: 5000 }).calls.some(call => call.value === '25/25 outputs · edge map complete'));
});

test('quadtree query highlights the exact current bucket and its stored points', () => {
  const { calls } = render('quadtree', { time: 5000, pointerX: .8, pointerY: .8 });
  const query = { x: .5 + .8 * .48, y: .5 + .8 * .48 };
  let node = effects.data.quadtree.root;
  while (node.children.length) node = node.children.find(child => query.x >= child.x && query.x < child.x + child.size && query.y >= child.y && query.y < child.y + child.size);
  assert.equal(calls.filter(call => call.type === 'circle' && call.radius === 3.5).length, node.ids.length);
  assert.ok(calls.some(call => call.value?.endsWith(`${node.ids.length} found`)));
});

test('convolution scan shows the exact response at each of the 25 active output cells', () => {
  const output = effects.data.convolution.output;
  for (let index = 0; index < 25; index++) {
    const { calls } = render('convolution', { time: 600 + index * 160 + 80 });
    assert.ok(calls.some(call => call.value === `scan ${String(index + 1).padStart(2, '0')}/25 · weighted sum = ${output[Math.floor(index / 5)][index % 5]}`));
    const activeBorders = calls.filter(call => call.type === 'line' && call.width === 2);
    assert.equal(activeBorders.length, 8, 'one input window and one output target are visibly outlined');
  }
});

test('all scenes stay finite and readable within small and large canvases throughout a cycle', () => {
  for (const kind of effects.kinds) for (const width of [260, 278, 354, 564]) for (const height of [260, 350]) {
    for (const time of [0, 700, 2400, 4800, 6700, 8400, 10000, 12600, -100, 1e10]) {
      for (const pointer of [-1, 0, 1]) {
        const { calls, bounds } = render(kind, { width, height, time, pointerX: pointer, pointerY: -pointer });
        const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
        assert.ok(calls.length > 20 && calls.length < 500, 'draw work stays bounded');
        for (const call of calls) {
          assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y), `${kind} emits finite coordinates`);
          assert.ok(call.x >= 0 && call.x <= w && call.y >= 0 && call.y <= h, `${kind} starts inside its box`);
          assert.ok(call.alpha >= 0 && call.alpha <= 1, `${kind} emits valid alpha`);
          if (call.type === 'line') assert.ok(call.endX >= 0 && call.endX <= w && call.endY >= 0 && call.endY <= h);
          else if (call.type === 'rect') assert.ok(call.w >= 0 && call.h >= 0 && call.x + call.w <= w + .01 && call.y + call.h <= h + .01);
          else if (call.type === 'circle') assert.ok(call.x - call.radius >= 0 && call.x + call.radius <= w && call.y - call.radius >= 0 && call.y + call.radius <= h);
          else {
            assert.ok(call.size >= 10, `${kind} label '${call.value}' remains readable`);
            assert.ok(call.x + call.value.length * call.size * .6 <= w + .5, `${kind} label '${call.value}' fits horizontally`);
          }
        }
      }
    }
  }
});

test('draws are time-derived, pause-stable and keep cached models immutable', () => {
  const before = JSON.stringify(effects.data);
  for (const kind of effects.kinds) {
    const first = render(kind, { time: 3640 }).calls;
    render(kind, { time: 8950, pointerX: 1, pointerY: 1 });
    assert.deepEqual(render(kind, { time: 3640 }).calls, first);
    assert.ok(first.filter(call => call.type === 'rect' || call.type === 'circle').length > 20);
    assert.notDeepEqual(render(kind, { time: 0 }).calls, render(kind, { time: 7500 }).calls);
  }
  assert.equal(JSON.stringify(effects.data), before);
  assert.ok(Object.isFrozen(effects.data.quadtree.root.children[0].ids));
  assert.ok(Object.isFrozen(effects.data.convolution.output[0]));
  assert.equal(effects.draw('unknown', {}, {}), null);
  assert.equal(effects.draw('quadtree', {}, {}), null);
});

test('filled geometry fades in late while source characters construct and dissolve the diagrams', () => {
  for (const kind of effects.kinds) {
    const glyphs = [{ x: 12, y: 20, glyph: 'x' }];
    const entering = render(kind, { amount: .25, glyphs }).calls;
    assert.ok(entering.filter(call => call.type === 'rect' || call.type === 'circle').every(call => call.alpha === 0));
    assert.ok(entering.some(call => call.type === 'glyph' && call.alpha > 0), `${kind} retains source-carried construction marks`);
    const gathering = render(kind, { amount: .70, glyphs }).calls;
    assert.ok(gathering.some(call => call.type === 'rect' && call.alpha > 0));
    const settled = render(kind, { amount: 1, glyphs }).calls;
    assert.equal(settled.filter(call => call.type === 'glyph' && call.value !== 'S' && call.value !== 'G').length, 0, 'construction punctuation disappears at rest');
  }
});
