// A deliberately tiny, public ECDSA example. The plotted points are in F_17;
// scalar arithmetic is in Z_19. No real-number curve is drawn between them.
(() => {
  let cache = null;
  const titles = ['the curve', 'public key', 'one-use nonce', 'sign', 'verify', 'result'];
  const coordinate = point => point ? `(${point.x},${point.y})` : '∞';

  function example(api) {
    if (!cache || cache.api !== api) {
      const demo = api.makeDemo();
      cache = { api, demo, changed: api.verifyDetails(demo.hash + 1, demo.signature, demo.publicKey) };
    }
    return cache;
  }

  function draw(args, helpers) {
    const api = window.PortfolioECDSA;
    if (!api || !args?.context) return null;
    const { layout, begin, text, segment, carry, clamp } = helpers;
    const { demo, changed } = example(api);
    const amount = clamp(args.amount ?? 1);
    const step = Math.round(clamp(args.ecdsaStep ?? 0, 0, 5));
    const progress = clamp(args.ecdsaProgress ?? 0);
    const tampered = Boolean(args.ecdsaTampered);
    const check = tampered ? changed : demo.verification;
    const hash = demo.hash + (tampered ? 1 : 0);
    const ink = args.ink || '#cbcbb6';
    const muted = args.muted || ink;
    const accent = args.accent || ink;
    const highlight = args.highlight || accent;
    const box = layout(args, 300);
    const ctx = begin(args, box);
    const narrow = box.w < 380;
    const short = box.h < 205;
    const type = narrow ? 8.5 : 11;
    const plotLeft = 18;
    const plotTop = short ? 45 : 64;
    // Reserve distinct rows for coordinate ticks, the point-cloud caption and
    // the toy-value disclosure even when the canvas height limits the plot.
    const plotSize = Math.max(30, Math.min(206, (box.w - 42) * .5, box.h - (short ? 96 : 116)));
    const plotBottom = plotTop + plotSize;
    const copyX = Math.max(plotLeft + plotSize + 22, box.w * .49);
    const copyY = short ? 61 : 80;
    const rowGap = Math.min(narrow ? 19 : 25, (box.h - copyY - 40) / 6);
    const pointSize = narrow ? 8 : 10;
    const project = point => ({
      x: plotLeft + point.x / 16 * plotSize,
      y: plotBottom - point.y / 16 * plotSize,
    });
    const write = (value, x, y, color = ink, alpha = 1, size = type) =>
      text(ctx, value, x, y, color, amount * alpha, size);
    const marker = (point, label, color = highlight, alpha = 1) => {
      if (!point) return;
      const position = project(point);
      carry(ctx, '◆', position.x - pointSize * .3, position.y, color, amount * alpha, pointSize);
      if (label) {
        const x = clamp(position.x + 7, plotLeft + 2, plotLeft + plotSize - label.length * 5.1);
        const y = position.y < plotTop + 9 ? position.y + 11 : position.y - 10;
        write(label, x, y, color, alpha, narrow ? 8 : 9);
      }
    };
    const rows = (lines, active = -1) => lines.forEach((line, index) => {
      write(line, copyX, copyY + index * rowGap, index === active ? highlight : ink,
        index === active ? 1 : .83);
    });

    try {
      write(`ECDSA / ${titles[step]}`, 6, 13, accent, .95, narrow ? 10 : 12);
      write(`${step + 1}/6`, box.w - 25, 13, muted, .7, 9);
      write('y² = x³ + 2x + 2 (mod 17)', 6, short ? 30 : 35, ink, .8, narrow ? 8 : 10);
      if (!short) {
        write('coordinates / p = 17', 6, 51, muted, .75, narrow ? 7 : 8);
        write('scalars / n = 19', copyX, 51, muted, .75, narrow ? 7 : 8);
      }

      // Axes and finite-field sites stay separate from any group operation.
      segment(ctx, plotLeft, plotTop, plotLeft, plotBottom, muted, amount * .22);
      segment(ctx, plotLeft, plotBottom, plotLeft + plotSize, plotBottom, muted, amount * .22);
      for (const value of [0, 8, 16]) {
        const offset = value / 16 * plotSize;
        write(String(value), plotLeft + offset - (value > 9 ? 5 : 2), plotBottom + 12, muted, .8, 8);
        write(String(value), plotLeft - (value > 9 ? 14 : 10), plotBottom - offset, muted, .8, 8);
      }
      for (const point of api.POINTS) {
        const { x, y } = project(point);
        carry(ctx, '·', x - 3, y, muted, amount * .75, narrow ? 12 : 14);
      }

      if (step <= 2) marker(api.CURVE.G, 'G', accent, step === 0 ? 1 : .6);

      if (step === 0) {
        rows(['G = (5,1)', 'order n = 19', '19G = ∞', '18 finite points', '+ identity ∞'], 0);
      } else if (step === 1 || step === 2) {
        const key = step === 1;
        const trace = key ? demo.keySteps : demo.nonceSteps;
        const index = Math.min(trace.length - 1, Math.floor(progress * trace.length));
        const current = trace[index];
        const finished = index === trace.length - 1;
        for (let i = 1; i < index; i++) marker(trace[i].point, '', accent, .45);
        if (!key) marker(demo.publicKey, 'Q', muted, .65);
        marker(current.point, finished ? key ? 'Q' : 'R' : `${current.scalar}G`, highlight);
        rows(key
          ? [`d = ${demo.privateKey} (demo)`, 'Q = dG', `${current.scalar}G = ${coordinate(current.point)}`,
            finished ? 'Q = (0,6)' : '+ G each step', 'public key Q']
          : [`k = ${demo.nonce} (demo)`, 'R = kG', `${current.scalar}G = ${coordinate(current.point)}`,
            finished ? 'R = (10,6)' : '+ G each step', 'fresh k per sign'], 2);
      } else if (step === 3) {
        marker(demo.noncePoint, 'R', highlight);
        rows([`z = ${demo.hash} · k⁻¹ = ${demo.nonceInverse}`, 'r = x(R) mod 19', `  = ${demo.signature.r}`,
          's = k⁻¹(z + rd)', `  = ${demo.signature.s} (mod 19)`, `signature (${demo.signature.r},${demo.signature.s})`],
        Math.min(5, Math.floor(progress * 6)));
      } else if (step === 4) {
        // A and B are products in the group, not Cartesian vector components.
        if (progress >= .12) marker(check.leftPoint, 'A', accent, .9);
        if (progress >= .40) marker(check.rightPoint, 'B', ink, .9);
        if (progress >= .72) marker(check.point, 'V', highlight);
        rows([`z = ${hash} · w = s⁻¹`, `w = ${check.w}`, `u₁ = zw mod 19 = ${check.u1}`,
          `u₂ = rw mod 19 = ${check.u2}`, 'A = u₁G · B = u₂Q', 'V = A + B',
          `V = ${coordinate(check.point)}`], Math.min(6, Math.floor(progress * 7)));
      } else {
        marker(check.point, 'V', highlight);
        rows([tampered ? `hash changed: ${demo.hash} → ${hash}` : `hash z = ${hash}`, `V = ${coordinate(check.point)}`,
          `x(V) mod 19 = ${check.xModN}`, `signature r = ${demo.signature.r}`,
          check.valid ? `${check.xModN} = ${demo.signature.r}  ✓ ACCEPT` : `${check.xModN} ≠ ${demo.signature.r}  × REJECT`,
          'same Q and (r,s)'], 4);
      }

      if (!short) write('discrete field points', 6, box.h - 24, muted, .65, narrow ? 7 : 8);
      write('toy only · d / k are public demo values', 6, box.h - 7, muted, .8, narrow ? 7 : 8);
    } finally {
      ctx.restore();
    }
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  window.PortfolioECDSAEffect = Object.freeze({ draw });
})();
