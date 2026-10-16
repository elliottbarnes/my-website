// Display-only views of repository history and source text. No code is executed.
(() => {
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const outputs = { glassbox: "wasm", "pixel-language": "glsl", "architecture-lab": "pixels", "automata-lab": "dfa" };
  const tokenPattern = /\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|===|!==|=>|==|!=|<=|>=|&&|\|\||\?\.|[^\s]/g;
  const tokensFor = text => (text.match(tokenPattern) || []).filter(token => !token.startsWith("//"));
  const shorten = (text, count) => text.length > count ? `${text.slice(0, Math.max(1, count - 1))}…` : text;

  let flow = null;

  function layout(args, desiredHeight) {
    const { width, height, amount, anchor } = args;
    const w = Math.max(1, Math.min(width - 24, 540));
    const h = Math.max(1, Math.min(height - 30, desiredHeight));
    const reveal = smooth(amount);
    const morphing = Boolean(args.glyphs?.length);
    const scale = morphing ? 1 : .06 + .94 * reveal;
    const originX = clamp((anchor?.sourceX ?? .5) * width, 12, width - 12);
    const originY = clamp((anchor?.sourceY ?? .4) * height, 12, height - 12);
    const destinationX = clamp((anchor?.x ?? .5) * width + (args.pull?.x || 0), w / 2 + 12, width - w / 2 - 12);
    const destinationY = clamp((anchor?.y ?? .5) * height + (args.pull?.y || 0), h / 2 + 14, height - h / 2 - 16);
    const cx = morphing ? destinationX : originX + (destinationX - originX) * reveal;
    const cy = morphing ? destinationY : originY + (destinationY - originY) * reveal;
    const left = cx - w * scale / 2, top = cy - h * scale / 2;
    return { w, h, reveal, scale, left, top, right: left + w * scale, bottom: top + h * scale };
  }

  function begin(args, box) {
    const ctx = args.context;
    if (args.glyphs?.length) flow = { points: args.glyphs, index: 0, amount: args.amount, box };
    ctx.save();
    ctx.translate(box.left, box.top);
    ctx.scale(box.scale, box.scale);
    ctx.globalAlpha = clamp(args.amount);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = '9px "Plex Mono", monospace';
    ctx.lineWidth = 1;
    return ctx;
  }

  function carry(ctx, character, x, y, color, alpha, size = 9) {
    if (!flow) {
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.font = `${size}px "Plex Mono", monospace`; ctx.fillText(character, x, y); return;
    }
    const index = flow.index++;
    const point = flow.points[index % flow.points.length];
    const lag = (index % 9) * .018;
    const progress = smooth((flow.amount - lag) / (1 - lag));
    const fromX = point.x - flow.box.left, fromY = point.y - flow.box.top;
    const arc = Math.sin(progress * Math.PI) * (8 + index % 5 * 3);
    const px = fromX + (x - fromX) * progress;
    const py = fromY + (y - fromY) * progress - arc;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.font = `${(point.size || 12) + (size - (point.size || 12)) * progress}px "Plex Mono", monospace`;
    const blend = smooth((progress - .30) / .40);
    if (blend < .995) {
      ctx.globalAlpha = alpha * (1 - blend);
      ctx.fillText(point.glyph, px, py);
    }
    if (blend > .005) {
      ctx.globalAlpha = alpha * blend;
      ctx.fillText(character, px, py);
    }
  }

  function text(ctx, value, x, y, color, alpha, size = 9) {
    if (!flow) {
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.font = `${size}px "Plex Mono", monospace`; ctx.fillText(value, x, y); return;
    }
    for (let index = 0; index < value.length; index++) {
      if (value[index] !== " ") carry(ctx, value[index], x + index * size * .6, y, color, alpha, size);
    }
  }

  function trace(ctx, x1, y1, x2, y2, color, alpha) {
    if (!flow) return;
    const count = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 9));
    for (let i = 0; i <= count; i++) carry(ctx, "·", x1 + (x2 - x1) * i / count, y1 + (y2 - y1) * i / count, color, alpha, 8);
  }

  function segment(ctx, x1, y1, x2, y2, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    trace(ctx, x1, y1, x2, y2, color, alpha);
  }

  function dot(ctx, x, y, color, alpha, radius = 2) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function historyLayout(args, box) {
    const records = (Array.isArray(args.history) ? args.history : [])
      .filter(record => /^[0-9a-f]{7,40}$/i.test(record?.sha || "")).slice(0, 4).reverse();
    const hashWidth = box.w < 390 ? 60 : 68;
    const step = records.length > 1 ? (box.w - hashWidth - 16) / (records.length - 1) : 0;
    const short = box.h < 176;
    const rowY = box.h < 120 ? 32 : 42;
    const nodes = records.map((record, index) => {
      const flex = Math.sin((index + 1) / (records.length + 1) * Math.PI);
      const baseX = records.length === 1 ? (box.w - hashWidth) / 2 : 8 + index * step;
      return { record, x: clamp(baseX + (args.pull?.x || 0) * .20 * flex, 8, box.w - hashWidth - 8),
        y: short ? rowY : 50 + (index % 2) * 21 + (args.pull?.y || 0) * .12 * flex };
    });
    return { records, hashWidth, nodes };
  }

  function subjectLines(value, columns, limit = 2) {
    const words = String(value).toLowerCase().split(/\s+/);
    const lines = [""];
    for (const word of words) {
      let line = lines[lines.length - 1];
      if (line && line.length + word.length + 1 > columns) {
        if (lines.length === limit) { lines[lines.length - 1] = shorten(`${line} ${word} …`, columns); break; }
        lines.push(""); line = "";
      }
      lines[lines.length - 1] = shorten(line ? `${line} ${word}` : word, columns);
    }
    return lines;
  }

  function history(args) {
    const { context, amount, time, snippet, ink = "#cbcbb6", muted = ink, accent = ink, highlight = accent } = args;
    const box = layout(args, 206);
    const ctx = begin(args, box);
    const { records, hashWidth, nodes } = historyLayout(args, box);
    const count = records.length;
    const compact = box.w < 390;
    const short = box.h < 176;
    const selected = records.find(record => record.sha === args.selectedCommit) || records[count - 1];
    const bySha = new Map(nodes.map(node => [node.record.sha, node]));
    text(ctx, "git log --oneline", 8, 15, muted, amount * .8);
    text(ctx, "head", box.w - 32, 15, accent, amount * .8, short ? 9 : 8);

    for (const [index, node] of nodes.entries()) {
      const reveal = smooth(amount * 1.6 - index * .12);
      const parents = Array.isArray(node.record.parents) ? node.record.parents : [];
      for (const parent of parents) {
        const sha = typeof parent === "string" ? parent : parent?.sha;
        const previous = bySha.get(sha);
        const x1 = previous ? previous.x + hashWidth : node.x - 8;
        const y1 = previous ? previous.y : node.y;
        const x2 = node.x, y2 = node.y;
        const progress = ((time / 1700 + index * .23) % 1 + 1) % 1;
        ctx.globalAlpha = amount * reveal * .35;
        ctx.strokeStyle = muted;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const bend = (x1 + x2) / 2;
        ctx.bezierCurveTo(bend, y1, bend, y2, x2, y2);
        ctx.stroke();
        trace(ctx, x1, y1, x2, y2, muted, amount * reveal * .7);
        if (previous) {
          const inv = 1 - progress;
          const x = inv * inv * inv * x1 + 3 * inv * inv * progress * bend + 3 * inv * progress * progress * bend + progress * progress * progress * x2;
          const y = inv * inv * inv * y1 + 3 * inv * inv * progress * y1 + 3 * inv * progress * progress * y2 + progress * progress * progress * y2;
          dot(ctx, x, y, highlight, amount * reveal * .9, 1.8);
        }
      }
      const active = node.record === selected;
      ctx.globalAlpha = amount * reveal * (active ? .85 : .35);
      ctx.strokeStyle = active ? accent : muted;
      ctx.strokeRect(node.x, node.y - 11, hashWidth, 22);
      trace(ctx, node.x, node.y - 11, node.x + hashWidth, node.y - 11, muted, amount * reveal * .4);
      text(ctx, node.record.sha.slice(0, 7), node.x + 6, node.y, active ? accent : ink, amount * reveal, compact ? 10 : 9);
    }

    const path = String(snippet?.path || "source").split("/");
    const repo = String(snippet?.repo || "repository");
    const columns = Math.max(12, Math.floor((box.w - 20) / 5.4));
    if (short) {
      text(ctx, shorten(`${repo}/${path.join("/")}`, columns), 8, box.h < 120 ? 54 : 72, accent, amount * .9);
    } else {
      const treeY = 111;
      text(ctx, `${repo}/`, 8, treeY, accent, amount * .9);
      if (path.length > 1) {
        text(ctx, `└─ ${shorten(path.slice(0, -1).join("/"), columns - 3)}/`, 8, treeY + 17, muted, amount * .7);
        text(ctx, `   └─ ${shorten(path[path.length - 1], columns - 6)}`, 8, treeY + 34, ink, amount * .85);
      } else text(ctx, `└─ ${shorten(path[0], columns - 3)}`, 8, treeY + 17, ink, amount * .85);
    }
    const subject = selected ? String(selected.message || "").split("\n")[0] : "commit-pinned source";
    const subjectColumns = Math.max(12, Math.floor((box.w - 20) / 5.4));
    const subjectLimit = box.h < 120 || (!short && box.h < 188) ? 1 : 2;
    subjectLines(subject, subjectColumns, subjectLimit).forEach((line, index) => {
      text(ctx, line, 8, box.h - (subjectLimit === 1 ? 12 : 26) + index * 14, muted, amount * .8, 9);
    });
    context.restore();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  function tokens(args) {
    const { context, amount, time, anchor, snippet, ink = "#cbcbb6", muted = ink, accent = ink, highlight = accent } = args;
    const box = layout(args, 220);
    const ctx = begin(args, box);
    const all = tokensFor(String(snippet?.code || ""));
    const local = tokensFor(String(anchor?.text || ""));
    const sample = [...local, ...all].filter((token, index, values) => values.indexOf(token) === index).slice(0, 7);
    const cellWidth = Math.min(100, (box.w - 30) / 3);
    const centers = [cellWidth / 2 + 6, box.w / 2, box.w - cellWidth / 2 - 6];
    const labels = ["source", "tokens", outputs[snippet?.repo] || "output"];
    const top = 55, spacing = 20;
    const short = box.h < 176;
    const textSize = short ? 9 : 8;
    const rows = Math.min(sample.length, Math.max(1, Math.floor((box.h - 80) / spacing)));
    text(ctx, "compile sketch", 6, 13, muted, amount * .8);
    text(ctx, shorten(String(snippet?.path || "source"), Math.floor((box.w - 12) / 5.4)), 6, box.h - 10, muted, amount * .65, textSize);
    for (let column = 0; column < 3; column++) {
      text(ctx, labels[column], centers[column] - cellWidth / 2, 34, column === 1 ? accent : muted, amount * .9, textSize);
    }

    for (let row = 0; row < rows; row++) {
      const token = sample[row];
      const y = top + row * spacing;
      const reveal = smooth(amount * 1.8 - row * .10);
      const category = /^[A-Za-z_$]/.test(token) ? "identifier" : /^\d/.test(token) ? "number" : /^["'`]/.test(token) ? "literal" : "operator";
      const pieces = [token, category, labels[2] === "wasm" ? (category === "number" ? "const" : category === "operator" ? "op" : "local")
        : labels[2] === "glsl" ? (category === "number" ? "float" : category === "operator" ? "expr" : "varying")
          : labels[2] === "pixels" ? (category === "number" ? "bit" : category === "operator" ? "mask" : "address")
            : labels[2] === "dfa" ? (category === "operator" ? "edge" : "state") : "value"];
      for (let column = 0; column < 3; column++) {
        const x = centers[column] - cellWidth / 2;
        ctx.globalAlpha = amount * reveal * (column === 1 ? .50 : .25);
        ctx.strokeStyle = column === 1 ? accent : muted;
        ctx.strokeRect(x, y - 8, cellWidth, 16);
        const maxCharacters = Math.max(3, Math.floor((cellWidth - 8) / (textSize * .6)));
        text(ctx, shorten(pieces[column], maxCharacters), x + 4, y, column === 1 ? accent : ink, amount * reveal * .88, textSize);
        if (column < 2) segment(ctx, x + cellWidth, y, centers[column + 1] - cellWidth / 2, y, muted, amount * reveal * .25);
      }
      const flow = ((time / 2400 + row * .14) % 1 + 1) % 1;
      const x = centers[0] + (centers[2] - centers[0]) * flow;
      dot(ctx, x, y, highlight, amount * reveal * .9, 1.6);
    }
    context.restore();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  // Two coherent radial sources. A tilted sampled surface makes phase and
  // cancellation legible without post-processing, textures, or extra canvases.
  function interference(args) {
    const { amount, time = 0, accent, ink, muted, highlight } = args;
    const box = layout(args, 260), ctx = begin(args, box);
    const t = time / 1000, px = clamp(args.pointerX || 0, -1, 1), py = clamp(args.pointerY || 0, -1, 1);
    const columns = box.w < 340 ? 35 : 53, rows = 27;
    const sources = [[-.23 + px * .09, -.08 + Math.sin(t * .24) * .08], [.23 + px * .04, .08 + Math.cos(t * .21) * .08]];
    const frequency = 24 + py * 5, phase = t * 2.6;
    const amplitude = (u, v) => sources.reduce((sum, [x, y]) => sum + Math.sin(Math.hypot(u - x, v - y) * frequency - phase), 0) / 2;
    const project = (u, v, wave) => ({ x: box.w * (.5 + u * .80 + v * .12), y: box.h * (.49 + v * .48 - wave * .105) });
    const points = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < columns; x++) {
        const u = x / (columns - 1) - .5, v = y / (rows - 1) - .5;
        const wave = amplitude(u, v), edge = clamp(Math.min(.5 - Math.abs(u), .5 - Math.abs(v)) * 12);
        row.push({ ...project(u, v, wave), wave, edge });
      }
      points.push(row);
    }
    // The mesh appears late in the morph so source letters remain the transition.
    const meshAlpha = smooth((amount - .55) / .45);
    ctx.strokeStyle = accent; ctx.lineWidth = .65;
    for (let y = 1; y < rows - 1; y += 2) {
      ctx.globalAlpha = meshAlpha * (.16 + y / rows * .20); ctx.beginPath();
      points[y].forEach((p, x) => x ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    for (let x = 2; x < columns - 2; x += 4) {
      ctx.globalAlpha = meshAlpha * .14; ctx.beginPath();
      points.forEach((row, y) => y ? ctx.lineTo(row[x].x, row[x].y) : ctx.moveTo(row[x].x, row[x].y)); ctx.stroke();
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const p = points[y][x], crest = Math.max(0, p.wave), trough = Math.max(0, -p.wave);
      const glyph = crest > .7 ? '+' : trough > .65 ? '−' : Math.abs(p.wave) < .12 ? '·' : ':';
      carry(ctx, glyph, p.x, p.y, crest > .65 ? highlight : trough > .45 ? muted : accent,
        amount * p.edge * (.30 + Math.abs(p.wave) * .70), box.w < 340 ? 6 : 7);
    }
    sources.forEach(([u,v], i) => {
      const p = project(u,v,amplitude(u,v));
      for (let ring = 0; ring < 3; ring++) {
        const travel = ((t * .55 + ring / 3) % 1 + 1) % 1;
        ctx.globalAlpha = meshAlpha * (1 - travel) * .45; ctx.strokeStyle = i ? highlight : accent;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + travel * 17, 0, Math.PI * 2); ctx.stroke();
      }
      carry(ctx, '✦', p.x - 4, p.y, ink, amount, 12);
      text(ctx, i ? 'B' : 'A', p.x + 9, p.y - 10, i ? highlight : accent, amount * .85, 8);
    });
    text(ctx, 'two sources / one interference field', 6, 13, accent, amount * .85, box.w < 340 ? 8 : 9);
    text(ctx, 'move → phase + spacing · drag → pull', 6, box.h - 9, muted, amount * .8, box.w < 340 ? 7 : 8);
    ctx.restore();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  // Algorithm sketches, deliberately separate from the pinned repository code.
  // Each frame is derived from a bounded deterministic trace (no background timers).
  const sortFrames = (() => {
    const values = [7, 2, 10, 4, 1, 8, 3, 9, 5, 6], frames = [];
    for (let end = values.length - 1; end > 0; end--) for (let i = 0; i < end; i++) {
      frames.push({ values: [...values], pair: i, end });
      if (values[i] > values[i + 1]) [values[i], values[i + 1]] = [values[i + 1], values[i]];
    }
    frames.push({ values: [...values], pair: -1, end: 0 });
    return frames;
  })();
  const generations = (() => {
    const rows = [Array.from({ length: 49 }, (_, i) => i === 35 ? 1 : 0)];
    for (let y = 1; y < 48; y++) rows.push(rows[y - 1].map((_, x, row) => {
      const pattern = (row[(x + 48) % 49] << 2) | (row[x] << 1) | row[(x + 1) % 49];
      return (110 >> pattern) & 1;
    }));
    return rows;
  })();
  function algorithm(kind, args) {
    const { amount, time = 0, ink, accent, muted, highlight } = args;
    const box = layout(args, 224), ctx = begin(args, box);
    const title = { sort: 'bubble sort / compare → swap', automaton: 'rule 110 / local rules → complexity', graph: 'breadth-first search / frontier → visited' }[kind];
    text(ctx, title, 6, 13, accent, amount * .95, box.w < 330 ? 8 : 9);
    const bottom = box.h - 25, top = 40, usable = Math.max(20, bottom - top);
    if (kind === 'sort') {
      const clock = time / 460, step = Math.floor(clock) % (sortFrames.length + 6);
      const current = sortFrames[Math.min(step, sortFrames.length - 1)];
      const swap = current.pair >= 0 && current.values[current.pair] > current.values[current.pair + 1];
      const travel = smooth(((clock % 1) - .24) / .62);
      const gap = (box.w - 24) / 10;
      current.values.forEach((value, i) => {
        const active = current.pair >= 0 && (i === current.pair || i === current.pair + 1);
        const shift = swap && active ? (i === current.pair ? travel : -travel) : 0;
        const x = 12 + (i + shift) * gap, h = usable * value / 10;
        for (let y = bottom; y > bottom - h; y -= 8) text(ctx, active ? '▰' : '▪', x, y, active ? highlight : i > current.end ? accent : ink, amount * .85, 10);
        text(ctx, String(value), x, bottom + 12, muted, amount * .9, 8);
      });
    } else if (kind === 'automaton') {
      const cols = box.w < 330 ? 35 : 49, cell = Math.min((box.w - 16) / cols, usable / 22), left = (box.w - cols * cell) / 2;
      const clock = time / 260, generation = Math.floor(clock) % 27, drift = smooth(clock % 1);
      for (let y = 0; y < 22; y++) for (let x = 0; x < cols; x++) {
        const alive = generations[y + generation][x + 49 - cols];
        const reveal = y === 21 ? smooth((clock % 1) * 1.6 - x / cols * .6) : y === 0 ? 1 - drift : 1;
        if (alive) carry(ctx, y === 21 ? '▰' : '▪', left + x * cell, top + (y + 1 - drift) * cell, y === 21 ? highlight : accent, amount * (.25 + y / 30) * reveal, cell);
      }
    } else {
      const nodes = [[.1,.5],[.32,.17],[.32,.8],[.55,.12],[.55,.5],[.55,.88],[.83,.3],[.83,.72]];
      const edges = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[4,7],[5,7]], order = [0,1,2,3,4,5,6,7];
      const clock = time / 650, visited = Math.floor(clock) % 11, travel = smooth(clock % 1);
      for (const [a,b] of edges) {
        const active = order.indexOf(a) < visited && order.indexOf(b) <= visited;
        segment(ctx, nodes[a][0] * box.w, top + nodes[a][1] * usable, nodes[b][0] * box.w, top + nodes[b][1] * usable, active ? accent : muted, amount * (active ? .7 : .22));
      }
      if (visited > 0 && visited < nodes.length) {
        const parents = [0, 0, 0, 1, 1, 2, 3, 4], from = nodes[parents[visited]], to = nodes[visited];
        for (let tail = 2; tail >= 0; tail--) {
          const f = clamp(travel - tail * .12);
          carry(ctx, tail ? '·' : '◆', (from[0] + (to[0] - from[0]) * f) * box.w,
            top + (from[1] + (to[1] - from[1]) * f) * usable, highlight, amount * (1 - tail * .25), tail ? 7 : 10);
        }
      }
      nodes.forEach(([x,y], i) => {
        const current = i === visited, done = i < visited;
        dot(ctx, x * box.w, top + y * usable, current ? highlight : done ? accent : muted, amount * .6, current ? 6 + 3 * Math.sin(travel * Math.PI) : 4);
        text(ctx, String.fromCharCode(65 + i), x * box.w - 3, top + y * usable - 14, current ? highlight : ink, amount, 9);
      });
    }
    text(ctx, 'algorithm sketch · escape returns to source', 6, box.h - 4, muted, amount * .7, box.w < 330 ? 7 : 8);
    ctx.restore();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }

  window.PortfolioEntranceEffects = Object.freeze({
    bounds(kind, args) {
      if (!["history", "tokens", "sort", "automaton", "graph", "interference"].includes(kind) || !(args?.width > 0) || !(args.height > 0)) return null;
      return layout(args, kind === "history" ? 206 : kind === "tokens" ? 220 : kind === "interference" ? 260 : 224);
    },
    pick(kind, args, x, y) {
      if (kind !== "history" || !(args?.width > 0) || !(args.height > 0) || args.amount < .65) return null;
      const box = layout(args, 206);
      const { nodes, hashWidth } = historyLayout(args, box);
      const node = nodes.find(node => x >= box.left + node.x * box.scale
        && x <= box.left + (node.x + hashWidth) * box.scale
        && Math.abs(y - (box.top + node.y * box.scale)) <= 22);
      return node ? { sha: node.record.sha, message: String(node.record.message || "").split("\n")[0] } : null;
    },
    draw(kind, args) {
      if (!args?.context || !(args.width > 0) || !(args.height > 0)) return null;
      flow = null;
      try {
        if (kind === "interference") return interference(args);
        if (kind === "history") return history(args);
        if (kind === "tokens") return tokens(args);
        if (["sort", "automaton", "graph"].includes(kind)) return algorithm(kind, args);
        return null;
      } finally { flow = null; }
    },
  });
})();
