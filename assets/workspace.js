/* Local, decorative contour study and project-wheel interactions. No telemetry or network requests. */
(() => {
  "use strict";
  const root = document.documentElement;
  const workspace = document.getElementById("workspace");
  const about = document.querySelector('[data-panel="about"]');
  const canvas = document.getElementById("profile-plot");
  const navigation = document.querySelector(".file-list");
  const pointerLabel = document.querySelector("[data-workspace-pointer]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0, readoutTime = 0;
  const workspaceVisible = () => root.dataset.view === "workspace" && !document.hidden;
  const quiet = () => root.dataset.motion === "paused" || (root.dataset.motion !== "running" && motion.matches);

  workspace?.addEventListener("pointermove", event => {
    const rect = workspace.getBoundingClientRect();
    if (!workspaceVisible() || !rect.width || !rect.height) return;
    targetX = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
    targetY = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5));
    if (pointerLabel && event.timeStamp - readoutTime > 80) {
      pointerLabel.textContent = `${(targetX + .5).toFixed(3)}, ${(targetY + .5).toFixed(3)}`;
      readoutTime = event.timeStamp;
    }
  }, { passive: true });
  workspace?.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; });

  if (navigation) {
    const buttons = Array.from(navigation.querySelectorAll("[data-select]"));
    let wheelTotal = 0, wheelTime = 0, lastSelection = -Infinity, drag = null, suppressUntil = 0, synthetic = false;
    function select(step) {
      if (!workspaceVisible() || buttons.length < 2) return false;
      const selected = Math.max(0, buttons.findIndex(button => button.getAttribute("aria-pressed") === "true"));
      const next = (selected + step + buttons.length) % buttons.length;
      synthetic = true;
      try { buttons[next].click(); } finally { synthetic = false; }
      return true;
    }
    navigation.addEventListener("wheel", event => {
      if (event.ctrlKey || event.metaKey || !workspaceVisible()) return;
      const now = performance.now();
      if (now - wheelTime > 180) wheelTotal = 0;
      wheelTime = now;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1;
      const delta = event.deltaY * scale;
      if (!Number.isFinite(delta) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (wheelTotal && Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
      wheelTotal += delta;
      if (Math.abs(wheelTotal) < 34 || now - lastSelection < 180) return;
      if (select(Math.sign(wheelTotal))) {
        event.preventDefault();
        lastSelection = now;
        wheelTotal = 0;
      }
    }, { passive: false });
    navigation.addEventListener("pointerdown", event => {
      if (!workspaceVisible() || event.button !== 0 || !event.isPrimary) return;
      drag = { id: event.pointerId, y: event.clientY, x: event.clientX, moved: false };
    });
    navigation.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      // A release outside the wheel can precede pointer capture. Never let the
      // next mouse/pen hover continue that drag; touch streams need no button mask.
      if (["mouse", "pen"].includes(event.pointerType) && (event.buttons & 1) === 0) {
        endDrag(event);
        return;
      }
      const dy = event.clientY - drag.y, dx = event.clientX - drag.x;
      if (Math.abs(dy) < 28 || (!drag.moved && Math.abs(dx) > Math.abs(dy))) return;
      if (select(dy < 0 ? 1 : -1)) {
        drag.moved = true;
        drag.y = event.clientY;
        drag.x = event.clientX;
        suppressUntil = performance.now() + 500;
        try { navigation.setPointerCapture(event.pointerId); } catch { /* Pointer may already have ended. */ }
        if (event.cancelable) event.preventDefault();
      }
    }, { passive: false });
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) suppressUntil = performance.now() + 500;
      drag = null;
      try { if (navigation.hasPointerCapture(event.pointerId)) navigation.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    };
    navigation.addEventListener("pointerup", endDrag);
    navigation.addEventListener("pointercancel", endDrag);
    navigation.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    navigation.addEventListener("click", event => {
      if (!synthetic && event.detail > 0 && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  const terminal = workspace?.querySelector(".terminal");
  const scrollCue = document.querySelector("[data-scroll-cue]");
  if (terminal && scrollCue) {
    const updateScrollCue = () => {
      scrollCue.hidden = terminal.scrollHeight - terminal.clientHeight - terminal.scrollTop <= 4;
    };
    terminal.addEventListener("scroll", updateScrollCue, { passive: true });
    window.addEventListener("portfolio:view", () => requestAnimationFrame(updateScrollCue));
    window.addEventListener("resize", updateScrollCue, { passive: true });
    if (typeof ResizeObserver === "function") {
      const contentObserver = new ResizeObserver(updateScrollCue);
      contentObserver.observe(terminal);
      terminal.querySelectorAll("[data-panel]").forEach(panel => contentObserver.observe(panel));
    }
    updateScrollCue();
  }

  if (!canvas || !about) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  let width = 0, height = 0, frame = 0, lastFrame = 0, elapsed = 0, reveal = 0;
  let contours = [], ink = "#c9b798", muted = "#969082", accent = ink, wasActive = false;
  const active = () => workspaceVisible() && !about.hidden;
  const clamp = value => Math.max(0, Math.min(1, value));

  function colors() {
    const style = getComputedStyle(root);
    ink = style.getPropertyValue("--plot-ink").trim() || style.getPropertyValue("--ink").trim() || "#c9b798";
    muted = style.getPropertyValue("--muted").trim() || ink;
    accent = style.getPropertyValue("--accent").trim() || ink;
  }

  function makeContours() {
    const cols = 192, rows = 124;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = cols; maskCanvas.height = rows;
    const mask = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!mask) return;
    mask.fillStyle = "#fff";
    mask.font = 'bold 116px "Plex Mono", monospace';
    mask.textAlign = "center";
    mask.textBaseline = "middle";
    mask.fillText("EB", cols / 2, rows / 2 + 3);
    const data = mask.getImageData(0, 0, cols, rows).data;
    const inside = Uint8Array.from({ length: cols * rows }, (_, i) => data[i * 4 + 3] > 110 ? 1 : 0);
    function distance(target) {
      const values = Float32Array.from(inside, value => value === target ? 0 : 10000);
      const visit = (x, y, reverse) => {
        const i = y * cols + x, direction = reverse ? 1 : -1;
        const nx = x + direction, ny = y + direction;
        if (nx >= 0 && nx < cols) values[i] = Math.min(values[i], values[y * cols + nx] + 1);
        if (ny >= 0 && ny < rows) {
          values[i] = Math.min(values[i], values[ny * cols + x] + 1);
          if (x > 0) values[i] = Math.min(values[i], values[ny * cols + x - 1] + Math.SQRT2);
          if (x < cols - 1) values[i] = Math.min(values[i], values[ny * cols + x + 1] + Math.SQRT2);
        }
      };
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) visit(x, y, false);
      for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) visit(x, y, true);
      return values;
    }
    const toInk = distance(1), toPaper = distance(0);
    const field = Float32Array.from(toInk, (value, i) => toPaper[i] - value);
    contours = [];
    for (let levelIndex = 0; levelIndex < 30; levelIndex++) {
      const level = -16 + levelIndex * .95;
      const path = new Path2D();
      for (let y = 1; y < rows - 2; y++) for (let x = 1; x < cols - 2; x++) {
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const values = corners.map(([cx, cy]) => field[cy * cols + cx]);
        const points = [];
        for (let edge = 0; edge < 4; edge++) {
          const next = (edge + 1) % 4, a = values[edge], b = values[next];
          if ((a < level) === (b < level)) continue;
          const amount = (level - a) / (b - a);
          points.push([corners[edge][0] + (corners[next][0] - corners[edge][0]) * amount,
            corners[edge][1] + (corners[next][1] - corners[edge][1]) * amount]);
        }
        for (let index = 0; index + 1 < points.length; index += 2) {
          path.moveTo(points[index][0] / cols, points[index][1] / rows);
          path.lineTo(points[index + 1][0] / cols, points[index + 1][1] / rows);
        }
      }
      contours.push({ path, level });
    }
  }

  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const compact = width < 360;
    const x = compact ? 11 : 23, y = compact ? 14 : 16;
    const plotWidth = width * .68, plotHeight = height - y - (compact ? 33 : 40);
    const right = width * .77, sideWidth = width - right - 13;
    const progress = quiet() ? 1 : clamp(reveal / 1350);
    const t = quiet() ? 0 : elapsed / 1000;
    context.strokeStyle = muted;
    context.fillStyle = muted;
    context.lineWidth = .5;
    context.globalAlpha = .4;
    context.beginPath();
    context.moveTo(x, y - 3); context.lineTo(x, y + plotHeight); context.lineTo(x + plotWidth, y + plotHeight);
    for (let n = 0; n <= 4; n++) {
      const tickX = x + plotWidth * n / 4;
      context.moveTo(tickX, y + plotHeight - 2); context.lineTo(tickX, y + plotHeight + 3);
    }
    context.stroke();
    context.font = `${compact ? 5.5 : 7}px "Plex Mono", monospace`;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.globalAlpha = .75;
    context.fillText("x", x + plotWidth + 5, y + plotHeight - 3);
    context.fillText("y", x - 2, y - 13);
    context.fillText("0", x, y + plotHeight + 5);
    context.fillText("1", x + plotWidth - 4, y + plotHeight + 5);
    const driftX = quiet() ? 0 : pointerX * 4;
    const driftY = quiet() ? 0 : pointerY * 3;
    contours.forEach((contour, index) => {
      const visible = clamp(progress * 34 - index);
      if (!visible) return;
      context.save();
      context.translate(x + driftX * Math.sin(index * .09), y + driftY * Math.cos(index * .12));
      context.scale(plotWidth, plotHeight);
      context.lineWidth = (compact ? .48 : .6) / plotWidth;
      context.strokeStyle = index % 6 === 0 ? accent : ink;
      context.globalAlpha = visible * (.29 + .43 * Math.sin((index + 1) / 31 * Math.PI));
      context.stroke(contour.path);
      context.restore();
    });
    context.globalAlpha = .5;
    context.strokeStyle = muted;
    context.lineWidth = .5;
    const graphY = y + 4, graphHeight = compact ? 31 : 48;
    context.beginPath();context.moveTo(right, graphY);context.lineTo(right, graphY + graphHeight);context.lineTo(right + sideWidth, graphY + graphHeight);context.stroke();
    context.beginPath();
    for (let n = 0; n <= 50; n++) {
      const u = n / 50;
      const signal = Math.exp(-Math.pow((u - .52 - pointerX * .05) * 5, 2)) * (.8 + .07 * Math.sin(t * .45));
      const px = right + u * sideWidth, py = graphY + graphHeight * (1 - signal);
      if (n) context.lineTo(px, py);else context.moveTo(px, py);
    }
    context.strokeStyle = ink;context.globalAlpha = .8;context.stroke();
    context.fillStyle = muted;context.globalAlpha = .75;
    context.fillText("f(x)", right + 2, graphY - 10);
    const labelY = graphY + graphHeight + (compact ? 18 : 27);
    context.fillText("SELECTED / 04", right, labelY);
    for (const [index, name] of ["glassbox", "pixel", "architecture", "automata"].entries()) {
      context.globalAlpha = .5 + .3 * clamp(progress * 5 - index);
      context.fillText(`${String(index + 1).padStart(2, "0")} ${name}`, right, labelY + 13 + index * (compact ? 10 : 14));
    }
    context.globalAlpha = 1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (active()) draw();
  }
  function tick(now) {
    frame = 0;
    if (!active() || quiet()) { lastFrame = 0; return; }
    if (lastFrame && now - lastFrame < 40) { frame = requestAnimationFrame(tick); return; }
    const delta = lastFrame ? Math.min(now - lastFrame, 80) : 0;
    lastFrame = now; elapsed += delta; reveal += delta;
    pointerX += (targetX - pointerX) * .12;
    pointerY += (targetY - pointerY) * .12;
    draw(); frame = requestAnimationFrame(tick);
  }
  function refresh() {
    const nowActive = active();
    if (nowActive && !wasActive) reveal = 0;
    wasActive = nowActive;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = 0;
    colors(); resize();
    if (nowActive && !quiet()) frame = requestAnimationFrame(tick);
  }
  window.addEventListener("portfolio:view", refresh);
  window.addEventListener("portfolio:preferences", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", refresh);
  colors(); makeContours(); refresh();
  document.fonts?.ready.then(() => { makeContours(); refresh(); });
})();
