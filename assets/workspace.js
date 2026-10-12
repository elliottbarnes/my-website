/* Local Dragon Ball project radar and project-wheel interactions. No telemetry or network requests. */
(() => {
  "use strict";
  const root = document.documentElement;
  const workspace = document.getElementById("workspace");
  const about = document.querySelector('[data-panel="about"]');
  const canvas = document.getElementById("profile-plot");
  const navigation = document.querySelector(".file-list");
  const pointerLabel = document.querySelector("[data-workspace-pointer]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let targetX = 0, targetY = 0, readoutTime = 0;
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
    function pull(distance, active = true) {
      navigation.dataset.dragging = String(active && !quiet());
      navigation.style.setProperty("--wheel-pull", `${quiet() ? 0 : Math.max(-24, Math.min(24, distance * .65))}px`);
    }
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
      if (!drag.moved && Math.abs(dx) > Math.abs(dy)) return;
      pull(dy);
      if (Math.abs(dy) > 6) drag.pulled = true;
      if (Math.abs(dy) < 28) return;
      if (select(dy < 0 ? 1 : -1)) {
        drag.moved = true;
        drag.y = event.clientY;
        drag.x = event.clientX;
        pull(0);
        suppressUntil = performance.now() + 500;
        try { navigation.setPointerCapture(event.pointerId); } catch { /* Pointer may already have ended. */ }
        if (event.cancelable) event.preventDefault();
      }
    }, { passive: false });
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved || drag.pulled) suppressUntil = performance.now() + 500;
      drag = null;
      pull(0, false);
      try { if (navigation.hasPointerCapture(event.pointerId)) navigation.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    };
    navigation.addEventListener("pointerup", endDrag);
    navigation.addEventListener("pointercancel", endDrag);
    // Touch starts with implicit capture on the card. Transferring it to the
    // wheel emits a bubbling capture-loss event from that card, not the wheel.
    navigation.addEventListener("lostpointercapture", event => {
      if (event.target === navigation) endDrag(event);
    });
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
  const radar = canvas.closest(".dragon-radar");
  const signals = Array.from(radar.querySelectorAll("[data-radar-route]"));
  const locations = [[-.48, -.35], [.38, -.53], [.56, .26], [-.35, .51]];
  let width = 0, height = 0, frame = 0, lastFrame = 0, elapsed = 0;
  let ink = "#c9b798", muted = "#969082", accent = ink;
  let centerX = 0, centerY = 0, radius = 0, selected = -1, energyAnimation;
  const active = () => workspaceVisible() && !about.hidden;
  const tau = Math.PI * 2;

  function colors() {
    const style = getComputedStyle(root);
    ink = style.getPropertyValue("--ink").trim() || ink;
    muted = style.getPropertyValue("--muted").trim() || ink;
    accent = style.getPropertyValue("--accent").trim() || ink;
  }

  function circle(x, y, r) {
    context.beginPath(); context.arc(x, y, r, 0, tau); context.stroke();
  }

  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    // Pausing stops the clock, not the drawing state, so resume stays continuous.
    const angle = elapsed / 1700;
    context.lineWidth = .7;
    context.strokeStyle = muted;
    context.globalAlpha = .45;
    circle(centerX, centerY, radius);
    circle(centerX, centerY, radius + 4);
    context.save();
    context.beginPath(); context.arc(centerX, centerY, radius, 0, tau); context.clip();
    // A real polar grid: rings, compass axes, and a rotating scan sector.
    for (const fraction of [.25, .5, .75]) circle(centerX, centerY, radius * fraction);
    context.globalAlpha = .22;
    for (let axis = 0; axis < 4; axis++) {
      const theta = axis * Math.PI / 4;
      context.beginPath();
      context.moveTo(centerX - Math.cos(theta) * radius, centerY - Math.sin(theta) * radius);
      context.lineTo(centerX + Math.cos(theta) * radius, centerY + Math.sin(theta) * radius);
      context.stroke();
    }
    context.fillStyle = accent;
    for (let slice = 0; slice < 24; slice++) {
      const theta = angle - slice * .025;
      context.globalAlpha = .12 * (1 - slice / 24);
      context.beginPath(); context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, theta - .025, theta);
      context.closePath(); context.fill();
    }
    context.globalAlpha = .7; context.strokeStyle = accent;
    context.beginPath(); context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    context.stroke(); context.restore();
    context.strokeStyle = ink;
    for (let tick = 0; tick < 48; tick++) {
      const theta = tick / 48 * tau;
      context.globalAlpha = tick % 4 === 0 ? .65 : .25;
      context.beginPath();
      context.moveTo(centerX + Math.cos(theta) * (radius + 7), centerY + Math.sin(theta) * (radius + 7));
      context.lineTo(centerX + Math.cos(theta) * (radius + (tick % 4 === 0 ? 11 : 9)), centerY + Math.sin(theta) * (radius + (tick % 4 === 0 ? 11 : 9)));
      context.stroke();
    }
    locations.forEach(([x, y], index) => {
      const phase = (elapsed / 1800 + index / 4) % 1;
      context.strokeStyle = accent;
      context.globalAlpha = selected === index ? .85 : .45 * (1 - phase);
      circle(centerX + x * radius, centerY + y * radius, selected === index ? 19 : 12 + phase * 11);
    });
    context.globalAlpha = 1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const compact = width < 360;
    radar.dataset.compact = String(compact);
    centerX = width * (compact ? .5 : .32);
    centerY = height * .5;
    radius = Math.max(0, Math.min(height / 2 - 17, width * (compact ? .5 : .30) - 17));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    signals.forEach((signal, index) => {
      signal.style.left = `${centerX + locations[index][0] * radius}px`;
      signal.style.top = `${centerY + locations[index][1] * radius}px`;
    });
    if (active()) draw();
  }
  function tick(now) {
    frame = 0;
    if (!active() || quiet()) { lastFrame = 0; return; }
    if (lastFrame && now - lastFrame < 40) { frame = requestAnimationFrame(tick); return; }
    elapsed += lastFrame ? Math.min(now - lastFrame, 80) : 0;
    lastFrame = now;
    draw(); frame = requestAnimationFrame(tick);
  }
  function refresh() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = 0;
    if (quiet() || document.hidden) energyAnimation?.cancel();
    colors(); resize();
    if (active() && !quiet()) frame = requestAnimationFrame(tick);
  }
  signals.forEach((signal, index) => {
    const highlight = () => { selected = index; if (active()) draw(); };
    const unhighlight = () => { selected = -1; if (active()) draw(); };
    signal.addEventListener("pointerenter", highlight);
    signal.addEventListener("focus", highlight);
    signal.addEventListener("pointerleave", unhighlight);
    signal.addEventListener("blur", unhighlight);
    signal.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || quiet()) return;
      // Ordinary hash links remain immediate; the energy pulse never delays navigation.
      energyAnimation?.cancel();
      energyAnimation = workspace.animate?.([
        { boxShadow: `0 0 24px -8px ${accent}` },
        { boxShadow: `0 0 0 0 transparent` },
      ], { duration: 360, easing: "ease-out" });
    });
  });
  window.addEventListener("portfolio:view", refresh);
  window.addEventListener("portfolio:preferences", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", refresh);
  if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(canvas);
  refresh();
})();
