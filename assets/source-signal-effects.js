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
    for (let step = 0; step < 2000 + 2048 * 2; step++) {
      const a = derivative(p), b = derivative(advance(p, a, dt / 2));
      const c = derivative(advance(p, b, dt / 2)), d = derivative(advance(p, c, dt));
      p = p.map((value, i) => value + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
      if (step >= 2000 && (step - 2000) % 2 === 0) trace.push(p);
    }
    lorenzTrace = trace;
    return trace;
  }

  const circle = Object.freeze(Array.from({ length: 65 }, (_, i) => Object.freeze({ x: Math.cos(i / 64 * TAU), y: Math.sin(i / 64 * TAU) })));
  const seedModels = new Map();
  function seeds(count) {
    if (!seedModels.has(count)) seedModels.set(count, Object.freeze(Array.from({ length: count }, (_, n) => Object.freeze({
      angle: n * goldenAngle, fraction: (n + .5) / count, radius: Math.sqrt((n + .5) / count),
    }))));
    return seedModels.get(count);
  }
  function path(ctx, points, color, alpha, width = 1, fill = false) {
    if (!points.length || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (fill) { ctx.closePath(); ctx.fill(); } else ctx.stroke();
  }
  function ring(ctx, x, y, radius, color, alpha, width = 1) {
    path(ctx, circle.map(p => ({ x: x + p.x * radius, y: y + p.y * radius })), color, alpha, width);
  }
  function instrument(ctx, helpers, box, title, caption, amount, accent, muted) {
    const { text } = helpers;
    text(ctx, title, 10, 17, accent, amount, 11);
    text(ctx, caption, 10, 36, muted, amount * .8, 10);
    path(ctx, [{ x: 10, y: 47 }, { x: box.w - 10, y: 47 }], muted, amount * .18);
  }

  function fourier(args, helpers, box, ctx) {
    const { carry, text, segment, dot, smooth } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const top = 67, bottom = box.h - 89;
    const center = { x: box.w * .235, y: (top + bottom) / 2 };
    const radius = Math.max(1, Math.min(box.w * .123, (bottom - top) * .33));
    const phase = time / 1700 + args.pointerX * .55;
    const mesh = amount * smooth((amount - .32) / .68);
    const glyph = amount * (1 - smooth((amount - .6) / .4));
    const waveLeft = box.w * .53, waveRight = box.w - 12;
    const sampleCount = 193, span = TAU * 1.35;
    const sample = angle => oddHarmonics.reduce((sum, n) => sum + Math.sin(n * angle) / n, 0);
    instrument(ctx, helpers, box, 'FOURIER / HARMONIC SYNTHESIS', 'four rotating vectors, one signal', amount, accent, muted);
    text(ctx, 'PHASE', 10, 60, muted, amount * .65, 10);
    text(ctx, 'OUTPUT', waveLeft, 60, muted, amount * .65, 10);
    // A calibrated scope grid and amplitude envelope leave the waveform readable.
    for (const multiple of [-1, 0, 1]) path(ctx, [{ x: waveLeft, y: center.y + radius * multiple }, { x: waveRight, y: center.y + radius * multiple }], muted, mesh * (multiple ? .1 : .25));
    for (let i = 0; i < 5; i++) {
      const x = waveLeft + (waveRight - waveLeft) * i / 4;
      path(ctx, [{ x, y: top + 3 }, { x, y: bottom - 3 }], muted, mesh * .12);
    }
    let tip = { ...center };
    oddHarmonics.forEach((harmonic, index) => {
      const r = radius / harmonic;
      ring(ctx, tip.x, tip.y, r, index ? accent : muted, mesh * (index ? .3 : .45), index ? .85 : 1.1);
      const next = { x: tip.x + r * Math.cos(harmonic * phase), y: tip.y + r * Math.sin(harmonic * phase) };
      segment(ctx, tip.x, tip.y, next.x, next.y, index === 3 ? highlight : accent, mesh * .85);
      dot(ctx, tip.x, tip.y, accent, mesh * .8, index ? 1.7 : 2.2);
      // These source characters dissolve as the continuous construction settles.
      for (let i = 0; glyph > 0 && i < 16; i++) {
        const angle = i / 16 * TAU;
        carry(ctx, index ? '+' : 'o', tip.x + Math.cos(angle) * r - 3, tip.y + Math.sin(angle) * r, accent, glyph * .65, 9);
      }
      tip = next;
    });
    const waveform = Array.from({ length: sampleCount }, (_, i) => {
      const angle = phase - i / (sampleCount - 1) * span;
      return { x: waveLeft + (waveRight - waveLeft) * i / (sampleCount - 1), y: center.y + radius * sample(angle) };
    });
    path(ctx, [{ x: waveLeft, y: center.y }, ...waveform, { x: waveRight, y: center.y }], accent, mesh * .07, 1, true);
    path(ctx, waveform, accent, mesh * .14, 5);
    path(ctx, waveform, highlight, mesh * .95, 1.6);
    segment(ctx, tip.x, tip.y, waveLeft, tip.y, accent, mesh * .5);
    dot(ctx, tip.x, tip.y, highlight, mesh, 3);
    dot(ctx, waveLeft, tip.y, highlight, mesh, 2.5);
    if (glyph > 0) carry(ctx, '*', tip.x - 4, tip.y, highlight, glyph, 11);
    for (let i = 0; glyph > 0 && i < waveform.length; i += 8) carry(ctx, '~', waveform[i].x - 3, waveform[i].y, accent, glyph * .75, 10);
    // The small traces isolate each real term with the same phase and amplitude ratio.
    oddHarmonics.forEach((harmonic, index) => {
      const y = box.h - 70 + index * 15;
      text(ctx, `n=${harmonic}`, 10, y, muted, amount * .8, 10);
      const component = Array.from({ length: 97 }, (_, i) => ({ x: 45 + (box.w - 57) * i / 96,
        y: y + 5.5 * Math.sin(harmonic * (phase - i / 96 * span)) / harmonic }));
      path(ctx, [{ x: 45, y }, { x: box.w - 12, y }], muted, mesh * .1);
      path(ctx, component, index === 0 ? accent : muted, mesh * .7, 1.05);
    });
    text(ctx, 'odd harmonics → square-wave limit', 10, box.h - 9, accent, amount * .8, 10);
  }

  function attractor(args, helpers, box, ctx) {
    const { carry, text, dot, smooth, clamp } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const trace = attractorTrace();
    const yaw = -.16 + Math.sin(time / 11000) * .22 + args.pointerX * .2;
    const pitch = .17 + args.pointerY * .13;
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const project = ([x, y, z]) => ({ x: x * c - y * s, y: -(z - 26) * cp + (x * s + y * c) * sp, depth: (x * s + y * c) * cp + (z - 26) * sp });
    const projected = trace.map(project);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minD = Infinity, maxD = -Infinity;
    for (const p of projected) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minD = Math.min(minD, p.depth); maxD = Math.max(maxD, p.depth);
    }
    const top = 59, bottom = box.h - 40, centerY = (top + bottom) / 2;
    const scale = Math.min((box.w - 40) / (maxX - minX), (bottom - top) / (maxY - minY));
    const place = p => ({ x: box.w / 2 + (p.x - (minX + maxX) / 2) * scale,
      y: centerY + (p.y - (minY + maxY) / 2) * scale, depth: (p.depth - minD) / (maxD - minD) });
    const points = projected.map(place);
    const mesh = amount * smooth((amount - .32) / .68), glyph = amount * (1 - smooth((amount - .6) / .4));
    // The complete true trajectory remains visible, shaded by projected depth.
    path(ctx, points, muted, mesh * .12, .65);
    for (let start = 0; start < points.length - 1; start += 16) {
      const strip = points.slice(start, start + 17), depth = strip.reduce((sum, p) => sum + p.depth, 0) / strip.length;
      path(ctx, strip, depth > .6 ? accent : muted, mesh * (.12 + depth * .3), .65 + depth * .7);
    }
    for (let i = 0; glyph > 0 && i < points.length; i += 12) carry(ctx, i % 36 ? '.' : ':', points[i].x - 2, points[i].y, accent, glyph * .7, 10);
    // Phase starts inside the record so reduced motion is a finished instrument.
    const clock = mod(time / 21 + 900, points.length), head = Math.floor(clock), fraction = clock - head;
    for (let band = 11; band >= 0; band--) {
      const start = Math.max(0, head - (band + 1) * 28), end = Math.max(0, head - band * 28);
      path(ctx, points.slice(start, end + 1), band < 3 ? highlight : accent, mesh * (.96 - band * .065), band < 3 ? 1.85 : 1.15);
    }
    const p = points[head], next = points[Math.min(head + 1, points.length - 1)];
    const headX = p.x + (next.x - p.x) * fraction, headY = p.y + (next.y - p.y) * fraction;
    // Never invent a segment between the end and beginning of the finite record.
    const seam = clamp(Math.min(clock, points.length - clock) / 18);
    dot(ctx, headX, headY, accent, mesh * seam * .14, 8);
    dot(ctx, headX, headY, highlight, mesh * seam, 2.8);
    if (glyph > 0) carry(ctx, '+', headX - 4, headY, highlight, glyph * seam, 11);
    // Crosshairs mark the actual nonzero equilibria, not decorative orbit centres.
    for (const sign of [-1, 1]) {
      const equilibrium = place(project([sign * Math.sqrt(72), sign * Math.sqrt(72), 27]));
      const { x, y } = equilibrium;
      path(ctx, [{ x: x - 4, y }, { x: x + 4, y }], muted, mesh * .45);
      path(ctx, [{ x, y: y - 4 }, { x, y: y + 4 }], muted, mesh * .45);
    }
    instrument(ctx, helpers, box, 'LORENZ / DETERMINISTIC CHAOS', 'one trajectory · two strange wings', amount, accent, muted);
    text(ctx, 'σ 10     ρ 28     β 8/3', 10, box.h - 20, accent, amount * .85, 10);
    text(ctx, 'RK4 / fixed step 0.008', 10, box.h - 6, muted, amount * .65, 10);
  }

  function phyllotaxis(args, helpers, box, ctx) {
    const { carry, text, smooth, clamp } = helpers;
    const { amount, time, accent, muted, highlight } = args;
    const count = box.w < 300 ? 233 : 377, model = seeds(count);
    const radius = Math.min(box.w * .405, (box.h - 106) / 2);
    const center = { x: box.w / 2, y: (57 + box.h - 43) / 2 };
    const rotation = time / 32000 + args.pointerX * .25;
    const opening = .72 + .28 * smooth(Math.max(0, time) / 2400);
    const mesh = amount * smooth((amount - .32) / .68), glyph = amount * (1 - smooth((amount - .6) / .4));
    const points = model.map(seed => {
      const reveal = smooth(clamp((opening - seed.fraction) * 12 + 1)), angle = seed.angle + rotation;
      // Vogel's disk: r ∝ sqrt(n). The optional pointer lens is only a visual deformation.
      const r = radius * seed.radius * (.85 + .15 * reveal) * (1 + args.pointerY * .035 * Math.cos(angle * 2));
      return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r, angle, reveal, fraction: seed.fraction };
    });
    // Opposing real index families reveal the same parastichies seen in a seed head.
    for (const stride of [13, 21]) for (let start = 0; start < stride; start++) {
      const arm = [];
      for (let i = start; i < count; i += stride) if (points[i].reveal > .95) arm.push(points[i]);
      path(ctx, arm, stride === 13 ? accent : muted, mesh * (start === 0 ? .35 : .12), start === 0 ? 1.2 : .65);
    }
    const size = radius / Math.sqrt(count);
    points.forEach((p, n) => {
      const phase = TAU * (Math.sqrt(p.fraction) - time / 10500);
      const pulse = Math.pow((1 + Math.cos(phase)) / 2, 9);
      const alpha = mesh * p.reveal * (.48 + pulse * .5);
      ctx.globalAlpha = alpha; ctx.fillStyle = pulse > .5 ? highlight : n % 13 === 0 ? accent : muted;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, size * .67, size * .32, p.angle + Math.PI / 2, 0, TAU); ctx.fill();
      if (glyph > 0 && n % 6 === 0) carry(ctx, n % 18 ? '.' : '*', p.x - 3, p.y, accent, glyph * p.reveal * .85, 10);
    });
    ring(ctx, center.x, center.y, radius + 6, muted, mesh * .16, .8);
    // Radial calibration ticks stay outside the seed field.
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * TAU;
      path(ctx, [{ x: center.x + Math.cos(angle) * (radius + 7), y: center.y + Math.sin(angle) * (radius + 7) },
        { x: center.x + Math.cos(angle) * (radius + 10), y: center.y + Math.sin(angle) * (radius + 10) }], muted, mesh * .3);
    }
    instrument(ctx, helpers, box, 'PHYLLOTAXIS / GOLDEN ANGLE', `${count} seeds · equal-area growth`, amount, accent, muted);
    text(ctx, '137.508° / 13 + 21 spiral families', 10, box.h - 18, accent, amount * .85, 10);
    text(ctx, 'r = c√n      θ = n × 137.508°', 10, box.h - 7, muted, amount * .65, 10);
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
      const box = layout(frame, 320), ctx = begin(frame, box);
      try {
        if (kind === 'fourier') fourier(frame, helpers, box, ctx);
        else if (kind === 'attractor') attractor(frame, helpers, box, ctx);
        else phyllotaxis(frame, helpers, box, ctx);
      } finally { ctx.restore(); }
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    },
  });
})();
