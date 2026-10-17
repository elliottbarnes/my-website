/* Goku / Cloud Trail. Original pixel scenery; fixed-step, local-only platform physics. */
(() => {
  'use strict';
  const WIDTH = 3400, HEIGHT = 360, GROUND = 306;
  const solids = [
    [0, GROUND, 650, 70], [740, GROUND, 540, 70], [1380, GROUND, 740, 70], [2230, GROUND, 520, 70], [2850, GROUND, 550, 70],
    [250, 238, 94, 14], [420, 202, 86, 14], [680, 238, 80, 14], [900, 238, 100, 14],
    [1170, 226, 70, 14], [1320, 230, 70, 14], [1510, 242, 100, 14], [1740, 218, 90, 14],
    [1940, 242, 100, 14], [2160, 238, 90, 14], [2400, 230, 100, 14], [2630, 242, 100, 14], [2800, 230, 90, 14], [3000, 240, 120, 14],
  ].map(([x, y, w, h]) => Object.freeze({ x, y, w, h }));
  const orbLocations = [[300, 216], [815, 280], [1205, 204], [1650, 280], [1990, 220], [2540, 280], [3060, 218]];
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function create() {
    return { width: WIDTH, height: HEIGHT, phase: 'ready', time: 0, lives: 3, score: 0, checkpoint: 80, event: 'ready', eventId: 0,
      player: { x: 80, y: GROUND - 31, w: 20, h: 31, vx: 0, vy: 0, grounded: true, facing: 1, coyote: .1, buffer: 0, jumpHeld: false, immune: 0 },
      orbs: orbLocations.map(([x, y], i) => ({ x, y, w: 16, h: 16, collected: false, star: i + 1 })),
      enemies: [[450, 360, 585], [1040, 960, 1130], [1810, 1680, 1910], [2310, 2260, 2490], [3150, 3100, 3260]].map(([x, left, right], i) => ({ x, y: GROUND - 20, w: 24, h: 20, left, right, vx: i % 2 ? -47 : 47, alive: true })),
    };
  }
  function event(game, name) { game.event = name; game.eventId++; }
  function start(game) { if (game.phase === 'ready') { game.phase = 'playing'; event(game, 'start'); } }
  function hurt(game) {
    if (game.player.immune > 0 || game.phase !== 'playing') return;
    game.lives--; event(game, game.lives ? 'respawn' : 'lost');
    if (!game.lives) { game.phase = 'lost'; return; }
    Object.assign(game.player, { x: game.checkpoint, y: GROUND - 31, vx: 0, vy: 0, grounded: true, coyote: .1, buffer: 0, immune: 1.5 });
  }
  function step(game, input = {}, dt = 1 / 120) {
    if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
    dt = Math.min(dt, 1 / 30); game.time += dt;
    const p = game.player, direction = Math.max(-1, Math.min(1, Number(input.direction) || 0));
    p.immune = Math.max(0, p.immune - dt);
    p.coyote = p.grounded ? .1 : Math.max(0, p.coyote - dt);
    if (input.jump && !p.jumpHeld) p.buffer = .12; else p.buffer = Math.max(0, p.buffer - dt);
    if (!input.jump && p.jumpHeld && p.vy < -180) p.vy *= .55;
    p.jumpHeld = Boolean(input.jump);
    const desired = direction * 220, acceleration = p.grounded ? 1700 : 1100;
    p.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - p.vx));
    if (direction) p.facing = direction;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -550; p.grounded = false; p.coyote = 0; p.buffer = 0; }
    const oldX = p.x, oldY = p.y;
    p.x = Math.max(0, Math.min(WIDTH - p.w, p.x + p.vx * dt));
    for (const tile of solids) if (overlaps(p, tile)) {
      if (oldX + p.w <= tile.x + .1) p.x = tile.x - p.w;
      else if (oldX >= tile.x + tile.w - .1) p.x = tile.x + tile.w;
      p.vx = 0;
    }
    p.vy = Math.min(720, p.vy + 1450 * dt); p.y += p.vy * dt; p.grounded = false;
    for (const tile of solids) if (overlaps(p, tile)) {
      if (p.vy >= 0 && oldY + p.h <= tile.y + 1) { p.y = tile.y - p.h; p.vy = 0; p.grounded = true; }
      else if (p.vy < 0 && oldY >= tile.y + tile.h - 1) { p.y = tile.y + tile.h; p.vy = 0; }
    }
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.left) { enemy.x = enemy.left; enemy.vx = Math.abs(enemy.vx); }
      if (enemy.x > enemy.right) { enemy.x = enemy.right; enemy.vx = -Math.abs(enemy.vx); }
      if (!overlaps(p, enemy)) continue;
      if (p.vy > 0 && oldY + p.h <= enemy.y + 8) { enemy.alive = false; p.vy = -360; game.score += 100; event(game, 'stomp'); }
      else { hurt(game); break; }
    }
    if (p.y > HEIGHT + 70) { p.immune = 0; hurt(game); }
    if (game.phase !== 'playing') return game;
    for (const orb of game.orbs) if (!orb.collected && overlaps(p, orb)) { orb.collected = true; game.score += 250; event(game, 'orb'); }
    if (p.x >= 1540 && game.checkpoint < 1540) { game.checkpoint = 1605; event(game, 'checkpoint'); }
    if (p.x > 3280 && game.orbs.every(orb => orb.collected)) { game.phase = 'won'; game.score += game.lives * 500; event(game, 'won'); }
    else if (p.x > 3270 && game.orbs.some(orb => !orb.collected) && game.event !== 'missing') event(game, 'missing');
    return game;
  }
  const engine = Object.freeze({ WIDTH, HEIGHT, GROUND, solids, create, start, step, overlaps });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('platformer-dialog'); if (!dialog) return;
  dialog.innerHTML = `<div class="console-heading"><div><span class="console-eyebrow">CARTRIDGE 02 / ADVENTURE</span><h2 id="platformer-title">goku<span>CLOUD TRAIL</span></h2></div><button type="button" data-platform-close aria-label="Close Goku platformer">esc</button></div>
    <div class="console-hud"><span>power <strong id="platform-score">0</strong></span><span>balls <strong id="platform-orbs">0 / 7</strong></span><span>lives <strong id="platform-lives">3</strong></span></div>
    <div class="platform-stage"><canvas id="platform-canvas" width="640" height="360" tabindex="0" aria-label="Goku Cloud Trail platform game" aria-describedby="platform-help platform-status">Run, jump, and collect seven Dragon Balls on the cloud trail. Use left and right arrows to move and Space to jump.</canvas></div>
    <p id="platform-status" role="status" aria-live="polite" aria-atomic="true">Collect seven Dragon Balls and reach the red gate. Start when you are ready.</p>
    <div class="platform-touch" aria-label="Touch controls"><div><button type="button" data-platform-hold="left" aria-label="Move left">◀</button><button type="button" data-platform-hold="right" aria-label="Move right">▶</button></div><button type="button" data-platform-hold="jump" aria-label="Jump">A <span>jump</span></button></div>
    <div class="console-actions"><button type="button" data-platform-back>← cartridges</button><button id="platform-action" type="button">start game ↵</button><button id="platform-pause" type="button" aria-pressed="false">pause</button></div>
    <details class="console-help"><summary>how to play / controls</summary><p id="platform-help">← → or A/D to run · Space, ↑ or W to jump · P to pause. Hold jump for height. Bounce on patrol bots. The halfway flag saves your checkpoint. Escape returns to cartridges.</p></details>`;
  const root = document.documentElement, canvas = dialog.querySelector('#platform-canvas'), context = canvas.getContext('2d');
  if (!context) return;
  const status = dialog.querySelector('#platform-status'), action = dialog.querySelector('#platform-action'), pause = dialog.querySelector('#platform-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let game = create(), opener, frame = 0, lastTime = null, accumulator = 0, paused = false, lastEvent = -1;
  const keys = new Set(), pointers = new Map();
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  const terminal = () => game.phase === 'won' || game.phase === 'lost';
  const held = key => keys.has(key) || [...pointers.values()].includes(key);
  const input = () => ({ direction: Number(held('right')) - Number(held('left')), jump: held('jump') });
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = null; accumulator = 0; }
  function releaseControls() { keys.clear(); pointers.clear(); dialog.querySelectorAll('[data-platform-hold]').forEach(button => button.removeAttribute('data-held')); }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  function announce() {
    const count = game.orbs.filter(orb => orb.collected).length;
    setText(dialog.querySelector('#platform-score'), String(game.score)); setText(dialog.querySelector('#platform-orbs'), `${count} / 7`); setText(dialog.querySelector('#platform-lives'), String(game.lives));
    setText(action, terminal() ? 'play again ↵' : game.phase === 'ready' ? 'start game ↵' : 'restart ↻');
    setText(pause, paused ? 'resume' : 'pause'); if (pause.getAttribute('aria-pressed') !== String(paused)) pause.setAttribute('aria-pressed', String(paused)); pause.disabled = game.phase === 'ready' || terminal();
    if (paused) status.textContent = 'Paused. Resume when you are ready.';
    else if (game.eventId !== lastEvent) {
      lastEvent = game.eventId;
      const messages = { ready: 'Collect seven Dragon Balls and reach the red gate. Start when you are ready.', start: 'Cloud Trail. Run, jump, and collect all seven Dragon Balls.', orb: `Dragon Ball ${count} of 7 collected.`, stomp: 'Bot bounced! +100 power.', respawn: `${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left. Back at your checkpoint; collected balls are safe.`, checkpoint: 'Halfway checkpoint reached. Your collected balls stay with you.', missing: `${7 - count} Dragon ${7 - count === 1 ? 'Ball remains' : 'Balls remain'}. Follow the trail back to find them.`, won: `Wish granted! All seven Dragon Balls collected. ${game.score} power.`, lost: `Great effort. ${count} of seven Dragon Balls, ${game.score} power. Play again to try a new run.` };
      status.textContent = messages[game.event] || messages.start;
    }
  }
  function rect(x, y, w, h, color) { context.fillStyle = color; context.fillRect(Math.round(x), Math.round(y), w, h); }
  function text(label, x, y, size = 12, color = '#fff5d2') { context.font = `bold ${size}px monospace`; context.textAlign = 'center'; context.fillStyle = color; context.fillText(label, x, y); }
  function cloud(x, y) { rect(x, y + 9, 62, 13, '#e3f7fc'); rect(x + 10, y, 21, 23, '#f4fcff'); rect(x + 29, y + 4, 23, 19, '#f4fcff'); }
  function playerSprite(p, camera) {
    const x = Math.round(p.x - camera), y = Math.round(p.y);
    if (p.immune > 0 && !quiet() && Math.floor(game.time * 10) % 2) return;
    context.save(); context.translate(x + 10, y); context.scale(p.facing || 1, 1);
    const walk = p.grounded && Math.abs(p.vx) > 10 && !quiet() ? Math.sin(game.time * 18) * 3 : 0;
    rect(-8, 1, 17, 8, '#182038'); rect(-9, -5, 5, 10, '#182038'); rect(-3, -8, 5, 11, '#182038'); rect(4, -4, 4, 9, '#182038');
    rect(-6, 7, 14, 9, '#ffd1a0'); rect(5, 9, 3, 3, '#182038'); rect(-7, 16, 16, 10, '#ff782b');
    rect(-6, 15, 7, 4, '#2b5dab'); rect(-7, 24, 16, 3, '#284c95');
    rect(-11, 17, 4, 9, '#ffd1a0'); rect(9, 17, 4, 8, '#ffd1a0'); rect(-11, 23, 4, 3, '#284c95'); rect(9, 22, 4, 3, '#284c95');
    rect(-6, 27, 6, Math.max(2, 4 + walk), '#ff782b'); rect(3, 27, 6, Math.max(2, 4 - walk), '#ff782b');
    rect(-8, 30 + walk, 8, 4, '#284c95'); rect(3, 30 - walk, 9, 4, '#284c95'); context.restore();
  }
  function draw() {
    const camera = Math.max(0, Math.min(WIDTH - 640, game.player.x - 210));
    context.imageSmoothingEnabled = false;
    rect(0, 0, 640, 360, '#83cbd8');
    // Static parallax layers. Reduced motion removes decorative bobbing and walking cycles.
    for (let i = -1; i < 9; i++) {
      const x = i * 160 - camera * .18;
      rect(x, 162, 114, 145, '#69b49d'); rect(x + 18, 135, 80, 171, '#69b49d'); rect(x + 36, 112, 44, 194, '#69b49d');
      const near = i * 190 - camera * .35; rect(near, 223, 134, 84, '#469a83'); rect(near + 24, 200, 88, 107, '#469a83');
    }
    for (let i = 0; i < 9; i++) cloud(i * 178 - camera * .28, 36 + i % 3 * 20);
    for (const tile of solids) {
      const x = tile.x - camera; if (x > 640 || x + tile.w < 0) continue;
      rect(x, tile.y, tile.w, tile.h, tile.y === GROUND ? '#b77d54' : '#b68b69'); rect(x, tile.y, tile.w, 6, '#e2ec9d'); rect(x, tile.y + 6, tile.w, 4, '#559b5c');
      for (let offset = 10; offset < tile.w; offset += 26) { rect(x + offset, tile.y + 18, 8, 5, '#936449'); if (tile.h > 20) rect(x + offset + 10, tile.y + 40, 6, 4, '#cc9465'); }
    }
    const cp = 1590 - camera; rect(cp, 238, 4, 68, '#f4e6bd'); rect(cp + 4, 239, 29, 17, game.checkpoint > 80 ? '#ffb44b' : '#5786bc');
    const gate = 3290 - camera; rect(gate - 19, 231, 8, 75, '#c34e40'); rect(gate + 30, 231, 8, 75, '#c34e40'); rect(gate - 28, 224, 76, 11, '#e56645'); rect(gate - 21, 241, 63, 6, '#9d3f38');
    for (const orb of game.orbs) if (!orb.collected) {
      const x = orb.x - camera, y = orb.y + (quiet() ? 0 : Math.sin(game.time * 3 + orb.star) * 2);
      rect(x + 3, y, 10, 16, '#f5a135'); rect(x, y + 3, 16, 10, '#f5a135'); rect(x + 3, y + 2, 8, 4, '#ffe27b'); rect(x + 6, y + 7, 4, 4, '#b7462e');
    }
    for (const enemy of game.enemies) if (enemy.alive) {
      const x = enemy.x - camera, y = enemy.y;
      rect(x + 3, y, 18, 17, '#725591'); rect(x, y + 5, 24, 12, '#725591'); rect(x + 4, y + 5, 16, 5, '#d5f4e2'); rect(x + 8, y + 6, 3, 3, '#243d51'); rect(x + 15, y + 6, 3, 3, '#243d51'); rect(x + 3, y + 17, 7, 3, '#3a3157'); rect(x + 15, y + 17, 7, 3, '#3a3157');
    }
    playerSprite(game.player, camera);
    // The ball rail is useful navigation even when balls are behind the camera.
    rect(10, 11, 116, 24, '#294d61');
    game.orbs.forEach((orb, i) => rect(18 + i * 15, 18, 9, 9, orb.collected ? '#ffc75d' : '#567783'));
    if (game.phase === 'ready' || terminal() || paused) {
      rect(86, 99, 468, 148, '#23394f'); rect(92, 105, 456, 136, '#304d60');
      text(paused ? 'PAUSED' : game.phase === 'won' ? 'WISH GRANTED!' : game.phase === 'lost' ? 'ANOTHER ADVENTURE?' : 'GOKU / CLOUD TRAIL', 320, 146, 23);
      text(paused ? 'Resume when you are ready.' : game.phase === 'won' ? `${game.score} POWER / ALL SEVEN FOUND` : game.phase === 'lost' ? 'Every great journey takes practice.' : 'Seven Dragon Balls. One little adventure.', 320, 179, 12);
      text(paused ? 'P or resume' : terminal() ? 'Press Enter or play again' : 'Press Space or start game', 320, 211, 12, '#ffca70');
    }
  }
  function schedule() { if (!frame && dialog.open && !document.hidden && !paused && game.phase === 'playing') frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0; if (!dialog.open || document.hidden || paused) { lastTime = null; return; }
    const elapsed = lastTime === null ? 0 : Math.min(.1, Math.max(0, (now - lastTime) / 1000)); lastTime = now; accumulator += elapsed;
    while (accumulator >= 1 / 120) { step(game, input(), 1 / 120); accumulator -= 1 / 120; }
    announce(); draw(); schedule();
  }
  function begin() {
    stop(); releaseControls(); if (game.phase !== 'ready') game = create(); paused = false; lastEvent = -1;
    start(game); announce(); draw(); schedule(); canvas.focus({ preventScroll: true });
  }
  function setPaused(next) {
    if (game.phase !== 'playing') return;
    paused = next; releaseControls(); stop(); lastEvent = -1; announce(); draw(); if (!paused) schedule();
  }
  const actionForKey = key => ({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump' }[key]);
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p') { event.preventDefault(); if (!event.repeat) setPaused(!paused); return; }
    if (key === 'Enter' && (terminal() || game.phase === 'ready') && event.target === canvas) { event.preventDefault(); begin(); return; }
    const control = actionForKey(key); if (!control || (key === ' ' && event.target.closest('button'))) return;
    event.preventDefault(); event.stopPropagation();
    if (control === 'jump' && game.phase === 'ready' && !event.repeat) begin();
    if (!paused && game.phase === 'playing') keys.add(control);
  });
  dialog.addEventListener('keyup', event => { if (event.key === ' ' && event.target.closest('button')) return; const control = actionForKey(event.key.length === 1 ? event.key.toLowerCase() : event.key); if (control) { event.preventDefault(); keys.delete(control); } });
  dialog.querySelectorAll('[data-platform-hold]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return; event.preventDefault();
      if (game.phase === 'ready') begin();
      if (paused || terminal()) return;
      pointers.set(event.pointerId, button.dataset.platformHold); button.setPointerCapture(event.pointerId); button.dataset.held = 'true';
    });
    const release = event => { pointers.delete(event.pointerId); button.removeAttribute('data-held'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    // Native button activation remains useful to switch users: a brief move/jump.
    button.addEventListener('click', event => { if (event.detail !== 0 || paused || terminal()) return; if (game.phase === 'ready') begin(); const key = button.dataset.platformHold; keys.add(key); setTimeout(() => keys.delete(key), key === 'jump' ? 220 : 160); });
  });
  action.addEventListener('click', begin); pause.addEventListener('click', () => setPaused(!paused));
  const back = () => window.PortfolioGames?.run('choose', opener);
  dialog.querySelector('[data-platform-back]').addEventListener('click', back);
  dialog.querySelector('[data-platform-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); back(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; stop(); releaseControls(); if (game.phase === 'playing') paused = true;
    const other = ['arcade-dialog', 'training-dialog', 'blocks-dialog', 'goku-dialog', 'game-loading-dialog'].some(id => document.getElementById(id)?.open);
    if (!other) { delete root.dataset.training; opener?.focus({ preventScroll: true }); }
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: other } }));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialog.open) setPaused(true); });
  window.addEventListener('blur', () => { if (dialog.open) setPaused(true); });
  window.addEventListener('pagehide', () => { if (dialog.open) setPaused(true); stop(); });
  window.addEventListener('portfolio:view', () => { if (dialog.open) dialog.close(); });
  reduced.addEventListener('change', () => { if (dialog.open) draw(); });
  window.PortfolioPlatformer = Object.freeze({ open(trigger) { opener = trigger; if (!dialog.open) dialog.showModal(); root.dataset.training = 'open'; window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: true } })); announce(); draw(); canvas.focus({ preventScroll: true }); dialog.scrollTop = 0; }, close() { dialog.close(); } });
})();
