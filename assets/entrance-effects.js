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
    ctx.font = '10px "Plex Mono", monospace';
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
    if (!flow || flow.amount >= .995) return;
    alpha *= 1 - smooth((flow.amount - .70) / .29);
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

  // Solid geometry emerges after the travelling source characters have begun
  // to arrive; the same envelope dissolves it before the characters return.
  const geometry = amount => smooth((amount - .38) / .62);
  function fillBox(ctx, x, y, w, h, color, alpha) {
    if (w <= 0 || h <= 0 || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  }
  function polygon(ctx, points, color, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill();
  }
  function tokens(args) {
    const { context, amount, time = 0, anchor, snippet, ink = "#cbcbb6", muted = ink, accent = ink, highlight = accent } = args;
    const box = layout(args, 320), ctx = begin(args, box), solid = geometry(amount);
    const all = tokensFor(String(snippet?.code || "")), local = tokensFor(String(anchor?.text || ""));
    const sample = [...local, ...all].filter((token, index, values) => values.indexOf(token) === index).slice(0, 7);
    const compact = box.h < 180, textSize = compact ? 9 : 11;
    const spacing = compact ? 22 : 30, top = compact ? 55 : 76, cellHeight = compact ? 16 : 24;
    const rows = Math.min(sample.length, Math.max(0, Math.floor((box.h - (compact ? 80 : 100)) / spacing) + 1));
    const gap = compact ? 12 : 16, cellWidth = (box.w - 12 - 2 * gap) / 3;
    const centers = [6 + cellWidth / 2, box.w / 2, box.w - 6 - cellWidth / 2];
    const labels = ['source', 'tokens', outputs[snippet?.repo] || 'output'];
    const scan = ((time / 780) % Math.max(1, rows) + Math.max(1, rows)) % Math.max(1, rows);
    const keywords = new Set(['const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'function', 'class', 'import', 'export', 'new']);
    text(ctx, compact ? 'source lowering / illustrative' : 'source → tokens → target', 6, 13, accent, amount, compact ? 10 : 12);
    if (!compact) text(ctx, 'lex / classify / illustrative lowering', 6, 33, muted, amount * .8, 10);
    text(ctx, shorten(String(snippet?.path || 'source'), Math.floor((box.w - 12) / (compact ? 5.4 : 6))), 6, box.h - 10, muted, amount * .7, compact ? 9 : 10);
    for (let col = 0; col < 3; col++) {
      text(ctx, labels[col], centers[col] - cellWidth / 2, compact ? 34 : 54, col === 1 ? accent : muted, amount * .95, compact ? 9 : 10);
    }
    for (let row = 0; row < rows; row++) {
      const token = sample[row], y = top + row * spacing, active = row === Math.floor(scan);
      const reveal = smooth(amount * 1.8 - row * .08);
      const category = keywords.has(token) ? 'keyword' : /^[A-Za-z_$]/.test(token) ? 'identifier' : /^\d/.test(token) ? 'number' : /^["'`]/.test(token) ? 'literal' : 'operator';
      const pieces = [token, category, labels[2] === 'wasm' ? (category === 'number' ? 'const' : category === 'operator' ? 'op' : 'local')
        : labels[2] === 'glsl' ? (category === 'number' ? 'float' : category === 'operator' ? 'expr' : 'varying')
          : labels[2] === 'pixels' ? (category === 'number' ? 'bit' : category === 'operator' ? 'mask' : 'address')
            : labels[2] === 'dfa' ? (category === 'operator' ? 'edge' : 'state') : 'value'];
      if (token === 'return' && ['wasm', 'glsl'].includes(labels[2])) pieces[2] = 'return';
      for (let col = 0; col < 3; col++) {
        const x = centers[col] - cellWidth / 2;
        fillBox(ctx, x + 2, y - cellHeight / 2 + 3, cellWidth, cellHeight, muted, solid * reveal * .055);
        fillBox(ctx, x, y - cellHeight / 2, cellWidth, cellHeight, active ? accent : muted, solid * reveal * (active ? .20 : .06));
        ctx.globalAlpha = solid * reveal * (active ? .9 : .32); ctx.strokeStyle = active ? highlight : muted; ctx.lineWidth = active ? 1.5 : 1;
        ctx.strokeRect(x, y - cellHeight / 2, cellWidth, cellHeight);
        text(ctx, shorten(pieces[col], Math.max(3, Math.floor((cellWidth - 10) / (textSize * .6)))), x + 5, y,
          active ? highlight : col === 1 ? accent : ink, amount * reveal * (active ? 1 : .85), textSize);
        if (col < 2) segment(ctx, x + cellWidth, y, centers[col + 1] - cellWidth / 2, y, active ? accent : muted, solid * reveal * (active ? .65 : .22));
      }
      if (active) {
        const travel = scan % 1, edge = travel < .5 ? 0 : 1, progress = smooth(travel * 2 % 1);
        const start = centers[edge] + cellWidth / 2, end = centers[edge + 1] - cellWidth / 2;
        dot(ctx, start + (end - start) * progress, y, highlight, solid * reveal, compact ? 2 : 3);
      }
    }
    if (!rows) text(ctx, 'select a source token', 6, Math.min(top, box.h - 28), muted, amount * .8, 10);
    context.restore(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  // Coherent radial waves: the filled facets encode their actual summed
  // amplitude, while contour crossings mark cancellation rather than ornament.
  function interference(args) {
    const { amount, time = 0, accent = '#b6d1c8', ink = accent, muted = ink, highlight = accent } = args;
    const box = layout(args, 320), ctx = begin(args, box), solid = geometry(amount);
    const t = time / 1000, px = clamp(args.pointerX || 0, -1, 1), py = clamp(args.pointerY || 0, -1, 1);
    const columns = box.w < 340 ? 35 : 49, rows = 21, short = box.h < 200;
    const sources = [[-.23 + px * .09, -.08 + Math.sin(t * .24) * .08], [.23 + px * .04, .08 + Math.cos(t * .21) * .08]];
    const frequency = 24 + py * 5, phase = t * 2.6;
    const amplitude = (u, v) => sources.reduce((sum, [x, y]) => sum + Math.sin(Math.hypot(u - x, v - y) * frequency - phase), 0) / 2;
    const plotTop = short ? 36 : 48, plotHeight = Math.max(18, box.h - (short ? 72 : 108));
    const project = (u, v, wave) => ({ x: box.w * (.5 + u * .82 + v * .10), y: plotTop + plotHeight * (.48 + v * .61 - wave * .14) });
    const points = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => {
      const u = x / (columns - 1) - .5, v = y / (rows - 1) - .5, wave = amplitude(u, v);
      return { ...project(u, v, wave), wave };
    }));
    // A quiet lower plane and front wall establish the surface's depth.
    const baseY = plotTop + plotHeight * .94;
    polygon(ctx, [project(-.5,-.5,0), project(.5,-.5,0), {x:box.w*.96,y:baseY}, {x:box.w*.14,y:baseY}], muted, solid * .035);
    const front = points[rows - 1];
    for (let x = 0; x < columns - 1; x++) polygon(ctx, [front[x], front[x + 1], {x:front[x + 1].x,y:baseY}, {x:front[x].x,y:baseY}], accent, solid * .055);
    for (let y = 0; y < rows - 1; y++) for (let x = 0; x < columns - 1; x++) {
      const corners = [points[y][x], points[y][x + 1], points[y + 1][x + 1], points[y + 1][x]];
      const wave = corners.reduce((sum,p) => sum + p.wave, 0) / 4;
      polygon(ctx, corners, wave > .55 ? highlight : wave > 0 ? accent : muted, solid * (.045 + Math.abs(wave) * .29));
    }
    // Thin scan lines preserve the shape, without a screen full of punctuation.
    ctx.lineWidth = .7;
    for (let y = 0; y < rows; y += 2) {
      ctx.globalAlpha = solid * .30; ctx.strokeStyle = accent; ctx.beginPath();
      points[y].forEach((p,x) => x ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke();
    }
    for (let x = 1; x < columns; x += 5) {
      ctx.globalAlpha = solid * .16; ctx.strokeStyle = muted; ctx.beginPath();
      points.forEach((row,y) => y ? ctx.lineTo(row[x].x,row[x].y) : ctx.moveTo(row[x].x,row[x].y)); ctx.stroke();
    }
    // Each sign-changing row edge crosses a true zero of the sampled field.
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns - 1; x++) {
      const a = points[y][x], b = points[y][x + 1];
      if (a.wave * b.wave >= 0) continue;
      const f = Math.abs(a.wave) / (Math.abs(a.wave) + Math.abs(b.wave));
      dot(ctx, a.x + (b.x-a.x)*f, a.y+(b.y-a.y)*f, ink, solid * .42, .8);
    }
    if (flow && amount < .995) for (let y = 0; y < rows; y += 2) for (let x = 0; x < columns; x += 2) {
      const p = points[y][x]; carry(ctx, p.wave > 0 ? '+' : '−', p.x, p.y, accent, amount * (1 - smooth((amount - .65) / .34)), 8);
    }
    sources.forEach(([u,v], i) => {
      const p = project(u,v,amplitude(u,v));
      for (let ring = 0; ring < 2; ring++) { const travel = ((t*.55+ring/2)%1+1)%1;
        ctx.globalAlpha = solid*(1-travel)*.5; ctx.strokeStyle = i ? highlight : accent; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(p.x,p.y,4+travel*11,0,Math.PI*2); ctx.stroke(); }
      dot(ctx,p.x,p.y,i?highlight:accent,solid,3.2);
      text(ctx,i?'B':'A',p.x+10,p.y-12,i?highlight:accent,amount,10);
    });
    text(ctx,'wave interference',6,13,accent,amount,12);
    if (!short) text(ctx,'two coherent sources / summed amplitude',6,33,muted,amount*.8,10);
    const legendY = box.h - (short ? 29 : 37), itemWidth = (box.w - 20) / 3;
    ['trough','cancellation','crest'].forEach((label,index) => {
      const x = 8 + index*itemWidth; fillBox(ctx,x,legendY-4,8,8,[muted,ink,highlight][index],solid*(index===1?.35:.75));
      text(ctx,label,x+12,legendY,[muted,ink,highlight][index],amount*.9,short || box.w < 300 ? 9 : 10);
    });
    text(ctx,'move → spacing + frequency',6,box.h-11,muted,amount*.8,10);
    ctx.restore(); return {left:box.left,top:box.top,right:box.right,bottom:box.bottom};
  }

  // Algorithm sketches, deliberately separate from the pinned repository code.
  // Each frame is derived from a bounded deterministic trace (no background timers).
  const sortFrames = (() => {
    const values = [7, 2, 8, 4, 1, 6, 3, 5], frames = [];
    let swaps = 0;
    for (let end = values.length - 1; end > 0; end--) for (let i = 0; i < end; i++) {
      frames.push({ values: [...values], pair: i, end, swaps });
      if (values[i] > values[i + 1]) {
        [values[i], values[i + 1]] = [values[i + 1], values[i]];
        swaps++;
      }
    }
    frames.push({ values: [...values], pair: -1, end: -1, swaps });
    return frames;
  })();
  const generations = new Map([35, 49].map(columns => {
    const rows = [Array.from({ length: columns }, (_, i) => i === Math.floor(columns * .72) ? 1 : 0)];
    for (let y = 1; y <= 48; y++) rows.push(rows[y - 1].map((_, x, row) => {
      const pattern = (row[(x + columns - 1) % columns] << 2) | (row[x] << 1) | row[(x + 1) % columns];
      return (110 >> pattern) & 1;
    }));
    return [columns, rows];
  }));
  const graphNodes = [[.08,.5],[.29,.19],[.29,.81],[.52,.1],[.52,.5],[.52,.9],[.85,.29],[.85,.74]];
  const graphEdges = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[4,7],[5,7]];
  const graphFrames = (() => {
    const queue = [0], discovered = new Set(queue), visited = [], parents = new Map(), frames = [];
    while (queue.length) {
      const current = queue.shift(), added = [];
      visited.push(current);
      for (const [a, b] of graphEdges) {
        const neighbor = a === current ? b : b === current ? a : -1;
        if (neighbor < 0 || discovered.has(neighbor)) continue;
        discovered.add(neighbor); queue.push(neighbor); parents.set(neighbor, current); added.push(neighbor);
      }
      frames.push({ current, queue: [...queue], visited: [...visited], parents: new Map(parents), added });
    }
    frames.push({ current: -1, queue: [], visited: [...visited], parents: new Map(parents), added: [] });
    return frames;
  })();
  const cycle = (time, duration) => ((time % duration) + duration) % duration;

  function algorithm(kind, args) {
    const { amount, time = 0, ink = '#cbcbb6', accent = ink, muted = ink, highlight = accent } = args;
    const box = layout(args,320), ctx = begin(args,box), solid = geometry(amount);
    const compact = box.h < 150;
    const title = {sort:'bubble sort / compare → swap',automaton:'rule 110 / cellular evolution',graph:'breadth-first search'}[kind];
    text(ctx,title,6,13,accent,amount,box.w<300?10:12);
    if(kind==='sort') {
      const clock=cycle(time,6200)/165, step=Math.min(Math.floor(clock),sortFrames.length-1), current=sortFrames[step];
      const done=current.pair<0, swap=!done&&current.values[current.pair]>current.values[current.pair+1];
      const travel=smooth(((clock%1)-.16)/.70), gap=(box.w-28)/8, barWidth=Math.max(10,gap*.64);
      const bottom=box.h-(compact?32:57), top=compact?32:61, usable=Math.max(8,bottom-top);
      if(!compact) text(ctx,done?`sorted / ${current.swaps} swaps`:`pass ${8-current.end} / ${swap?'swap':'keep'} ${current.values[current.pair]} : ${current.values[current.pair+1]}`,6,35,done?accent:muted,amount*.9,10);
      // Reference rungs make column height a readable data encoding.
      for(let rung=1;rung<=4;rung++) segment(ctx,10,bottom-usable*rung/4,box.w-8,bottom-usable*rung/4,muted,solid*.10);
      current.values.forEach((value,i)=>{
        const active=!done&&(i===current.pair||i===current.pair+1), settled=i>current.end;
        const shift=swap&&active?(i===current.pair?travel:-travel):0;
        const x=14+(i+shift)*gap, h=usable*value/8, lift=swap&&active?Math.sin(travel*Math.PI)*(i===current.pair?-5:5):0;
        const color=active?highlight:settled?accent:ink;
        fillBox(ctx,x+3,bottom-h+3+lift,barWidth,h,muted,solid*.08);
        fillBox(ctx,x,bottom-h+lift,barWidth,h,color,solid*(active?.43:settled?.33:.18));
        fillBox(ctx,x,bottom-h+lift,barWidth,Math.min(3,h),color,solid*.9);
        ctx.globalAlpha=solid*(active?.95:.55);ctx.strokeStyle=color;ctx.lineWidth=active?1.5:1;ctx.strokeRect(x,bottom-h+lift,barWidth,h);
        text(ctx,String(value),x+barWidth/2-3,bottom+13,color,amount,compact?10:12);
        if(flow&&amount<.995) carry(ctx,'▰',x+barWidth/2-3,bottom-h/2,color,amount*(1-smooth((amount-.70)/.29)),10);
      });
      if(!done&&!compact) {
        const x=14+current.pair*gap+barWidth/2;
        ctx.globalAlpha=solid*.85;ctx.strokeStyle=highlight;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,bottom+23);ctx.bezierCurveTo(x,bottom+35,x+gap,bottom+35,x+gap,bottom+23);ctx.stroke();
      }
      text(ctx,done?'complete / every value in order':`${step+1} / 28 comparisons · ${7-current.end} settled`,6,box.h-10,muted,amount*.85,compact?9:10);
    } else if(kind==='automaton') {
      const cols=box.w<330?35:49, history=generations.get(cols);
      const clock=Math.min(cycle(time,7800)/135,48), generation=Math.floor(clock), drift=smooth(clock%1);
      const top=compact?33:87, bottom=box.h-(compact?24:38), usable=Math.max(8,bottom-top);
      const visible=Math.min(26,Math.max(3,Math.floor(usable/6))), cell=Math.min((box.w-22)/cols,usable/visible), left=(box.w-cols*cell)/2;
      const first=Math.max(0,generation-visible+1), offset=generation>=visible-1&&generation<48?drift:0;
      if(!compact) {
        text(ctx,`generation ${String(generation).padStart(2,'0')} / 48`,6,35,muted,amount*.9,10);
        // All eight real neighbourhoods and their Rule110 outputs, 111→000.
        for(let pattern=7;pattern>=0;pattern--) {
          const x=8+(7-pattern)*(box.w-16)/8, unit=Math.min(6,(box.w-22)/32);
          for(let bit=0;bit<3;bit++) fillBox(ctx,x+bit*(unit+1),47,unit,unit,((pattern>>(2-bit))&1)?accent:muted,solid*(((pattern>>(2-bit))&1)?.8:.12));
          fillBox(ctx,x+unit+1,59,unit,unit,((110>>pattern)&1)?highlight:muted,solid*(((110>>pattern)&1)?.9:.12));
          segment(ctx,x+unit*1.5+1,55,x+unit*1.5+1,58,muted,solid*.35);
        }
      }
      fillBox(ctx,left-3,top-3,cols*cell+6,visible*cell+6,muted,solid*.035);
      for(let row=0;row<visible;row++) for(let x=0;x<cols;x++) {
        const index=first+row;if(index>generation)continue;
        const alive=history[index][x],newest=index===generation,fade=row===0&&offset?1-drift:newest&&generation>0?.45+.55*drift:1;
        const cx=left+x*cell,cy=top+(row-offset)*cell;
        const color=newest&&alive?highlight:alive?accent:muted;
        fillBox(ctx,cx,cy,Math.max(.8,cell-1),Math.max(.8,cell-1),color,solid*fade*(alive?.45+row/visible*.45:.065));
        if(flow&&amount<.995&&alive) carry(ctx,'■',cx,cy+cell/2,color,amount*fade*(1-smooth((amount-.70)/.29)),Math.max(4,cell*.88));
      }
      if(!compact) text(ctx,'111 110 101 100 011 010 001 000',6,box.h-24,muted,amount*.65,9);
      text(ctx,'three neighbours decide the next cell',6,box.h-10,muted,amount*.85,compact?9:10);
    } else {
      const clock=cycle(time,6200)/560,step=Math.min(Math.floor(clock),graphFrames.length-1),current=graphFrames[step];
      const travel=smooth(clock%1),done=current.current<0,top=compact?30:64,bottom=box.h-(compact?23:85),usable=Math.max(8,bottom-top);
      const radius=compact?5:Math.min(17,box.w/21),point=i=>({x:graphNodes[i][0]*box.w,y:top+graphNodes[i][1]*usable});
      if(!compact)text(ctx,done?'complete / all 8 vertices reached':`visit ${String.fromCharCode(65+current.current)} / ${current.visited.length} of 8 vertices`,6,35,done?accent:muted,amount*.9,10);
      for(const[a,b]of graphEdges){
        const tree=current.parents.get(b)===a||current.parents.get(a)===b,from=point(a),to=point(b);
        const d=Math.hypot(to.x-from.x,to.y-from.y),ux=(to.x-from.x)/d,uy=(to.y-from.y)/d;
        ctx.lineWidth=tree?2:1;
        segment(ctx,from.x+ux*radius,from.y+uy*radius,to.x-ux*radius,to.y-uy*radius,tree?accent:muted,solid*(tree?.8:.20));
      }
      for(const child of current.added){
        const from=point(current.current),to=point(child);
        for(let tail=2;tail>=0;tail--){const f=clamp(travel-tail*.12),x=from.x+(to.x-from.x)*f,y=from.y+(to.y-from.y)*f;
          dot(ctx,x,y,highlight,solid*(1-tail*.3),tail?1.5:3.5);
          if(!tail&&flow&&amount<.995)carry(ctx,'◆',x-3,y,highlight,amount*(1-smooth((amount-.70)/.29)),7);
        }
      }
      graphNodes.forEach((_,i)=>{
        const p=point(i),active=i===current.current,visited=current.visited.includes(i),queued=current.queue.includes(i),color=active?highlight:queued||done?accent:visited?ink:muted;
        dot(ctx,p.x+1,p.y+2,muted,solid*.07,radius+1);
        dot(ctx,p.x,p.y,color,solid*(active?.28:queued?.18:visited?.12:.055),radius);
        ctx.globalAlpha=solid*((active||queued||visited)?.9:.3);ctx.strokeStyle=color;ctx.lineWidth=active?2:1;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();
        text(ctx,String.fromCharCode(65+i),p.x-(compact?3:3.6),p.y,color,amount*(active||queued||visited?1:.55),compact?10:12);
      });
      if(!compact){
        text(ctx,'FIFO',6,box.h-54,muted,amount*.8,10);
        const qx=45,qw=Math.min(28,(box.w-65)/Math.max(1,current.queue.length));
        current.queue.forEach((vertex,index)=>{const x=qx+index*(qw+4);fillBox(ctx,x,box.h-66,qw,24,accent,solid*.13);ctx.globalAlpha=solid*.6;ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.strokeRect(x,box.h-66,qw,24);text(ctx,String.fromCharCode(65+vertex),x+qw/2-3,box.h-54,accent,amount,11);});
        if(!current.queue.length)text(ctx,'empty',qx,box.h-54,muted,amount*.7,10);
      }
      text(ctx,`queue [${current.queue.map(i=>String.fromCharCode(65+i)).join(' ')}]${done?' / traversal complete':' / first in → first out'}`,6,box.h-10,muted,amount*.85,compact?9:10);
    }
    ctx.restore();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom};
  }

  window.PortfolioEntranceEffects = Object.freeze({
    bounds(kind, args) {
      if (!["history", "tokens", "sort", "automaton", "graph", "interference", "ecdsa", "fourier", "attractor", "phyllotaxis", "pathfinding", "quadtree", "convolution"].includes(kind) || !(args?.width > 0) || !(args.height > 0)) return null;
      return layout(args, kind === "history" ? 206 : kind === "ecdsa" ? 300 : 320);
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
        if (kind === "ecdsa") return window.PortfolioECDSAEffect?.draw(args, { layout, begin, text, segment, dot, carry, clamp, smooth }) || null;
        if (["fourier", "attractor", "phyllotaxis"].includes(kind)) return window.PortfolioSignalEffects?.draw(kind, args, { layout, begin, text, segment, dot, carry, clamp, smooth }) || null;
        if (["pathfinding", "quadtree", "convolution"].includes(kind)) return window.PortfolioStructureEffects?.draw(kind, args, { layout, begin, text, segment, dot, carry, clamp, smooth }) || null;
        if (kind === "interference") return interference(args);
        if (kind === "history") return history(args);
        if (kind === "tokens") return tokens(args);
        if (["sort", "automaton", "graph"].includes(kind)) return algorithm(kind, args);
        return null;
      } finally { flow = null; }
    },
  });
})();
