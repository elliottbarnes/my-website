/* A local, explicitly started training chamber. Physics lives in brick-breaker.js. */
(() => {
  "use strict";

  const dialog = document.getElementById("training-dialog");
  const canvas = document.getElementById("training-canvas");
  const engine = window.PortfolioBreakerEngine;
  if (!dialog || !canvas || !engine) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const root = document.documentElement;
  const status = document.getElementById("training-status");
  const score = document.getElementById("training-score");
  const lives = document.getElementById("training-lives");
  const action = document.getElementById("training-action");
  const pause = document.getElementById("training-pause");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const game = engine.create();
  const keys = new Set();
  const sprites = [];
  let opener = null;
  let paused = false;
  let frame = 0;
  let lastTime = null;
  let pointer = null;
  let trail = [];
  let sparks = [];
  let palette;
  let previousHealth = new Map();
  let previousPhase = game.phase;
  let lastCollected = 0;
  let lastAnnouncement = "";

  const decorative = () => !reducedMotion.matches && root.dataset.motion !== "paused";
  const active = () => dialog.open && !document.hidden && !paused;
  const terminal = () => game.phase === "won" || game.phase === "lost";
  const direction = () => Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));

  function loadSprites() {
    if (sprites.length) return;
    for (let star = 1; star <= 7; star++) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { if (dialog.open) draw(); };
      sprites.push(image);
      image.src = `/assets/dragon-ball-${star}.webp`;
    }
  }

  function colors() {
    const style = getComputedStyle(root);
    const value = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    palette = {
      paper: value("--paper", "#090e18"), ink: value("--ink", "#e9eff4"),
      muted: value("--muted", "#a1abba"), line: value("--line", "#303c4d"),
      panel: value("--panel", "#101d2d"), blue: value("--tech-blue", "#79bfff"),
      orange: "#ffab48", white: "#fff5d5",
    };
  }

  function announce(text) {
    if (text !== lastAnnouncement) {
      lastAnnouncement = text;
      if (status) status.textContent = text;
    }
  }

  function updateUI() {
    const text = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
    text(score, String(game.score * 15));
    text(lives, String(game.lives));
    if (action) {
      text(action, terminal() ? "again ↵" : game.phase === "ready" ? "release ki ↵" : "ki in flight");
      action.disabled = game.phase === "playing";
    }
    if (pause) {
      text(pause, paused ? ":resume" : ":pause");
      if (pause.getAttribute("aria-pressed") !== String(paused)) pause.setAttribute("aria-pressed", String(paused));
      const label = paused ? "resume game" : "pause game";
      if (pause.getAttribute("aria-label") !== label) pause.setAttribute("aria-label", label);
      pause.disabled = terminal();
    }
    if (paused) announce("training paused");
    else if (game.phase === "won") announce("power over 9000. seven dragon balls collected. wish granted — train again?");
    else if (game.phase === "lost") announce("training complete. try again to collect all seven dragon balls.");
    else if (game.phase === "ready") announce(`move your paddle, then tap or press space to release ki. ${game.lives} ${game.lives === 1 ? "life" : "lives"} remaining.`);
    else if (game.collected.length !== lastCollected) announce(`${game.collected.length} of seven dragon balls collected.`);
    else if (game.phase !== previousPhase || lastAnnouncement === "training paused") announce("ki released. clear the shields to collect all seven dragon balls.");
    previousPhase = game.phase;
    lastCollected = game.collected.length;
  }

  function orb(star, x, y, size, opacity = 1) {
    const image = sprites[star - 1];
    context.save();
    context.globalAlpha = opacity;
    if (image?.complete && image.naturalWidth) context.drawImage(image, x - size / 2, y - size / 2, size, size);
    else {
      const gradient = context.createRadialGradient(x - size * .14, y - size * .18, 1, x, y, size / 2);
      gradient.addColorStop(0, "#ffe987");
      gradient.addColorStop(.6, palette.orange);
      gradient.addColorStop(1, "#d76019");
      context.fillStyle = gradient;
      context.beginPath(); context.arc(x, y, size / 2, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#b33d21";
      context.font = "9px monospace"; context.textAlign = "center";
      context.fillText("★".repeat(star), x, y + 3, size * .8);
    }
    context.restore();
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function draw() {
    if (!dialog.open || !palette) return;
    const { width, height, paddle, ball } = game;
    context.clearRect(0, 0, width, height);
    context.fillStyle = palette.paper; context.fillRect(0, 0, width, height);
    context.strokeStyle = palette.line; context.lineWidth = 1;
    context.beginPath(); context.moveTo(12.5, 38.5); context.lineTo(width - 12.5, 38.5); context.stroke();
    for (let star = 1; star <= 7; star++) orb(star, width / 2 + (star - 4) * 28, 20, 20, game.collected.includes(star) ? 1 : .18);

    for (const brick of game.bricks) {
      if (!brick.active) continue;
      const intensity = brick.health / brick.maxHealth;
      context.save();
      context.globalAlpha = .5 + intensity * .5;
      context.fillStyle = palette.panel; context.strokeStyle = palette.blue;
      roundRect(brick.x, brick.y, brick.width, brick.height, 4); context.fill(); context.stroke();
      context.globalAlpha = .35 + intensity * .45;
      context.fillStyle = palette.blue;
      context.fillRect(brick.x + 5, brick.y + brick.height - 4, (brick.width - 10) * intensity, 1);
      context.restore();
      orb(brick.star, brick.x + brick.width / 2, brick.y + brick.height / 2 - 1, 15);
    }

    if (decorative()) {
      trail.forEach((point, index) => {
        context.globalAlpha = (index + 1) / trail.length * .22;
        context.fillStyle = palette.blue;
        context.beginPath(); context.arc(point.x, point.y, ball.radius * .7, 0, Math.PI * 2); context.fill();
      });
      context.globalAlpha = 1;
      for (const spark of sparks) {
        context.globalAlpha = Math.max(0, spark.life / .4);
        context.fillStyle = spark.orange ? palette.orange : palette.blue;
        context.fillRect(spark.x, spark.y, 2, 2);
      }
      context.globalAlpha = 1;
    }

    context.save();
    if (decorative() && game.phase === "playing") { context.shadowColor = palette.blue; context.shadowBlur = 14; }
    context.fillStyle = palette.blue;
    roundRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height, paddle.height / 2); context.fill();
    context.restore();
    context.fillStyle = palette.ink;
    context.fillRect(paddle.x - paddle.width / 2 + 9, paddle.y + 2, paddle.width - 18, 1);

    if (!terminal()) {
      context.save();
      if (decorative()) { context.shadowColor = palette.orange; context.shadowBlur = 12; }
      context.fillStyle = palette.orange;
      context.beginPath(); context.arc(ball.x, ball.y, ball.radius + 1, 0, Math.PI * 2); context.fill();
      context.fillStyle = palette.white;
      context.beginPath(); context.arc(ball.x - 1, ball.y - 1, ball.radius * .45, 0, Math.PI * 2); context.fill();
      context.restore();
    }

    context.font = '11px "Plex Mono", monospace'; context.textAlign = "center";
    context.fillStyle = palette.muted;
    context.fillText("hyperbolic time chamber", width / 2, height - 12);
    if (paused || game.phase !== "playing") {
      const title = paused ? "time stands still" : game.phase === "won" ? "wish granted" : game.phase === "lost" ? "another round?" : "gather the seven";
      const subtitle = paused ? "resume when you’re ready" : game.phase === "won" ? "seven stars. one little secret." : game.phase === "lost" ? "even saiyans need practice" : "tap / space to release ki";
      context.fillStyle = palette.paper;
      context.globalAlpha = .92;
      context.fillRect(34, height * .49 - 33, width - 68, 72);
      context.globalAlpha = 1;
      context.fillStyle = palette.orange; context.font = '16px "Plex Mono", monospace';
      context.fillText(title, width / 2, height * .49);
      context.fillStyle = palette.muted; context.font = '10px "Plex Mono", monospace';
      context.fillText(subtitle, width / 2, height * .49 + 23);
    }
  }

  function resize() {
    if (!dialog.open) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.setTransform(canvas.width / game.width, 0, 0, canvas.height / game.height, 0, 0);
    draw();
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
  }

  function schedule() {
    if (!frame && active() && (game.phase === "playing" || (!terminal() && direction()))) frame = requestAnimationFrame(tick);
  }

  function tick(time) {
    frame = 0;
    if (!active()) { lastTime = null; return; }
    const seconds = lastTime === null ? 0 : Math.min(.032, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    if (!terminal() && direction()) engine.movePaddle(game, game.paddle.x + direction() * 330 * seconds);
    if (game.phase === "playing") {
      engine.step(game, seconds);
      if (decorative()) {
        trail.push({ x: game.ball.x, y: game.ball.y });
        if (trail.length > 9) trail.shift();
        for (const brick of game.bricks) {
          if ((previousHealth.get(brick.id) ?? brick.health) > brick.health) {
            for (let index = 0; index < 5; index++) sparks.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, vx: (index - 2) * 35, vy: -45 + index * 16, life: .4, orange: !brick.active });
          }
          previousHealth.set(brick.id, brick.health);
        }
        sparks = sparks.filter((spark) => { spark.life -= seconds; spark.x += spark.vx * seconds; spark.y += spark.vy * seconds; return spark.life > 0; });
      } else { trail = []; sparks = []; }
    }
    updateUI();
    draw();
    schedule();
    if (!frame) lastTime = null;
  }

  function reset() {
    stop();
    engine.reset(game);
    previousHealth = new Map(game.bricks.map((brick) => [brick.id, brick.health]));
    previousPhase = game.phase;
    lastCollected = 0;
    keys.clear(); trail = []; sparks = []; paused = false;
  }

  function release() {
    if (!dialog.open || document.hidden) return;
    if (terminal()) reset();
    if (game.phase !== "ready") return;
    paused = false;
    engine.launch(game);
    updateUI(); draw(); schedule();
  }

  function setPaused(next) {
    paused = next;
    keys.clear();
    stop();
    updateUI(); draw();
    if (!paused) schedule();
  }

  function releasePointer() {
    if (pointer && canvas.hasPointerCapture?.(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null;
  }

  function close() { if (dialog.open) dialog.close(); }

  function cleanup() {
    stop(); keys.clear(); releasePointer(); trail = []; sparks = [];
    opener?.focus?.({ preventScroll: true });
    opener = null;
    delete root.dataset.training;
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: false } }));
  }

  function open(trigger = document.activeElement) {
    if (dialog.open) { canvas.focus({ preventScroll: true }); return; }
    opener = trigger instanceof HTMLElement ? trigger : document.activeElement;
    reset(); colors();
    root.dataset.training = "open";
    dialog.showModal();
    loadSprites();
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: true } }));
    resize(); updateUI(); canvas.focus({ preventScroll: true });
  }

  function move(event) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || paused || terminal()) return;
    engine.movePaddle(game, (event.clientX - bounds.left) / bounds.width * game.width);
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!dialog.open || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
    move(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointer?.id !== event.pointerId) return;
    event.preventDefault();
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
    move(event);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (pointer?.id !== event.pointerId) return;
    event.preventDefault();
    const tapped = !pointer.moved;
    releasePointer();
    if (tapped && game.phase === "ready") release();
  });
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", () => { pointer = null; });

  // Capture only the game's keys while its modal is open, so the portfolio wheel stays put.
  document.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "Escape") { event.stopImmediatePropagation(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (!["ArrowLeft", "ArrowRight", "a", "d", " ", "p"].includes(key)) return;
    if (key === " " && event.target instanceof Element && event.target.closest("button")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (key === " ") { if (!event.repeat) release(); return; }
    if (key === "p") { if (!event.repeat && !terminal()) setPaused(!paused); return; }
    if (paused || terminal()) return;
    keys.add(key);
    if (!event.repeat) engine.movePaddle(game, game.paddle.x + direction() * 12);
    draw(); schedule();
  }, true);
  document.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!dialog.open || !keys.has(key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); keys.delete(key);
    if (game.phase !== "playing") stop();
  }, true);
  action?.addEventListener("click", () => { release(); canvas.focus({ preventScroll: true }); });
  pause?.addEventListener("click", () => setPaused(!paused));
  dialog.querySelectorAll("[data-training-close]").forEach((button) => button.addEventListener("click", close));
  document.querySelectorAll("[data-training-open]").forEach((button) => button.addEventListener("click", () => open(button)));
  dialog.addEventListener("cancel", (event) => { event.stopPropagation(); });
  dialog.addEventListener("close", cleanup);
  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => { if (dialog.open) setPaused(true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && dialog.open) setPaused(true); });
  window.addEventListener("pagehide", () => { if (dialog.open) setPaused(true); stop(); keys.clear(); releasePointer(); });
  window.addEventListener("portfolio:view", () => { if (dialog.open) close(); });
  window.addEventListener("portfolio:preferences", () => { colors(); if (!decorative()) { trail = []; sparks = []; } draw(); });
  reducedMotion.addEventListener("change", () => { trail = []; sparks = []; draw(); });
  new ResizeObserver(resize).observe(canvas);
  window.PortfolioTraining = Object.freeze({ open, close });
})();
