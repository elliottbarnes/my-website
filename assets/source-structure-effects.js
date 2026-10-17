// Bounded, deterministic algorithm studies drawn from the existing source glyphs.
(() => {
  const kinds = Object.freeze(['pathfinding', 'quadtree', 'convolution']);
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const cycle = (time, duration) => ((time % duration) + duration) % duration;

  // Cache the actual breadth-first traversal and its shortest route once.
  const maze = [
    '#############',
    '#S....#.....#',
    '###.#.#.###.#',
    '#...#...#...#',
    '#.#####.#.#.#',
    '#.....#.#.#.#',
    '#.###.#.#.#G#',
    '#...#.....#.#',
    '#############',
  ];
  const pathfinding = (() => {
    const columns = maze[0].length, rows = maze.length;
    const start = maze.join('').indexOf('S'), goal = maze.join('').indexOf('G');
    const distances = Array(rows * columns).fill(-1), parents = Array(rows * columns).fill(-1);
    const visitOrder = [start]; distances[start] = 0;
    for (let head = 0; head < visitOrder.length; head++) {
      const id = visitOrder[head], x = id % columns, y = Math.floor(id / columns);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy, next = ny * columns + nx;
        if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || maze[ny][nx] === '#' || distances[next] >= 0) continue;
        distances[next] = distances[id] + 1; parents[next] = id; visitOrder.push(next);
      }
    }
    const path = [];
    for (let id = goal; id !== -1; id = parents[id]) path.unshift(id);
    return { grid: maze, columns, rows, start, goal, distances, visitOrder, path, maxDistance: Math.max(...distances) };
  })();

  // The clustered points make adaptive subdivision visible; each point belongs
  // to exactly one half-open quadrant, including points on a split boundary.
  const quadtree = (() => {
    const points = [
      [.10, .12], [.16, .17], [.20, .09], [.22, .23], [.08, .27], [.29, .16],
      [.34, .29], [.41, .12], [.15, .40], [.28, .42], [.43, .38], [.51, .21],
      [.66, .10], [.81, .18], [.91, .33], [.73, .40], [.58, .43], [.09, .62],
      [.20, .81], [.34, .64], [.43, .91], [.48, .56], [.61, .68], [.69, .75],
      [.76, .67], [.82, .79], [.90, .72], [.87, .91], [.71, .91], [.62, .86],
      [.54, .75], [.94, .54],
    ].map(([x, y], id) => ({ x, y, id }));
    const capacity = 3, maxDepth = 3;
    const split = (x, y, size, ids, depth) => {
      const node = { x, y, size, ids, depth, children: [] };
      if (ids.length > capacity && depth < maxDepth) {
        const half = size / 2;
        for (let quadrant = 0; quadrant < 4; quadrant++) {
          const right = quadrant % 2, bottom = Math.floor(quadrant / 2);
          const children = ids.filter(id => Number(points[id].x >= x + half) === right && Number(points[id].y >= y + half) === bottom);
          node.children.push(split(x + right * half, y + bottom * half, half, children, depth + 1));
        }
      }
      return node;
    };
    return { points, capacity, maxDepth, root: split(0, 0, 1, points.map(point => point.id), 0) };
  })();

  // Valid 3×3 Laplacian convolution: every output is a real integer sum.
  const convolution = (() => {
    const input = ['0011100', '0100010', '1000001', '1000000', '1000001', '0100010', '0011100']
      .map(row => [...row].map(Number));
    const kernel = [[0, -1, 0], [-1, 4, -1], [0, -1, 0]];
    const output = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) =>
      kernel.reduce((sum, row, ky) => sum + row.reduce((subtotal, weight, kx) => subtotal + weight * input[y + ky][x + kx], 0), 0)));
    return { input, kernel, output };
  })();
  const data = freeze({ pathfinding, quadtree, convolution });

  function outline(ctx, x, y, w, h, color, alpha, segment) {
    segment(ctx, x, y, x + w, y, color, alpha);
    segment(ctx, x + w, y, x + w, y + h, color, alpha);
    segment(ctx, x + w, y + h, x, y + h, color, alpha);
    segment(ctx, x, y + h, x, y, color, alpha);
  }

  function drawPathfinding(args, box, ctx, helpers) {
    const { text, carry, segment, clamp, smooth } = helpers;
    const { amount, time, ink, muted, accent, highlight } = args;
    const model = data.pathfinding;
    const phase = cycle(time, 11000), search = clamp(phase / 2800);
    const wave = search * model.maxDistance;
    const route = clamp((phase - 3100) / 1600) * (model.path.length - 1);
    const cell = Math.min((box.w - 24) / model.columns, (box.h - 78) / model.rows);
    const left = (box.w - cell * model.columns) / 2, top = 39;
    const center = id => ({ x: left + (id % model.columns + .5) * cell, y: top + (Math.floor(id / model.columns) + .5) * cell });
    text(ctx, 'pathfinding / breadth-first search', 6, 13, accent, amount * .95, box.w < 340 ? 8 : 9);
    text(ctx, phase < 3100 ? 'explore every reachable corridor' : 'trace the shortest route', 6, 29, muted, amount * .7, 7);
    for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.columns; x++) {
      const id = y * model.columns + x, p = center(id), wall = model.grid[y][x] === '#';
      if (id === model.start || id === model.goal) continue;
      const distance = model.distances[id], reached = distance >= 0 && distance <= wave;
      const frontier = reached && wave - distance < 1.6 && search < 1;
      const glyph = wall ? '▪' : frontier ? '+' : reached ? '·' : '·';
      carry(ctx, glyph, p.x - cell * .22, p.y, wall ? muted : frontier ? highlight : accent,
        amount * (wall ? .48 : frontier ? .95 : reached ? .62 : .13), wall ? cell * .78 : frontier ? cell * .67 : cell * .75);
    }
    if (route > 0) {
      const full = Math.floor(route), progress = smooth(route - full);
      for (let i = 1; i < model.path.length && i <= full + 1; i++) {
        const a = center(model.path[i - 1]), b = center(model.path[i]), t = i > full ? progress : 1;
        segment(ctx, a.x, a.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, highlight, amount * .82);
      }
      const a = center(model.path[full]), b = center(model.path[Math.min(full + 1, model.path.length - 1)]);
      carry(ctx, '◆', a.x + (b.x - a.x) * progress - 3, a.y + (b.y - a.y) * progress, ink, amount, 9);
    }
    for (const [id, label] of [[model.start, 'S'], [model.goal, 'G']]) {
      const p = center(id);
      carry(ctx, label, p.x - 3.4, p.y, id === model.goal && route < model.path.length - 1 ? accent : highlight, amount, Math.min(12, cell * .8));
    }
    const visited = model.visitOrder.filter(id => model.distances[id] <= wave).length;
    text(ctx, route >= model.path.length - 1 ? `${model.path.length - 1} steps / shortest path` : `${visited}/${model.visitOrder.length} cells reached`, 6, box.h - 23, highlight, amount * .9, 8);
    text(ctx, 'S → G · walls block the frontier', 6, box.h - 8, muted, amount * .72, 7);
  }

  function drawQuadtree(args, box, ctx, helpers) {
    const { text, carry, segment, clamp, smooth } = helpers;
    const { amount, time, muted, accent, highlight } = args;
    const model = data.quadtree, phase = cycle(time + 2800, 12500);
    const refinement = clamp((phase - 600) / 1400, 0, model.maxDepth);
    const depth = Math.floor(refinement), partial = smooth(refinement - depth);
    const left = 14, top = 43, width = box.w - 28, height = box.h - 81;
    const px = clamp(args.pointerX || 0, -1, 1), py = clamp(args.pointerY || 0, -1, 1);
    const pointed = Math.abs(px) + Math.abs(py) > .035;
    const query = pointed ? { x: .5 + px * .48, y: .5 + py * .48 }
      : { x: .5 + Math.sin(time / 2100) * .39, y: .5 + Math.cos(time / 2700 + .7) * .39 };
    const contains = node => query.x >= node.x && query.x < node.x + node.size && query.y >= node.y && query.y < node.y + node.size;
    let selected = model.root, visibleLeaves = 0;
    const drawNode = node => {
      if (contains(node) && node.depth <= depth) selected = node;
      if (!node.children.length || node.depth >= depth) visibleLeaves++;
      if (!node.children.length || node.depth > depth) return;
      const alpha = amount * (node.depth === depth ? partial : 1) * (.35 + node.depth * .08);
      const x = left + node.x * width, y = top + node.y * height, w = node.size * width, h = node.size * height;
      segment(ctx, x + w / 2, y, x + w / 2, y + h, muted, alpha);
      segment(ctx, x, y + h / 2, x + w, y + h / 2, muted, alpha);
      if (node.depth < depth) node.children.forEach(drawNode);
    };
    text(ctx, 'quadtree / divide where it is dense', 6, 13, accent, amount * .95, box.w < 340 ? 8 : 9);
    text(ctx, '32 points · split buckets above 3', 6, 29, muted, amount * .7, 7);
    outline(ctx, left, top, width, height, muted, amount * .34, segment);
    drawNode(model.root);
    outline(ctx, left + selected.x * width, top + selected.y * height, selected.size * width, selected.size * height,
      highlight, amount * .88, segment);
    const selectedIds = new Set(selected.ids);
    for (const point of model.points) {
      const active = selectedIds.has(point.id);
      carry(ctx, active ? '+' : '•', left + point.x * width - 2.5, top + point.y * height,
        active ? highlight : accent, amount * (active ? 1 : .72), active ? 10 : 9);
    }
    const qx = left + query.x * width, qy = top + query.y * height;
    carry(ctx, '×', qx - 3, qy, highlight, amount * .85, 10);
    text(ctx, `depth ${depth} · ${visibleLeaves} leaves · query ${selected.ids.length}`, 6, box.h - 23, highlight, amount * .9, 8);
    text(ctx, 'move → query a cell · + marks its points', 6, box.h - 8, muted, amount * .72, 7);
  }

  function drawConvolution(args, box, ctx, helpers) {
    const { text, carry, segment, clamp } = helpers;
    const { amount, time, muted, accent, highlight } = args;
    const model = data.convolution, phase = cycle(time, 10300), clock = Math.max(0, (phase - 600) / 160);
    const index = Math.min(24, Math.floor(clock)), finished = clock >= 25;
    const sx = index % 5, sy = Math.floor(index / 5);
    const areaWidth = Math.min(box.w - 16, 384), left = (box.w - areaWidth) / 2;
    const cell = Math.min(21, (areaWidth - 54) / 12, (box.h - 102) / 7);
    const top = 58, outputX = left + areaWidth - cell * 5, outputY = top + cell;
    const gapLeft = left + cell * 7, gapRight = outputX, middle = (gapLeft + gapRight) / 2;
    const middleY = top + cell * 3.5, kernelCell = 9;
    text(ctx, 'convolution / pixels → edges', 6, 13, accent, amount * .95, box.w < 340 ? 8 : 9);
    text(ctx, 'input 7×7', left, 38, muted, amount * .8, 8);
    text(ctx, 'output 5×5', outputX, 38, accent, amount * .9, 8);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const value = model.input[y][x], active = !finished && x >= sx && x < sx + 3 && y >= sy && y < sy + 3;
      carry(ctx, value ? '▪' : '·', left + (x + .5) * cell - cell * .23, top + (y + .5) * cell,
        active ? highlight : accent, amount * (value ? .85 : active ? .44 : .17), value ? cell * .95 : cell * .75);
    }
    if (!finished) outline(ctx, left + sx * cell, top + sy * cell, cell * 3, cell * 3, highlight, amount * .76, segment);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const value = model.output[y][x], done = y * 5 + x < index || finished, active = y * 5 + x === index && !finished;
      carry(ctx, done || active ? Math.abs(value) ? '▪' : '·' : '·', outputX + (x + .5) * cell - cell * .23, outputY + (y + .5) * cell,
        active ? highlight : accent, amount * (done || active ? .18 + Math.abs(value) / 4 * .82 : .12),
        Math.abs(value) && (done || active) ? cell * .95 : cell * .75);
    }
    if (!finished) outline(ctx, outputX + sx * cell, outputY + sy * cell, cell, cell, highlight, amount * .82, segment);
    const kernelLeft = middle - kernelCell * 1.5, kernelTop = middleY - kernelCell * 1.5;
    model.kernel.forEach((row, y) => row.forEach((value, x) => {
      text(ctx, String(value), kernelLeft + x * kernelCell + (value < 0 ? 0 : 2), kernelTop + (y + .5) * kernelCell,
        value ? highlight : muted, amount * (value ? .9 : .5), 7);
    }));
    text(ctx, '3×3', middle - 7, kernelTop - 11, muted, amount * .75, 7);
    segment(ctx, gapLeft + 4, middleY, kernelLeft - 4, middleY, muted, amount * .32);
    segment(ctx, kernelLeft + kernelCell * 3 + 4, middleY, gapRight - 4, middleY, accent, amount * .52);
    carry(ctx, '›', gapRight - 8, middleY, highlight, amount * .85, 12);
    const progress = clamp(clock - Math.floor(clock));
    if (!finished) carry(ctx, '·', gapLeft + 4 + (gapRight - gapLeft - 8) * progress, middleY + 28, highlight, amount * .8, 12);
    text(ctx, finished ? '25/25 outputs · edge map complete' : `scan ${String(index + 1).padStart(2, '0')}/25 · weighted sum = ${model.output[sy][sx]}`,
      6, box.h - 23, highlight, amount * .9, 8);
    text(ctx, 'Laplacian · brightness = |response|', 6, box.h - 8, muted, amount * .72, 7);
  }

  window.PortfolioStructureEffects = Object.freeze({
    kinds,
    data,
    draw(kind, args, helpers) {
      if (!kinds.includes(kind) || !args?.context || !(args.width > 0) || !(args.height > 0) || !helpers?.layout) return null;
      const ink = args.ink || '#cbcbb6', accent = args.accent || ink;
      const values = { ...args, time: Number.isFinite(args.time) ? args.time : 0, amount: helpers.clamp(args.amount ?? 1),
        ink, accent, muted: args.muted || ink, highlight: args.highlight || accent };
      const box = helpers.layout(values, 260), ctx = helpers.begin(values, box);
      try {
        if (kind === 'pathfinding') drawPathfinding(values, box, ctx, helpers);
        if (kind === 'quadtree') drawQuadtree(values, box, ctx, helpers);
        if (kind === 'convolution') drawConvolution(values, box, ctx, helpers);
      } finally { ctx.restore(); }
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    },
  });
})();
