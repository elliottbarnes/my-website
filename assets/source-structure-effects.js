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

  // Native geometry arrives after the source characters have begun to gather.
  // Labels and sparse construction marks still travel through the shared morph.
  const geometry = (amount, smooth) => amount * smooth((amount - .38) / .62);
  function fill(ctx, x, y, w, h, color, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  }
  function outline(ctx, x, y, w, h, color, alpha, segment, width = 1) {
    ctx.lineWidth = width;
    segment(ctx, x, y, x + w, y, color, alpha);
    segment(ctx, x + w, y, x + w, y + h, color, alpha);
    segment(ctx, x + w, y + h, x, y + h, color, alpha);
    segment(ctx, x, y + h, x, y, color, alpha);
    ctx.lineWidth = 1;
  }
  function circle(ctx, x, y, radius, color, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }
  function sourceMark(args, ctx, helpers, glyph, x, y, color, size = 10) {
    if (args.glyphs?.length && args.amount < .995) {
      helpers.carry(ctx, glyph, x, y, color, args.amount * (1 - helpers.smooth((args.amount - .72) / .27)), size);
    }
  }
  function progressBar(ctx, x, y, width, progress, color, muted, alpha) {
    fill(ctx, x, y, width, 3, muted, alpha * .16);
    fill(ctx, x, y, width * progress, 3, color, alpha * .75);
  }

  function drawPathfinding(args, box, ctx, helpers) {
    const { text, carry, segment, clamp, smooth } = helpers;
    const { amount, time, ink, muted, accent, highlight } = args;
    const model = data.pathfinding, solid = geometry(amount, smooth);
    const phase = cycle(time, 11000), search = clamp(phase / 2800);
    const wave = search * model.maxDistance;
    const route = clamp((phase - 3100) / 1600) * (model.path.length - 1);
    const cell = Math.min((box.w - 24) / model.columns, (box.h - 100) / model.rows);
    const left = (box.w - cell * model.columns) / 2, top = 54;
    const center = id => ({ x: left + (id % model.columns + .5) * cell, y: top + (Math.floor(id / model.columns) + .5) * cell });
    text(ctx, 'pathfinding / breadth-first', 6, 13, accent, amount * .95, 11);
    text(ctx, phase < 3100 ? 'a wave explores every corridor' : 'follow the shortest route', 6, 33, muted, amount * .8, 10);
    fill(ctx, left, top, cell * model.columns, cell * model.rows, muted, solid * .055);

    // Contiguous runs form real corridor walls rather than a grid of glyphs.
    for (let y = 0; y < model.rows; y++) {
      for (let x = 0; x < model.columns;) {
        if (model.grid[y][x] !== '#') { x++; continue; }
        const start = x;
        while (x < model.columns && model.grid[y][x] === '#') x++;
        fill(ctx, left + start * cell, top + y * cell, (x - start) * cell, cell, muted, solid * .34);
      }
    }
    for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.columns; x++) {
      const id = y * model.columns + x, wall = model.grid[y][x] === '#';
      const cx = left + x * cell, cy = top + y * cell;
      if (wall) {
        // Light only exposed faces; neighboring wall tiles remain seamless.
        if (y + 1 < model.rows && model.grid[y + 1][x] !== '#') segment(ctx, cx, cy + cell, cx + cell, cy + cell, ink, solid * .28);
        if (x + 1 < model.columns && model.grid[y][x + 1] !== '#') segment(ctx, cx + cell, cy, cx + cell, cy + cell, ink, solid * .20);
        if ((x + y) % 4 === 0) sourceMark(args, ctx, helpers, '▰', cx + cell * .2, cy + cell * .5, muted);
        continue;
      }
      const distance = model.distances[id], reached = distance >= 0 && distance <= wave;
      const frontier = reached && wave - distance < 1.6 && search < 1;
      if (reached) fill(ctx, cx + .5, cy + .5, cell - 1, cell - 1, frontier ? highlight : accent,
        solid * (frontier ? .58 : .14 + .12 * (1 - distance / model.maxDistance)));
      if (frontier) circle(ctx, cx + cell / 2, cy + cell / 2, Math.max(2, cell * .12), highlight, solid * .95);
    }
    if (route > 0) {
      const full = Math.floor(route), progress = smooth(route - full);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [width, opacity] of [[cell * .48, .13], [Math.max(3, cell * .20), .95]]) {
        ctx.lineWidth = width;
        for (let i = 1; i < model.path.length && i <= full + 1; i++) {
          const a = center(model.path[i - 1]), b = center(model.path[i]), t = i > full ? progress : 1;
          segment(ctx, a.x, a.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, highlight, solid * opacity);
        }
      }
      ctx.lineWidth = 1;
      const a = center(model.path[full]), b = center(model.path[Math.min(full + 1, model.path.length - 1)]);
      const hx = a.x + (b.x - a.x) * progress, hy = a.y + (b.y - a.y) * progress;
      circle(ctx, hx, hy, cell * .27, highlight, solid * .22);
      circle(ctx, hx, hy, Math.max(2.5, cell * .14), ink, solid);
    }
    for (const [id, label] of [[model.start, 'S'], [model.goal, 'G']]) {
      const p = center(id);
      fill(ctx, p.x - cell * .42, p.y - cell * .42, cell * .84, cell * .84, highlight, solid * .17);
      carry(ctx, label, p.x - 3.3, p.y, highlight, amount, 11);
    }
    const visited = model.visitOrder.filter(id => model.distances[id] <= wave).length;
    progressBar(ctx, 6, box.h - 42, box.w - 12, phase < 3100 ? visited / model.visitOrder.length : route / (model.path.length - 1), highlight, muted, solid);
    text(ctx, route >= model.path.length - 1 ? `${model.path.length - 1} steps / shortest path` : `${visited}/${model.visitOrder.length} cells reached`, 6, box.h - 27, highlight, amount * .95, 10);
    text(ctx, 'S → G · walls stop the search wave', 6, box.h - 10, muted, amount * .75, 10);
  }

  function drawQuadtree(args, box, ctx, helpers) {
    const { text, segment, clamp, smooth } = helpers;
    const { amount, time, muted, accent, highlight } = args;
    const model = data.quadtree, phase = cycle(time + 2800, 12500), solid = geometry(amount, smooth);
    const refinement = clamp((phase - 600) / 1400, 0, model.maxDepth);
    const depth = Math.floor(refinement), partial = smooth(refinement - depth);
    const left = 14, top = 54, width = box.w - 28, height = box.h - 105;
    const px = clamp(args.pointerX || 0, -1, 1), py = clamp(args.pointerY || 0, -1, 1);
    const pointed = Math.abs(px) + Math.abs(py) > .035;
    const query = pointed ? { x: .5 + px * .48, y: .5 + py * .48 }
      : { x: .5 + Math.sin(time / 2100) * .39, y: .5 + Math.cos(time / 2700 + .7) * .39 };
    const contains = node => query.x >= node.x && query.x < node.x + node.size && query.y >= node.y && query.y < node.y + node.size;
    let selected = model.root, visibleLeaves = 0;
    const drawNode = node => {
      const x = left + node.x * width, y = top + node.y * height, w = node.size * width, h = node.size * height;
      if (contains(node) && node.depth <= depth) selected = node;
      if (!node.children.length || node.depth >= depth) {
        visibleLeaves++;
        fill(ctx, x + .5, y + .5, w - 1, h - 1, node.depth % 2 ? accent : muted, solid * (.055 + node.depth * .035));
      }
      if (!node.children.length || node.depth > depth) return;
      const reveal = node.depth === depth ? partial : 1;
      if (node.depth === depth) node.children.forEach((child, i) => {
        fill(ctx, left + child.x * width + .5, top + child.y * height + .5, child.size * width - 1, child.size * height - 1,
          i % 2 ? accent : highlight, solid * reveal * .07);
      });
      const alpha = solid * reveal * (.55 - node.depth * .10);
      ctx.lineWidth = Math.max(1, 2 - node.depth * .5);
      segment(ctx, x + w / 2, y, x + w / 2, y + h, muted, alpha);
      segment(ctx, x, y + h / 2, x + w, y + h / 2, muted, alpha);
      ctx.lineWidth = 1;
      sourceMark(args, ctx, helpers, '+', x + w / 2 - 3, y + h / 2, muted);
      if (node.depth < depth) node.children.forEach(drawNode);
    };
    text(ctx, 'quadtree / adaptive partitions', 6, 13, accent, amount * .95, 11);
    text(ctx, '32 points · split buckets above 3', 6, 33, muted, amount * .8, 10);
    fill(ctx, left, top, width, height, muted, solid * .04);
    drawNode(model.root);
    const selectionX = left + selected.x * width, selectionY = top + selected.y * height;
    fill(ctx, selectionX + 1, selectionY + 1, selected.size * width - 2, selected.size * height - 2, highlight, solid * .16);
    outline(ctx, left, top, width, height, muted, solid * .45, segment);
    outline(ctx, selectionX + 1, selectionY + 1, selected.size * width - 2, selected.size * height - 2, highlight, solid * .94, segment, 2);
    const selectedIds = new Set(selected.ids);
    for (const point of model.points) {
      const active = selectedIds.has(point.id), x = left + point.x * width, y = top + point.y * height;
      if (active) circle(ctx, x, y, 6, highlight, solid * .15);
      circle(ctx, x, y, active ? 3.5 : 2.7, active ? highlight : accent, solid * (active ? 1 : .72));
      sourceMark(args, ctx, helpers, active ? '+' : '·', x - 3, y, active ? highlight : accent);
    }
    const qx = left + query.x * width, qy = top + query.y * height;
    // Crosshair distinguishes the query from the stored point samples.
    segment(ctx, Math.max(left, qx - 7), qy, Math.min(left + width, qx + 7), qy, highlight, solid);
    segment(ctx, qx, Math.max(top, qy - 7), qx, Math.min(top + height, qy + 7), highlight, solid);
    text(ctx, `depth ${depth} · ${visibleLeaves} leaves · ${selected.ids.length} found`, 6, box.h - 27, highlight, amount * .95, 10);
    text(ctx, 'move to query · bright points match', 6, box.h - 10, muted, amount * .75, 10);
    for (let i = 0; i <= model.maxDepth; i++) fill(ctx, 6 + i * (box.w - 12) / 4, box.h - 42,
      (box.w - 12) / 4 - 3, 3, i <= depth ? highlight : muted, solid * (i <= depth ? .75 : .15));
  }

  function drawConvolution(args, box, ctx, helpers) {
    const { text, segment, clamp, smooth } = helpers;
    const { amount, time, muted, accent, highlight } = args;
    const model = data.convolution, solid = geometry(amount, smooth);
    const phase = cycle(time, 10300), clock = Math.max(0, (phase - 600) / 160);
    const index = Math.min(24, Math.floor(clock)), finished = clock >= 25;
    const sx = index % 5, sy = Math.floor(index / 5);
    const areaWidth = Math.min(box.w - 12, 474), left = (box.w - areaWidth) / 2;
    const kernelCell = box.w < 300 ? 14 : 17, gap = 9;
    const cell = Math.min(26, (areaWidth - kernelCell * 3 - gap * 2) / 12, (box.h - 116) / 7);
    const usedWidth = cell * 12 + kernelCell * 3 + gap * 2;
    const inputX = left + (areaWidth - usedWidth) / 2;
    const kernelX = inputX + cell * 7 + gap, outputX = kernelX + kernelCell * 3 + gap;
    const top = 66, middleY = top + cell * 3.5, outputY = middleY - cell * 2.5, kernelY = middleY - kernelCell * 1.5;
    text(ctx, 'convolution / pixels → edges', 6, 13, accent, amount * .95, 11);
    text(ctx, 'a 3×3 window becomes one output', 6, 33, muted, amount * .8, 10);
    text(ctx, 'input', inputX, 51, muted, amount * .85, 10);
    text(ctx, 'kernel', kernelX, 51, muted, amount * .85, 10);
    text(ctx, 'output', outputX, 51, accent, amount * .9, 10);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const value = model.input[y][x], active = !finished && x >= sx && x < sx + 3 && y >= sy && y < sy + 3;
      fill(ctx, inputX + x * cell + .65, top + y * cell + .65, cell - 1.3, cell - 1.3, value ? accent : muted, solid * (value ? .82 : .10));
      if (active) fill(ctx, inputX + x * cell + .65, top + y * cell + .65, cell - 1.3, cell - 1.3, highlight, solid * (value ? .30 : .13));
      if (value) sourceMark(args, ctx, helpers, '▪', inputX + (x + .3) * cell, top + (y + .5) * cell, accent);
    }
    const progress = clamp(clock - Math.floor(clock));
    if (!finished) {
      // Each row glides between exact sampled windows; row changes return to x=0.
      const previousX = sx ? sx - 1 : sx;
      const windowX = previousX + (sx - previousX) * smooth(clamp(progress / .45));
      outline(ctx, inputX + windowX * cell, top + sy * cell, cell * 3, cell * 3, highlight, solid, segment, 2);
    }
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const value = model.output[y][x], done = y * 5 + x < index || finished, active = y * 5 + x === index && !finished;
      fill(ctx, outputX + x * cell + .65, outputY + y * cell + .65, cell - 1.3, cell - 1.3,
        value < 0 ? highlight : accent, solid * (done || active ? .09 + Math.abs(value) / 4 * .80 : .045));
      if (active) outline(ctx, outputX + x * cell, outputY + y * cell, cell, cell, highlight, solid, segment, 2);
    }
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const value = model.kernel[y][x];
      fill(ctx, kernelX + x * kernelCell + .5, kernelY + y * kernelCell + .5, kernelCell - 1, kernelCell - 1,
        value === 4 ? highlight : muted, solid * (value === 4 ? .20 : .10));
      text(ctx, String(value), kernelX + (x + .5) * kernelCell - (value < 0 ? 6 : 3), kernelY + (y + .5) * kernelCell,
        value ? highlight : muted, amount * (value ? .95 : .62), 10);
    }
    outline(ctx, kernelX, kernelY, kernelCell * 3, kernelCell * 3, muted, solid * .25, segment);
    // Two short arrows and a travelling sample tie the three matrices together.
    for (const [from, to] of [[inputX + cell * 7 + 1, kernelX - 1], [kernelX + kernelCell * 3 + 1, outputX - 1]]) {
      segment(ctx, from, middleY, to, middleY, accent, solid * .65);
      segment(ctx, to - 3, middleY - 3, to, middleY, accent, solid * .65);
      segment(ctx, to - 3, middleY + 3, to, middleY, accent, solid * .65);
      if (!finished) circle(ctx, from + (to - from) * progress, middleY, 1.7, highlight, solid);
    }
    progressBar(ctx, 6, box.h - 42, box.w - 12, finished ? 1 : (index + progress) / 25, highlight, muted, solid);
    text(ctx, finished ? '25/25 outputs · edge map complete' : `scan ${String(index + 1).padStart(2, '0')}/25 · weighted sum = ${model.output[sy][sx]}`,
      6, box.h - 27, highlight, amount * .95, 10);
    text(ctx, 'Laplacian · brightness = |response|', 6, box.h - 10, muted, amount * .75, 10);
  }

  window.PortfolioStructureEffects = Object.freeze({
    kinds,
    data,
    draw(kind, args, helpers) {
      if (!kinds.includes(kind) || !args?.context || !(args.width > 0) || !(args.height > 0) || !helpers?.layout) return null;
      const ink = args.ink || '#cbcbb6', accent = args.accent || ink;
      const values = { ...args, time: Number.isFinite(args.time) ? args.time : 0, amount: helpers.clamp(args.amount ?? 1),
        ink, accent, muted: args.muted || ink, highlight: args.highlight || accent };
      const box = helpers.layout(values, 320), ctx = helpers.begin(values, box);
      try {
        if (kind === 'pathfinding') drawPathfinding(values, box, ctx, helpers);
        if (kind === 'quadtree') drawQuadtree(values, box, ctx, helpers);
        if (kind === 'convolution') drawConvolution(values, box, ctx, helpers);
      } finally { ctx.restore(); }
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    },
  });
})();
