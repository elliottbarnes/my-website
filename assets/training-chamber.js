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
  let arena = null;
  let opener = null;
  let paused = false;
  let frame = 0;
  let lastTime = null;
  let accumulator = 0;
  const fixedStep = 1 / 120;
  let layoutBounds;
  let pointer = null;
  let trail = [];
  let sparks = [];
  let rings = [];
  let collections = [];
  let catchLight = 0;
  let previousCollections = new Set();
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
    arena = new Image();
    arena.decoding = "async";
    arena.onload = () => { if (dialog.open) draw(); };
    arena.src = "/assets/training-arena.webp";
    const orbPaths = ["/assets/dragon-ball-1.webp", "/assets/dragon-ball-2.webp", "/assets/dragon-ball-3.webp", "/assets/dragon-ball-4.webp", "/assets/dragon-ball-5.webp", "/assets/dragon-ball-6.webp", "/assets/dragon-ball-7.webp"];
    for (let star = 1; star <= 7; star++) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { if (dialog.open) draw(); };
      sprites.push(image);
      image.src = orbPaths[star - 1];
    }
  }

  function colors() {
    // The arena keeps its own dark art direction in every outer-site theme.
    // Essential targets stay legible even when the scenery cannot be loaded.
    palette = {
      paper: "#070f20", ink: "#edf8ff", muted: "#9cb5ce", line: "#274766",
      panel: "#102d45", blue: "#6ddcff", orange: "#ffad48", white: "#fff6da",
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
      action.disabled = paused || game.phase === "playing";
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
    else if (game.phase === "ready") announce(`${game.lives < 3 ? "ki lost. " : ""}${game.lives} ${game.lives === 1 ? "life" : "lives"} remaining. drag anywhere to aim, then tap or press space to release ki.`);
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

  function shieldPath(x, y, width, height, cut = 3) {
    context.beginPath();
    context.moveTo(x + cut, y); context.lineTo(x + width - cut, y);
    context.lineTo(x + width, y + cut); context.lineTo(x + width, y + height - cut);
    context.lineTo(x + width - cut, y + height); context.lineTo(x + cut, y + height);
    context.lineTo(x, y + height - cut); context.lineTo(x, y + cut); context.closePath();
  }

  function drawArena(width, height) {
    context.fillStyle = palette.paper; context.fillRect(0, 0, width, height);
    if (arena?.complete && arena.naturalWidth && arena.naturalHeight) {
      const scale = Math.max(width / arena.naturalWidth, height / arena.naturalHeight);
      const imageWidth = arena.naturalWidth * scale, imageHeight = arena.naturalHeight * scale;
      context.drawImage(arena, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    }
    // The illustrated middle stays open; quiet backing protects the targets,
    // collection rail and paddle from competing detail in the artwork.
    const shade = context.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, "rgba(4, 12, 27, .94)");
    shade.addColorStop(.29, "rgba(4, 12, 27, .68)");
    shade.addColorStop(.45, "rgba(4, 12, 27, .18)");
    shade.addColorStop(.75, "rgba(4, 12, 27, .26)");
    shade.addColorStop(1, "rgba(4, 12, 27, .84)");
    context.fillStyle = shade; context.fillRect(0, 0, width, height);
    context.save();
    context.strokeStyle = palette.blue; context.fillStyle = palette.blue; context.lineWidth = 1; context.globalAlpha = .2;
    context.beginPath();
    context.moveTo(12.5, 49); context.lineTo(12.5, height - 33); context.lineTo(25, height - 21);
    context.moveTo(width - 12.5, 49); context.lineTo(width - 12.5, height - 33); context.lineTo(width - 25, height - 21);
    context.moveTo(28, 39.5); context.lineTo(width - 28, 39.5);
    context.stroke();
    for (let y = 164; y < height - 48; y += 24) {
      context.fillRect(12, y, 3, 1); context.fillRect(width - 15, y, 3, 1);
    }
    context.restore();
  }

  function drawShield(brick) {
    const { x, y, width, height } = brick;
    const armored = brick.maxHealth > 1;
    const damaged = brick.health < brick.maxHealth;
    const edge = damaged ? "#ffc27a" : armored ? "#acbaff" : "#72e9ff";
    context.save();
    // A beveled housing surrounds the orb. Armour is visible as solid end caps,
    // not just a colour difference; broken caps remain split after a hit.
    const metal = context.createLinearGradient(0, y, 0, y + height);
    metal.addColorStop(0, damaged ? "#82502d" : armored ? "#596aab" : "#347d92");
    metal.addColorStop(.3, damaged ? "#402c29" : armored ? "#26395f" : "#163b50");
    metal.addColorStop(.65, "#0b172c");
    metal.addColorStop(1, "#1e3047");
    context.fillStyle = metal;
    shieldPath(x, y, width, height, 4); context.fill();
    context.strokeStyle = edge; context.lineWidth = 1;
    context.stroke();
    context.strokeStyle = "rgba(235, 247, 255, .65)";
    context.beginPath(); context.moveTo(x + 4, y + 1.5); context.lineTo(x + width - 4, y + 1.5); context.stroke();
    context.strokeStyle = "#030a16"; context.lineWidth = 2;
    context.beginPath(); context.moveTo(x + 4, y + height - 1.5); context.lineTo(x + width - 4, y + height - 1.5); context.stroke();

    for (const side of [-1, 1]) {
      const end = side < 0 ? x + 3 : x + width - 9;
      context.fillStyle = armored ? (damaged ? "#694735" : "#6379ab") : "#287186";
      shieldPath(end, y + 3, 6, height - 6, 2); context.fill();
      context.fillStyle = edge;
      context.fillRect(end + (side < 0 ? 1 : 4), y + 5, 1, height - 10);
      if (damaged) {
        context.strokeStyle = "#080e19"; context.lineWidth = 2;
        context.beginPath(); context.moveTo(end, y + 8); context.lineTo(end + 3, y + 10); context.lineTo(end + 6, y + 7); context.stroke();
      }
    }
    // A dark socket and a thin energy ring make the warm core read at phone size.
    const coreX = x + width / 2, coreY = y + height / 2 - 2;
    context.fillStyle = "#070d1b";
    context.beginPath(); context.arc(coreX, coreY, 6.6, 0, Math.PI * 2); context.fill();
    context.strokeStyle = edge; context.lineWidth = .8;
    context.beginPath(); context.arc(coreX, coreY, 6.6, -.8, Math.PI - .8); context.stroke();
    context.beginPath(); context.arc(coreX, coreY, 6.6, Math.PI - .6, Math.PI * 2 - 1); context.stroke();
    // Countable pips and persistent cracks carry damage without animation or
    // colour discrimination. The remaining hit count is never decorative-only.
    const segmentWidth = 8, gap = 3, total = brick.maxHealth * segmentWidth + (brick.maxHealth - 1) * gap;
    for (let segment = 0; segment < brick.maxHealth; segment++) {
      const left = x + (width - total) / 2 + segment * (segmentWidth + gap);
      context.fillStyle = edge; context.strokeStyle = edge;
      context.globalAlpha = segment < brick.health ? 1 : .5;
      if (segment < brick.health) context.fillRect(left, y + height - 4, segmentWidth, 2);
      else context.strokeRect(left, y + height - 4, segmentWidth, 2);
    }
    context.globalAlpha = 1;
    if (damaged) {
      context.strokeStyle = "#ffdfae"; context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + width - 11, y + 1); context.lineTo(x + width - 15, y + 5);
      context.lineTo(x + width - 10, y + 8); context.lineTo(x + width - 14, y + 12);
      context.moveTo(x + 10, y + 4); context.lineTo(x + 13, y + 8); context.lineTo(x + 9, y + 11);
      context.stroke();
    }
    // Rings are cleared when motion is disabled, so old hits cannot light up
    // again merely because the visitor re-enables decorative movement.
    if (decorative() && rings.length && game.lastHit?.id === brick.id) {
      const age = game.time - game.lastHit.time;
      if (age >= 0 && age < .22) {
        context.globalAlpha = (1 - age / .22) * .85;
        context.strokeStyle = palette.white; context.lineWidth = 1.5;
        shieldPath(x + 1, y + 1, width - 2, height - 2, 3); context.stroke();
      }
    }
    context.restore();
    orb(brick.star, coreX, coreY, 11);
  }

  function drawEffects(ball) {
    if (!decorative()) return;
    context.save();
    context.lineCap = "round";
    for (let index = 1; index < trail.length; index++) {
      const point = trail[index], previous = trail[index - 1];
      const strength = index / trail.length;
      context.globalAlpha = Math.min(1, point.life / .14) * strength * .65;
      context.strokeStyle = palette.orange; context.lineWidth = ball.radius * (1.8 * strength + .2);
      context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(point.x, point.y); context.stroke();
      context.globalAlpha *= .8; context.strokeStyle = palette.white; context.lineWidth = Math.max(.7, strength * 2.5);
      context.stroke();
    }
    for (const ring of rings) {
      const progress = 1 - ring.life / ring.duration;
      context.globalAlpha = (1 - progress) * .8;
      context.strokeStyle = ring.orange ? palette.orange : palette.blue;
      context.lineWidth = 1.5 - progress;
      context.beginPath(); context.arc(ring.x, ring.y, 4 + progress * ring.radius, 0, Math.PI * 2); context.stroke();
    }
    for (const spark of sparks) {
      context.globalAlpha = Math.max(0, spark.life / spark.duration);
      context.fillStyle = spark.orange ? palette.orange : palette.blue;
      const length = 2 + spark.life / spark.duration * 4;
      context.beginPath();
      context.moveTo(spark.x + spark.dx * length, spark.y + spark.dy * length);
      context.lineTo(spark.x - spark.dy * 1.3, spark.y + spark.dx * 1.3);
      context.lineTo(spark.x - spark.dx * length, spark.y - spark.dy * length);
      context.lineTo(spark.x + spark.dy * 1.3, spark.y - spark.dx * 1.3);
      context.closePath(); context.fill();
    }
    context.restore();
  }

  function draw() {
    if (!dialog.open || !palette) return;
    const { width, height, paddle, ball } = game;
    context.clearRect(0, 0, width, height);
    drawArena(width, height);
    const orbPaths = ["/assets/dragon-ball-1.webp", "/assets/dragon-ball-2.webp", "/assets/dragon-ball-3.webp", "/assets/dragon-ball-4.webp", "/assets/dragon-ball-5.webp", "/assets/dragon-ball-6.webp", "/assets/dragon-ball-7.webp"];
    for (let star = 1; star <= 7; star++) {
      const x = width / 2 + (star - 4) * 28, collected = game.collected.includes(star);
      context.save();
      context.strokeStyle = collected ? palette.orange : palette.line;
      context.lineWidth = collected ? 1 : .7;
      context.beginPath(); context.arc(x, 20, 11.5, 0, Math.PI * 2); context.stroke();
      context.restore();
      orb(star, x, 20, 20, collected ? 1 : .22);
    }
    for (const brick of game.bricks) if (brick.active) drawShield(brick);
    drawEffects(ball);

    context.save();
    const left = paddle.x - paddle.width / 2;
    // The catch platform has a static halo too; reduced motion retains the
    // same aiming silhouette, bright front edge, and clear collision surface.
    context.fillStyle = "rgba(109, 220, 255, .09)";
    roundRect(left - 6, paddle.y - 4, paddle.width + 12, paddle.height + 10, 8); context.fill();
    context.fillStyle = palette.panel; context.strokeStyle = palette.blue; context.lineWidth = 1;
    shieldPath(left, paddle.y, paddle.width, paddle.height, 4); context.fill(); context.stroke();
    context.fillStyle = palette.blue; context.fillRect(left + 5, paddle.y, paddle.width - 10, 2);
    context.fillStyle = palette.ink; context.fillRect(left + 11, paddle.y + 1, paddle.width - 22, 1);
    context.globalAlpha = .6;
    context.fillRect(left + 5, paddle.y + 5, 7, 1); context.fillRect(left + paddle.width - 12, paddle.y + 5, 7, 1);
    if (decorative() && catchLight > 0) {
      const progress = 1 - catchLight / .3;
      context.globalAlpha = (1 - progress) * .65; context.strokeStyle = palette.blue;
      context.lineWidth = 2 - progress;
      roundRect(left - 3 - progress * 11, paddle.y - 3 - progress * 5, paddle.width + 6 + progress * 22, paddle.height + 6 + progress * 10, 8);
      context.stroke();
    }
    context.restore();

    if (!terminal()) {
      context.save();
      context.fillStyle = "rgba(255, 173, 72, .15)";
      context.beginPath(); context.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2); context.fill();
      context.shadowColor = palette.orange; context.shadowBlur = decorative() ? 16 : 0;
      context.fillStyle = palette.orange;
      context.beginPath(); context.arc(ball.x, ball.y, ball.radius + 1, 0, Math.PI * 2); context.fill();
      context.shadowBlur = 0; context.fillStyle = palette.white;
      context.beginPath(); context.arc(ball.x - .6, ball.y - .6, ball.radius * .68, 0, Math.PI * 2); context.fill();
      context.restore();
    }
    if (decorative()) for (const flight of collections) {
      const progress = 1 - flight.life / flight.duration, eased = 1 - (1 - progress) ** 3;
      const targetX = width / 2 + (flight.star - 4) * 28;
      const x = flight.x + (targetX - flight.x) * eased;
      const y = flight.y + (20 - flight.y) * eased - Math.sin(progress * Math.PI) * 25;
      context.save(); context.shadowColor = palette.orange; context.shadowBlur = 12;
      orb(flight.star, x, y, 14 + progress * 6, Math.min(1, flight.life * 8));
      context.restore();
    }

    context.font = '11px "Plex Mono", monospace'; context.textAlign = "center";
    context.fillStyle = palette.muted;
    context.fillText("drag anywhere to guide", width / 2, height - 12);
    if (paused || game.phase !== "playing") {
      const title = paused ? "time stands still" : game.phase === "won" ? "wish granted" : game.phase === "lost" ? "another round?" : game.lives < 3 ? "ki scattered" : "gather the seven";
      const subtitle = paused ? "resume when you’re ready" : game.phase === "won" ? "seven stars. one little secret." : game.phase === "lost" ? "even saiyans need practice" : game.lives < 3 ? `${game.lives} ${game.lives === 1 ? "life" : "lives"} left · tap / space to release` : "tap / space to release ki";
      context.save();
      context.fillStyle = "rgba(7, 15, 32, .9)"; context.strokeStyle = palette.line;
      shieldPath(34, height * .49 - 33, width - 68, 72, 9); context.fill(); context.stroke();
      context.fillStyle = palette.orange; context.fillRect(width / 2 - 14, height * .49 - 20, 28, 2);
      context.fillStyle = palette.white; context.font = '16px "Plex Mono", monospace';
      context.fillText(title, width / 2, height * .49 + 1);
      context.fillStyle = palette.muted; context.font = '10px "Plex Mono", monospace';
      context.fillText(subtitle, width / 2, height * .49 + 23);
      context.restore();
    }
  }

  function resize() {
    if (!dialog.open) return;
    const bounds = canvas.getBoundingClientRect();
    if (pointer && layoutBounds && ["width", "height", "left", "top"].some(key => bounds[key] !== layoutBounds[key])) releasePointer();
    layoutBounds = { width: bounds.width, height: bounds.height, left: bounds.left, top: bounds.top };
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
    accumulator = 0;
  }

  function inputTime(event) {
    const now = performance.now(), timestamp = Number(event?.timeStamp);
    // DOM events normally share performance.now()'s time origin. Reject stale
    // or legacy epoch timestamps rather than importing another clock domain.
    return Number.isFinite(timestamp) && timestamp >= now - 1000 && timestamp <= now + 1 ? timestamp : now;
  }

  function schedule(time = performance.now()) {
    if (!frame && active() && (game.phase === "playing" || (!terminal() && direction()))) {
      if (lastTime === null) lastTime = time;
      frame = requestAnimationFrame(tick);
    }
  }

  function clearEffects() {
    trail = []; sparks = []; rings = []; collections = []; catchLight = 0;
  }

  function impact(brick) {
    const hit = game.lastHit?.id === brick.id ? game.lastHit : null;
    const x = hit?.x ?? brick.x + brick.width / 2, y = hit?.y ?? brick.y + brick.height / 2;
    const orange = !brick.active;
    rings.push({ x, y, life: .34, duration: .34, radius: orange ? 24 : 17, orange });
    if (rings.length > 16) rings.splice(0, rings.length - 16);
    for (let index = 0; index < (orange ? 10 : 6); index++) {
      const angle = index * Math.PI * 2 / (orange ? 10 : 6) + brick.id * .73;
      const dx = Math.cos(angle), dy = Math.sin(angle), speed = 35 + index % 3 * 21;
      sparks.push({ x, y, dx, dy, vx: dx * speed, vy: dy * speed, life: .42, duration: .42, orange });
    }
    if (sparks.length > 96) sparks.splice(0, sparks.length - 96);
  }

  function advanceClock(time) {
    if (!active()) return;
    // Consume elapsed foreground time in fixed steps. A bounded catch-up budget
    // covers ordinary frame stalls without a runaway loop after a long suspension.
    const seconds = lastTime === null ? 0 : Math.min(.25, Math.max(0, (time - lastTime) / 1000));
    // An already queued rAF may be older than a just-flushed input event.
    // Never rewind the clock or count that interval twice.
    lastTime = Math.max(lastTime ?? time, time);
    const phaseBefore = game.phase;
    accumulator += seconds;
    while (accumulator + 1e-10 >= fixedStep) {
      if (!terminal() && direction()) engine.movePaddle(game, game.paddle.x + direction() * 330 * fixedStep);
      if (game.phase === "playing") {
        const descending = game.ball.vy > 0;
        engine.step(game, fixedStep);
        if (decorative() && descending && game.ball.vy < 0 && game.ball.y > game.paddle.y - 20) catchLight = .3;
      }
      accumulator = Math.max(0, accumulator - fixedStep);
    }
    if (game.phase !== phaseBefore) clearEffects();
    if (game.phase === "playing") {
      if (decorative()) {
        trail = trail.filter(point => { point.life -= seconds; return point.life > 0; });
        if (seconds > 0) trail.push({ x: game.ball.x, y: game.ball.y, life: .14 });
        if (trail.length > 18) trail.splice(0, trail.length - 18);
        sparks = sparks.filter(spark => {
          spark.life -= seconds; spark.x += spark.vx * seconds; spark.y += spark.vy * seconds;
          spark.vy += 35 * seconds;
          return spark.life > 0;
        });
        rings = rings.filter(ring => { ring.life -= seconds; return ring.life > 0; });
        collections = collections.filter(flight => { flight.life -= seconds; return flight.life > 0; });
        catchLight = Math.max(0, catchLight - seconds);
        for (const brick of game.bricks) {
          if ((previousHealth.get(brick.id) ?? brick.health) > brick.health) impact(brick);
        }
        for (const star of game.collected) {
          if (previousCollections.has(star)) continue;
          const source = game.bricks.find(brick => brick.star === star && (previousHealth.get(brick.id) ?? brick.health) > brick.health);
          collections.push({ star, x: source ? source.x + source.width / 2 : game.width / 2,
            y: source ? source.y + source.height / 2 : 100, life: .7, duration: .7 });
        }
        if (collections.length > 7) collections.splice(0, collections.length - 7);
      } else clearEffects();
    }
    // Hits and collections hidden by reduced motion must never replay later.
    for (const brick of game.bricks) previousHealth.set(brick.id, brick.health);
    previousCollections = new Set(game.collected);
    updateUI();
  }

  function flushInput(event) {
    if (lastTime !== null && active()) advanceClock(inputTime(event));
  }

  function tick(time) {
    frame = 0;
    if (!active()) { lastTime = null; return; }
    advanceClock(time);
    draw();
    schedule();
    if (!frame) { lastTime = null; accumulator = 0; }
  }

  function reset() {
    stop();
    releasePointer();
    engine.reset(game);
    previousHealth = new Map(game.bricks.map((brick) => [brick.id, brick.health]));
    previousPhase = game.phase;
    lastCollected = 0;
    previousCollections = new Set();
    keys.clear(); clearEffects(); paused = false;
  }

  function release(event) {
    if (!dialog.open || document.hidden || paused) return;
    const wasPlaying = game.phase === "playing";
    flushInput(event);
    // An input arriving at the end of a flight must leave the new result or
    // ready serve visible; starting another round needs a fresh action.
    if (wasPlaying) { draw(); return; }
    if (terminal()) reset();
    if (game.phase !== "ready") return;
    paused = false;
    engine.launch(game);
    updateUI(); draw(); schedule(inputTime(event));
  }

  function setPaused(next, event) {
    // Completed rounds retain their result when the visitor changes tabs.
    if (terminal()) return;
    if (next) flushInput(event);
    if (terminal()) { keys.clear(); releasePointer(); stop(); draw(); return; }
    paused = next;
    keys.clear();
    releasePointer();
    stop();
    updateUI(); draw();
    if (!paused) schedule(inputTime(event));
  }

  function releasePointer() {
    if (pointer && canvas.hasPointerCapture?.(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null;
  }

  function close() { if (dialog.open) dialog.close(); }

  function cleanup() {
    stop(); keys.clear(); releasePointer(); clearEffects();
    if (dialog.open) return;
    const arcadeOpen = ["arcade-dialog", "blocks-dialog", "platformer-dialog", "goku-dialog", "game-loading-dialog"].some(id => document.getElementById(id)?.open);
    if (!arcadeOpen) opener?.focus?.({ preventScroll: true });
    opener = null;
    if (!arcadeOpen) delete root.dataset.training;
    window.dispatchEvent(new CustomEvent("portfolio:training", { detail: { open: arcadeOpen } }));
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
    if (!pointer || !bounds.width || paused || terminal()) return;
    flushInput(event);
    if (terminal()) return;
    const delta = (event.clientX - pointer.lastX) / bounds.width * game.width;
    // Incremental drag preserves the grab point and reverses immediately at an
    // edge. The finger can stay clear of the paddle and incoming ball.
    pointer.lastX = event.clientX;
    engine.movePaddle(game, game.paddle.x + delta);
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!dialog.open || !event.isPrimary || event.button !== 0 || pointer || paused || terminal()) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, moved: false, ready: game.phase === "ready" };
    canvas.setPointerCapture(event.pointerId);
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
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
    // The release can contain a final position with no delivered pointermove.
    move(event);
    const tapped = !pointer.moved && pointer.ready;
    releasePointer();
    if (tapped && game.phase === "ready") release(event);
  });
  canvas.addEventListener("pointercancel", event => { if (pointer?.id === event.pointerId) releasePointer(); });
  canvas.addEventListener("lostpointercapture", event => { if (pointer?.id === event.pointerId) pointer = null; });

  // Capture only the game's keys while its modal is open, so the portfolio wheel stays put.
  document.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "Escape") { event.stopImmediatePropagation(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (!["ArrowLeft", "ArrowRight", "a", "d", " ", "p"].includes(key)) return;
    if (key === " " && event.target instanceof Element && event.target.closest("button")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (key === " ") { if (!event.repeat) release(event); return; }
    if (key === "p") { if (!event.repeat && !terminal()) setPaused(!paused, event); return; }
    if (paused || terminal()) return;
    flushInput(event);
    if (terminal()) return;
    keys.add(key);
    if (!event.repeat) engine.movePaddle(game, game.paddle.x + direction() * 12);
    draw(); schedule(inputTime(event));
  }, true);
  document.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!dialog.open || !keys.has(key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    flushInput(event);
    keys.delete(key);
    draw();
    if (game.phase !== "playing") { stop(); schedule(inputTime(event)); }
  }, true);
  action?.addEventListener("click", event => { release(event); canvas.focus({ preventScroll: true }); });
  pause?.addEventListener("click", event => setPaused(!paused, event));
  dialog.querySelectorAll("[data-training-close]").forEach((button) => button.addEventListener("click", close));
  if (!window.PortfolioGames) document.querySelectorAll("[data-training-open]").forEach((button) => button.addEventListener("click", () => open(button)));
  dialog.addEventListener("cancel", (event) => { event.stopPropagation(); if (window.PortfolioGames) { event.preventDefault(); window.PortfolioGames.run("choose", opener); } });
  dialog.addEventListener("close", cleanup);
  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => { if (dialog.open) setPaused(true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && dialog.open) setPaused(true); });
  window.addEventListener("pagehide", () => { if (dialog.open) setPaused(true); stop(); keys.clear(); releasePointer(); });
  window.addEventListener("portfolio:view", () => { if (dialog.open) close(); });
  window.addEventListener("portfolio:preferences", () => { colors(); if (!decorative()) clearEffects(); draw(); });
  reducedMotion.addEventListener("change", () => { clearEffects(); draw(); });
  new ResizeObserver(resize).observe(canvas);
  window.PortfolioTraining = Object.freeze({ open, close });
})();
