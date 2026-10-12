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
    const destinationX = clamp((anchor?.x ?? .5) * width, w / 2 + 12, width - w / 2 - 12);
    const destinationY = clamp((anchor?.y ?? .5) * height, h / 2 + 14, height - h / 2 - 16);
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

  function history(args) {
    const { context, amount, time, snippet, ink = "#cbcbb6", muted = ink, accent = ink, highlight = accent } = args;
    const box = layout(args, 206);
    const ctx = begin(args, box);
    const records = (Array.isArray(args.history) ? args.history : [])
      .filter(record => /^[0-9a-f]{7,40}$/i.test(record?.sha || "")).slice(0, 4).reverse();
    const count = records.length;
    const compact = box.w < 390;
    const hashWidth = compact ? 60 : 68;
    const startX = 8, endX = box.w - hashWidth - 8;
    const step = count > 1 ? (endX - startX) / (count - 1) : 0;
    const nodes = records.map((record, index) => ({ record, x: count === 1 ? (box.w - hashWidth) / 2 : startX + index * step,
      y: 50 + (index % 2) * 21 }));
    const bySha = new Map(nodes.map(node => [node.record.sha, node]));
    text(ctx, "git log --oneline", 8, 15, muted, amount * .8);
    text(ctx, "head", box.w - 32, 15, accent, amount * .8, 8);

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
      ctx.globalAlpha = amount * reveal * (index === count - 1 ? .75 : .35);
      ctx.strokeStyle = index === count - 1 ? accent : muted;
      ctx.strokeRect(node.x, node.y - 11, hashWidth, 22);
      trace(ctx, node.x, node.y - 11, node.x + hashWidth, node.y - 11, muted, amount * reveal * .4);
      text(ctx, node.record.sha.slice(0, 7), node.x + 6, node.y, index === count - 1 ? accent : ink, amount * reveal, compact ? 10 : 9);
    }

    const path = String(snippet?.path || "source").split("/");
    const repo = String(snippet?.repo || "repository");
    const columns = Math.max(12, Math.floor((box.w - 20) / 5.4));
    const treeY = 111;
    text(ctx, `${repo}/`, 8, treeY, accent, amount * .9);
    if (path.length > 1) {
      text(ctx, `└─ ${shorten(path.slice(0, -1).join("/"), columns - 3)}/`, 8, treeY + 17, muted, amount * .7);
      text(ctx, `   └─ ${shorten(path[path.length - 1], columns - 6)}`, 8, treeY + 34, ink, amount * .85);
    } else text(ctx, `└─ ${shorten(path[0], columns - 3)}`, 8, treeY + 17, ink, amount * .85);
    const latest = records[records.length - 1];
    const subject = latest ? String(latest.message || "").split("\n")[0] : "commit-pinned source";
    text(ctx, shorten(subject.toLowerCase(), columns), 8, box.h - 14, muted, amount * .65, 8);
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
    const rows = Math.min(sample.length, Math.max(3, Math.floor((box.h - 80) / spacing)));
    text(ctx, "compile sketch", 6, 13, muted, amount * .8);
    text(ctx, shorten(String(snippet?.path || "source"), Math.floor((box.w - 12) / 5.4)), 6, box.h - 10, muted, amount * .65, 8);
    for (let column = 0; column < 3; column++) {
      text(ctx, labels[column], centers[column] - cellWidth / 2, 34, column === 1 ? accent : muted, amount * .9, 8);
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
        const maxCharacters = Math.max(3, Math.floor((cellWidth - 8) / 4.8));
        text(ctx, shorten(pieces[column], maxCharacters), x + 4, y, column === 1 ? accent : ink, amount * reveal * .88, 8);
        if (column < 2) segment(ctx, x + cellWidth, y, centers[column + 1] - cellWidth / 2, y, muted, amount * reveal * .25);
      }
      const flow = ((time / 2400 + row * .14) % 1 + 1) % 1;
      const x = centers[0] + (centers[2] - centers[0]) * flow;
      dot(ctx, x, y, highlight, amount * reveal * .9, 1.6);
    }
    context.restore();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  window.PortfolioEntranceEffects = Object.freeze({
    draw(kind, args) {
      if (!args?.context || !(args.width > 0) || !(args.height > 0)) return null;
      flow = null;
      try {
        if (kind === "history") return history(args);
        if (kind === "tokens") return tokens(args);
        return null;
      } finally { flow = null; }
    },
  });
})();
