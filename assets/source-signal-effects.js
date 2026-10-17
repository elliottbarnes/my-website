// Mathematical sketches drawn from the same source glyphs as the surrounding text.
// No timers: the host's effect clock owns animation, pause, and reduced motion.
(() => {
  const TAU = Math.PI * 2;
  const kinds = Object.freeze(['fourier', 'attractor', 'phyllotaxis']);
  const oddHarmonics = [1, 3, 5, 7];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const mod = (value, period) => ((value % period) + period) % period;
  let lorenzTrace;

  // Lorenz (1963), equations 25–27; sigma=10, rho=28, beta=8/3.
  // Primary source: https://doi.org/10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2
  // Fixed-step RK4 and a discarded transient keep every replay deterministic.
  function attractorTrace() {
    if (lorenzTrace) return lorenzTrace;
    const derivative = ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
    const advance = (p, d, step) => p.map((value, i) => value + d[i] * step);
    const dt = .008, trace = [];
    let p = [1, 1, 1];
    for (let step = 0; step < 2000 + 2048 * 3; step++) {
      const a = derivative(p), b = derivative(advance(p, a, dt / 2));
      const c = derivative(advance(p, b, dt / 2)), d = derivative(advance(p, c, dt));
      p = p.map((value, i) => value + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
      if (step >= 2000 && (step - 2000) % 3 === 0) trace.push(p);
    }
    lorenzTrace = trace;
    return trace;
  }

  function path(ctx, points, color, alpha, width = .75) {
    if (!points.length || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  }

  function fourier(args, helpers, box, ctx) {
    const { carry, text, segment, dot, smooth } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const center = { x: box.w * .215, y: box.h * .51 };
    const radius = Math.min(box.w * .102, (box.h - 76) * .235);
    const phase = time / 1450 + args.pointerX * .5;
    const mesh = amount * smooth((amount - .4) / .6);
    const waveLeft = box.w * .49, waveRight = box.w - 10;
    let tip = { ...center };
    text(ctx, 'fourier / harmonic sum', 6, 13, accent, amount * .9, 9);
    text(ctx, 'rotate', 8, 36, muted, amount * .65, 8);
    text(ctx, 'sum → wave', waveLeft, 36, muted, amount * .65, 8);
    for (const [index, harmonic] of oddHarmonics.entries()) {
      const r = radius / harmonic;
      const circle = Array.from({ length: 33 }, (_, i) => ({
        x: tip.x + r * Math.cos(i / 32 * TAU), y: tip.y + r * Math.sin(i / 32 * TAU),
      }));
      path(ctx, circle, muted, mesh * .22);
      for (let i = 0; i < 32; i += index ? 4 : 2) {
        const p = circle[i];
        carry(ctx, '·', p.x - 1.5, p.y, index ? muted : accent, amount * (index ? .35 : .65), 6);
      }
      const next = { x: tip.x + r * Math.cos(harmonic * phase), y: tip.y + r * Math.sin(harmonic * phase) };
      segment(ctx, tip.x, tip.y, next.x, next.y, index === 3 ? highlight : accent, mesh * .65);
      carry(ctx, index ? '+' : 'o', tip.x - 2, tip.y, accent, amount * .8, 7);
      tip = next;
    }
    segment(ctx, waveLeft, center.y, waveRight, center.y, muted, mesh * .2);
    const waveform = Array.from({ length: 97 }, (_, i) => {
      const angle = phase - i / 96 * TAU * 1.15;
      return { x: waveLeft + (waveRight - waveLeft) * i / 96,
        y: center.y + radius * oddHarmonics.reduce((sum, n) => sum + Math.sin(n * angle) / n, 0) };
    });
    path(ctx, waveform, accent, mesh * .65, 1);
    for (let i = 0; i < waveform.length; i += 3) {
      const p = waveform[i];
      carry(ctx, i % 9 ? '·' : ':', p.x - 1.5, p.y, accent, amount * (.85 - i / 180), 7);
    }
    // The leftmost sample equals the epicycle endpoint at this exact phase.
    segment(ctx, tip.x, tip.y, waveLeft, tip.y, highlight, mesh * .42);
    segment(ctx, waveLeft, center.y - radius * 1.27, waveLeft, center.y + radius * 1.27, muted, mesh * .32);
    dot(ctx, waveLeft, tip.y, highlight, mesh, 2.1);
    carry(ctx, '✦', tip.x - 4, tip.y, highlight, amount, 10);
    text(ctx, '1 + 1/3 + 1/5 + 1/7', 8, box.h - 39, muted, amount * .7, 8);
    text(ctx, '4 odd harmonics → square wave', 6, box.h - 12, accent, amount * .8, box.w < 330 ? 8 : 9);
  }

  function attractor(args, helpers, box, ctx) {
    const { carry, text, dot, smooth, clamp } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const trace = attractorTrace();
    // A bounded camera orbit keeps both lobes visible instead of turning edge-on.
    const yaw = -.18 + Math.sin(time / 8700) * .25 + args.pointerX * .17;
    const pitch = .15 + args.pointerY * .12;
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const projected = trace.map(([x, y, z]) => ({ x: x * c - y * s, y: -(z - 26) * cp + (x * s + y * c) * sp }));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of projected) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const scale = Math.min((box.w - 30) / (maxX - minX), (box.h - 73) / (maxY - minY));
    const centerY = (34 + box.h - 39) / 2;
    const points = projected.map(p => ({ x: box.w / 2 + (p.x - (minX + maxX) / 2) * scale,
      y: centerY + (p.y - (minY + maxY) / 2) * scale }));
    const mesh = amount * smooth((amount - .4) / .6);
    path(ctx, points, muted, mesh * .14, .55);
    // Sparse source glyphs establish the entire silhouette while the tail ages.
    for (let i = 0; i < points.length; i += 6) {
      const p = points[i];
      carry(ctx, i % 18 ? '·' : ':', p.x - 1.5, p.y, accent, amount * .27, 6);
    }
    const clock = mod(time / 19 + 900, points.length), head = Math.floor(clock), fraction = clock - head;
    for (let band = 7; band >= 0; band--) {
      const start = Math.max(0, head - (band + 1) * 36), end = Math.max(0, head - band * 36);
      path(ctx, points.slice(start, end + 1), band < 2 ? highlight : accent, mesh * (.9 - band * .1), band < 2 ? 1 : .75);
    }
    for (let age = 216; age >= 0; age -= 6) {
      if (head - age < 0) continue;
      const p = points[head - age];
      carry(ctx, age < 24 ? '+' : '·', p.x - 2, p.y, age < 54 ? highlight : accent, amount * (1 - age / 290), 7);
    }
    const p = points[head], next = points[Math.min(head + 1, points.length - 1)];
    const headX = p.x + (next.x - p.x) * fraction, headY = p.y + (next.y - p.y) * fraction;
    // Fade at the recorded trace's replay boundary; never draw a fabricated join.
    const seam = clamp(Math.min(clock, points.length - clock) / 14);
    dot(ctx, headX, headY, highlight, mesh * seam, 2.4);
    carry(ctx, '✦', headX - 4, headY, highlight, amount * seam, 10);
    text(ctx, 'lorenz / deterministic chaos', 6, 13, accent, amount * .9, box.w < 330 ? 8 : 9);
    text(ctx, 'σ 10   ρ 28   β 8/3', 6, box.h - 12, muted, amount * .8, 8);
  }

  function phyllotaxis(args, helpers, box, ctx) {
    const { carry, text, smooth, clamp } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const count = box.w < 330 ? 233 : 377;
    const radius = Math.min(box.w * .41, (box.h - 78) / 2);
    const center = { x: box.w / 2, y: (34 + box.h - 36) / 2 };
    const rotation = time / 16000 + args.pointerX * .28;
    const opening = .42 + .58 * smooth(Math.max(0, time) / 2500);
    const frontier = mod(time / 7200, 1);
    const points = [];
    for (let n = 0; n < count; n++) {
      const fraction = (n + .5) / count;
      const reveal = smooth(clamp((opening - fraction) * 9 + 1));
      const angle = n * goldenAngle + rotation;
      // Vogel's golden-angle seed model: r ∝ sqrt(n), theta = n*pi*(3-sqrt(5)).
      // Pointer deformation is an explicitly visual lens, not a botanical simulation.
      const r = radius * Math.sqrt(fraction) * (.55 + .45 * reveal)
        * (1 + args.pointerY * .045 * Math.cos(angle * 2));
      points.push({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r, reveal, fraction });
    }
    const mesh = amount * smooth((amount - .4) / .6);
    // Two real neighbour sequences make the opposing spiral families legible.
    for (const [stride, start] of [[13, 0], [21, 5]]) {
      const arm = [];
      for (let i = start; i < count; i += stride) if (points[i].reveal > .95) arm.push(points[i]);
      path(ctx, arm, accent, mesh * .17, .7);
    }
    for (let n = 0; n < count; n++) {
      const p = points[n];
      const pulse = Math.max(0, 1 - Math.abs(Math.sqrt(p.fraction) - frontier) / .10);
      const seed = n % 13 === 0 ? '+' : n % 3 ? '·' : '*';
      carry(ctx, seed, p.x - 2, p.y, pulse > .35 ? highlight : n % 13 === 0 ? accent : muted,
        amount * p.reveal * (.5 + pulse * .5), seed === '·' ? 9 : 7);
    }
    carry(ctx, '✦', center.x - 4, center.y, highlight, amount, 10);
    text(ctx, 'phyllotaxis / seed geometry', 6, 13, accent, amount * .9, box.w < 330 ? 8 : 9);
    text(ctx, '137.508° / golden-angle lattice', 6, box.h - 12, muted, amount * .8, box.w < 330 ? 8 : 9);
  }

  window.PortfolioSignalEffects = Object.freeze({
    kinds,
    draw(kind, args, helpers) {
      if (!kinds.includes(kind) || !args?.context || !(args.width > 0) || !(args.height > 0) || !helpers) return null;
      const { clamp, layout, begin } = helpers;
      const ink = args.ink || '#cbcbb6', accent = args.accent || ink;
      const frame = { ...args, ink, accent, muted: args.muted || ink, highlight: args.highlight || accent,
        time: Number.isFinite(args.time) ? args.time : 0, amount: clamp(Number.isFinite(args.amount) ? args.amount : 1),
        pointerX: clamp(Number.isFinite(args.pointerX) ? args.pointerX : 0, -1, 1),
        pointerY: clamp(Number.isFinite(args.pointerY) ? args.pointerY : 0, -1, 1) };
      const box = layout(frame, 260), ctx = begin(frame, box);
      try {
        if (kind === 'fourier') fourier(frame, helpers, box, ctx);
        else if (kind === 'attractor') attractor(frame, helpers, box, ctx);
        else phyllotaxis(frame, helpers, box, ctx);
      } finally { ctx.restore(); }
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    },
  });
})();
