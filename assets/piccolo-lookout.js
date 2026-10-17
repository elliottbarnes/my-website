/* Piccolo's Lookout: an original, local four-shade handheld adventure. */
(() => {
  'use strict';
  const TILE = 16, WIDTH = 320, HEIGHT = 192;
  function map(blocks, pools = []) {
    const grid = Array.from({ length: 12 }, (_, y) => Array.from({ length: 20 }, (_, x) => x === 0 || y === 0 || x === 19 || y === 11 ? '#' : '.'));
    for (const [x, y, w, h] of blocks) for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) grid[row][col] = '#';
    for (const [x, y, w, h] of pools) for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) grid[row][col] = '~';
    for (const y of [5, 6]) { grid[y][0] = '.'; grid[y][19] = '.'; }
    return grid.map(row => row.join(''));
  }
  const ROOMS = [
    { name: 'THE QUIET COURT', map: map([[6, 6, 2, 3], [12, 3, 2, 3]], [[3, 3, 3, 2]]), crystals: [{ x: 120, y: 48, label: 'KI', lit: false }], guards: [] },
    { name: 'HALL OF WARDENS', map: map([[6, 3, 2, 2], [6, 8, 2, 1], [12, 3, 2, 2], [12, 8, 2, 1]]), crystals: [], guards: [{ x: 152, y: 64, hp: 2, axis: 'y', low: 56, high: 136 }, { x: 248, y: 136, hp: 2, axis: 'y', low: 56, high: 136 }] },
    { name: 'THE MOON BELL', map: map([[8, 5, 4, 2]], [[3, 7, 3, 2], [14, 7, 3, 2]]), crystals: [{ x: 56, y: 48, label: 'MOON', lit: false }, { x: 264, y: 48, label: 'SUN', lit: false }], guards: [{ x: 160, y: 144, hp: 3, axis: 'x', low: 112, high: 208 }] },
  ];
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function create() {
    return { phase: 'ready', time: 0, room: 0, hearts: 4, hits: 0, shots: 0, event: 'intro', eventId: 0,
      player: { x: 40, y: 144, facing: 'up', immune: 0, cooldown: 0, walking: false }, projectiles: [], sparks: [],
      rooms: ROOMS.map(room => ({ crystals: room.crystals.map(crystal => ({ ...crystal })), guards: room.guards.map((guard, i) => ({ ...guard, direction: i % 2 ? -1 : 1, timer: 1.6 + i * .7, hurt: 0 })), cleared: false })) };
  }
  function say(game, message) { game.event = message; game.eventId++; }
  function start(game) { if (game.phase === 'ready') { game.phase = 'playing'; say(game, 'Light the KI crystal with A. Its glow opens the eastern gate.'); } }
  function unlocked(game, room = game.room) {
    const state = game.rooms[room];
    return room === 0 ? state.crystals[0].lit : room === 1 ? state.guards.every(guard => guard.hp <= 0) : state.crystals.every(crystal => crystal.lit) && state.guards.every(guard => guard.hp <= 0);
  }
  function solid(game, x, y) {
    if (x < 6 || y < 16 || x > WIDTH - 6 || y > HEIGHT - 16) return true;
    if (x < 16 && game.room === 0 || x >= 304 && (game.room === 2 || !unlocked(game))) return true;
    return ROOMS[game.room].map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] !== '.';
  }
  function canStand(game, x, y) { return ![[x - 5, y - 4], [x + 5, y - 4], [x - 5, y + 4], [x + 5, y + 4]].some(([x, y]) => solid(game, x, y)); }
  function move(game, actor, dx, dy) {
    if (canStand(game, actor.x + dx, actor.y)) actor.x += dx;
    if (canStand(game, actor.x, actor.y + dy)) actor.y += dy;
  }
  function light(game, index) {
    const crystals = game.rooms[game.room].crystals, crystal = crystals[index];
    if (!crystal || crystal.lit) return;
    if (game.room === 2 && index === 1 && !crystals[0].lit) { say(game, 'The sun waits. Light the crescent moon on the left first.'); return; }
    crystal.lit = true; game.sparks.push({ x: crystal.x, y: crystal.y, life: .4 });
    say(game, game.room === 0 ? 'The crystal sings. The eastern gate is open!' : index === 0 ? 'Moon seal lit. Now light the sun seal on the right.' : 'Both seals shine. Defeat the last warden, then press A at the bell.');
  }
  function fire(game) {
    const p = game.player, state = game.rooms[game.room];
    if (game.room === 2 && distance(p, { x: 160, y: 40 }) < 25) {
      if (unlocked(game)) { game.phase = 'won'; say(game, 'The bell rings again. The Lookout is safe. Well done, Piccolo.'); return; }
      say(game, 'The bell needs both seals and a quiet room. Moon, then sun; defeat the warden.');
    }
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing];
    // Adjacent seals respond to the same A button as ranged ki attacks.
    state.crystals.forEach((crystal, index) => { if (distance(p, crystal) < 23) light(game, index); });
    game.projectiles.push({ x: p.x + dx * 9, y: p.y + dy * 9, vx: dx * 158, vy: dy * 158, life: .9, enemy: false });
    p.cooldown = .28; game.shots++;
  }
  function damage(game, source) {
    const p = game.player; if (p.immune > 0 || game.phase !== 'playing') return;
    game.hearts--; game.hits++; p.immune = 1.25;
    const length = Math.max(1, distance(p, source)); move(game, p, (p.x - source.x) / length * 10, (p.y - source.y) / length * 10);
    if (game.hearts <= 0) { game.phase = 'lost'; say(game, 'Piccolo needs a rest. Start a fresh adventure to try again.'); }
    else say(game, `${game.hearts} hearts remain. Keep moving when a warden raises its arms.`);
  }
  function enter(game, room, fromRight = false) {
    game.room = room; game.player.x = fromRight ? 291 : 28; game.player.y = 96; game.player.immune = .6; game.projectiles = []; game.sparks = [];
    game.player.facing = fromRight ? 'left' : 'right';
    say(game, room === 0 ? 'The quiet court. The eastern gate remembers your crystal.' : room === 1 ? 'Two wardens block the way. Face them and hold A for ki. Dodge their slow shots.' : 'The old inscription reads: moon before sun. Light the seals and quiet the last warden.');
  }
  function step(game, input = {}, dt = 1 / 120) {
    if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
    dt = Math.min(dt, 1 / 30); game.time += dt;
    const p = game.player, state = game.rooms[game.room];
    p.immune = Math.max(0, p.immune - dt); p.cooldown = Math.max(0, p.cooldown - dt);
    let dx = Math.max(-1, Math.min(1, Number(input.x) || 0)), dy = Math.max(-1, Math.min(1, Number(input.y) || 0));
    const length = Math.max(1, Math.hypot(dx, dy)); dx /= length; dy /= length;
    if (dx || dy) p.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    p.walking = Boolean(dx || dy); move(game, p, dx * 68 * dt, dy * 68 * dt);
    if (input.action && p.cooldown <= 0) fire(game);
    if (game.phase !== 'playing') return game;
    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      guard.hurt = Math.max(0, guard.hurt - dt); guard.timer -= dt;
      if (guard.timer > .6) {
        guard[guard.axis] += guard.direction * 20 * dt;
        if (guard[guard.axis] >= guard.high) { guard[guard.axis] = guard.high; guard.direction = -1; }
        if (guard[guard.axis] <= guard.low) { guard[guard.axis] = guard.low; guard.direction = 1; }
      }
      if (guard.timer <= 0) {
        const length = Math.max(1, distance(guard, p));
        game.projectiles.push({ x: guard.x, y: guard.y, vx: (p.x - guard.x) / length * 53, vy: (p.y - guard.y) / length * 53, life: 3, enemy: true }); guard.timer = 2.5;
      }
      if (distance(guard, p) < 13) damage(game, guard);
    }
    game.projectiles = game.projectiles.filter(shot => {
      shot.life -= dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (shot.life <= 0 || solid(game, shot.x, shot.y)) return false;
      if (shot.enemy) { if (distance(shot, p) < 9) { damage(game, shot); return false; } return true; }
      const index = state.crystals.findIndex(crystal => distance(crystal, shot) < 10);
      if (index >= 0) { light(game, index); return false; }
      const guard = state.guards.find(guard => guard.hp > 0 && distance(guard, shot) < 12);
      if (!guard) return true;
      guard.hp--; guard.hurt = .16; game.sparks.push({ x: guard.x, y: guard.y, life: .3 });
      say(game, guard.hp ? 'Clean hit! Keep your distance.' : 'Warden quieted.'); return false;
    });
    if (game.phase !== 'playing') return game;
    game.sparks = game.sparks.filter(spark => { spark.life -= dt; return spark.life > 0; });
    if (unlocked(game) && !state.cleared) {
      state.cleared = true; game.hearts = Math.min(4, game.hearts + 1);
      say(game, game.room === 0 ? 'Crystal lit. Follow the arrow through the eastern gate.' : game.room === 1 ? 'The wardens rest. One heart restored; the eastern gate is open.' : 'The bell is ready. Approach the bell at the top and press A.');
    }
    if (game.phase !== 'playing') return game;
    if (p.x > 308 && game.room < 2 && unlocked(game)) enter(game, game.room + 1);
    else if (p.x < 12 && game.room > 0) enter(game, game.room - 1, true);
    return game;
  }
  function objective(game) {
    const state = game.rooms[game.room];
    if (game.room === 0) return unlocked(game) ? 'Eastern gate →' : 'Light the KI crystal with A';
    if (game.room === 1) return unlocked(game) ? 'Eastern gate →' : `Quiet the wardens: ${state.guards.filter(guard => guard.hp <= 0).length}/2`;
    if (!state.crystals[0].lit) return 'Light the moon seal on the left';
    if (!state.crystals[1].lit) return 'Light the sun seal on the right';
    return unlocked(game) ? 'Press A beside the bell ↑' : 'Quiet the last warden';
  }
  const engine = Object.freeze({ TILE, WIDTH, HEIGHT, ROOMS, create, start, step, solid, canStand, unlocked, objective });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('piccolo-dialog'); if (!dialog) return;
  dialog.innerHTML = `<header class="piccolo-heading"><div><span class="piccolo-edition">90s HANDHELD · 8-BIT</span><h2 id="piccolo-title">Piccolo’s Lookout</h2></div><button type="button" data-piccolo-close aria-label="Close Piccolo’s Lookout">esc</button></header>
    <div class="piccolo-screen-bezel"><div class="piccolo-screen-label"><span><i aria-hidden="true"></i> POWER</span><span>FOUR SHADES / ONE SMALL WORLD</span></div><canvas id="piccolo-canvas" width="320" height="224" tabindex="0" aria-label="Piccolo's Lookout, a top-down three-room adventure" aria-describedby="piccolo-objective piccolo-help piccolo-status">Move with arrows or WASD. Space or Z fires ki and activates nearby seals. Restore the Lookout bell.</canvas><div class="piccolo-screen-brand"><span id="piccolo-room">ROOM 1 / 3</span><span id="piccolo-hearts">4 HEARTS</span><span>CAPSULE POCKET</span></div></div>
    <p id="piccolo-objective">Light the KI crystal with A</p><p id="piccolo-status" role="status" aria-live="polite" aria-atomic="true">The Lookout’s bell has fallen silent. Three small rooms stand between Piccolo and the sky.</p>
    <div class="piccolo-controller"><div class="piccolo-dpad" role="group" aria-label="Movement controls"><button type="button" data-piccolo-hold="up" aria-label="Move up">▲</button><button type="button" data-piccolo-hold="left" aria-label="Move left">◀</button><span aria-hidden="true"></span><button type="button" data-piccolo-hold="right" aria-label="Move right">▶</button><button type="button" data-piccolo-hold="down" aria-label="Move down">▼</button></div><div class="piccolo-ab"><button type="button" data-piccolo-hold="action" aria-label="A: fire ki or interact">A</button><span>KI / INTERACT</span></div><div class="piccolo-speaker" aria-hidden="true">▰▰▰<br>▰▰▰<br>▰▰▰</div></div>
    <div class="piccolo-actions"><button type="button" data-piccolo-back>← cartridges</button><button type="button" id="piccolo-start">start ↵</button><button type="button" id="piccolo-pause" aria-pressed="false">pause</button></div>
    <details class="piccolo-help"><summary>how to play / controls</summary><p id="piccolo-help">Arrows or WASD to move. Face a target and hold Space or Z to fire ki; A also activates nearby seals and the bell. Wardens pause and raise their arms before firing: move aside. P pauses. Escape returns to the cartridges. Clear a room to restore one heart.</p></details>`;
  const root = document.documentElement, canvas = dialog.querySelector('#piccolo-canvas'), ctx = canvas.getContext('2d'); if (!ctx) return;
  const status = dialog.querySelector('#piccolo-status'), objectiveNode = dialog.querySelector('#piccolo-objective'), startButton = dialog.querySelector('#piccolo-start'), pauseButton = dialog.querySelector('#piccolo-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let game = create(), opener, frame = 0, last = null, debt = 0, paused = false, eventId = -1, pendingAction = false;
  const keys = new Set(), pointers = new Map(), pulses = new Map();
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  const held = key => keys.has(key) || [...pointers.values()].includes(key) || (pulses.get(key) || 0) > performance.now();
  const input = () => ({ x: Number(held('right')) - Number(held('left')), y: Number(held('down')) - Number(held('up')), action: held('action') || pendingAction });
  const terminal = () => game.phase === 'won' || game.phase === 'lost';
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function update() {
    setText(dialog.querySelector('#piccolo-room'), `ROOM ${game.room + 1} / 3`);
    setText(dialog.querySelector('#piccolo-hearts'), `${game.hearts} ${game.hearts === 1 ? 'HEART' : 'HEARTS'}`);
    setText(objectiveNode, game.phase === 'won' ? 'The sky is peaceful again.' : objective(game));
    setText(startButton, game.phase === 'ready' ? 'start ↵' : terminal() ? 'play again ↵' : 'restart ↻');
    setText(pauseButton, paused ? 'resume' : 'pause'); pauseButton.disabled = game.phase !== 'playing';
    if (pauseButton.getAttribute('aria-pressed') !== String(paused)) pauseButton.setAttribute('aria-pressed', String(paused));
    if (paused) setText(status, 'Paused. Your adventure will wait for you.');
    else if (eventId !== game.eventId) { eventId = game.eventId; setText(status, game.event === 'intro' ? 'The Lookout’s bell has fallen silent. Light its seals and bring the sky back to life.' : game.event); }
  }
  const colors = ['#d8e6a0', '#a9b96c', '#647541', '#263b2b'];
  function rect(x, y, w, h, shade) { ctx.fillStyle = colors[shade]; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function label(text, x, y, size = 7, shade = 3, align = 'center') { ctx.fillStyle = colors[shade]; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.fillText(text, Math.round(x), Math.round(y)); }
  const sprites = {
    piccolo: ['000033300000','000322230000','003222223000','032233222300','322222222230','032333323300','003222230000','033000003330','300000000003','300033300003','300322230003','030322230030','003322233300','000330033000','003330033300'],
    warden: ['0033333300','0322222230','3222222223','3200330023','3222222223','0323333230','0032222300','0322222230','3322222233','0033003300'],
  };
  function sprite(pattern, x, y, flip = false, scale = 1) { pattern.forEach((row, yy) => [...row].forEach((pixel, xx) => { if (pixel !== '0') rect(x + (flip ? row.length - xx - 1 : xx) * scale, y + yy * scale, scale, scale, Number(pixel)); })); }
  function draw() {
    ctx.imageSmoothingEnabled = false; rect(0, 0, 320, 224, 0);
    // A real tile room, with four fixed shades and no downloaded sprite assets.
    const map = ROOMS[game.room].map;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) {
      const px = x * 16, py = y * 16 + 24, tile = map[y][x];
      if (tile === '#') { rect(px, py, 16, 16, 3); rect(px + 1, py + 1, 14, 12, 2); rect(px + 2, py + 2, 12, 2, 1); rect(px + 7, py + 5, 1, 8, 3); rect(px + 1, py + 8, 6, 1, 3); }
      else if (tile === '~') { rect(px, py, 16, 16, 2); rect(px + 2, py + 4, 5, 1, 1); rect(px + 9, py + 10, 5, 1, 1); }
      else { rect(px, py, 16, 16, 0); if ((x + y) % 3 === 0) { rect(px + 3, py + 11, 2, 1, 1); rect(px + 11, py + 5, 1, 1, 1); } }
    }
    // Doorways visibly change from bars to an invitation.
    if (game.room < 2) {
      if (!unlocked(game)) { rect(304, 104, 15, 32, 2); for (let x = 306; x < 320; x += 4) rect(x, 104, 2, 32, 3); rect(306, 117, 12, 5, 3); }
      else { label('→', 310, 124, 15); rect(306, 105, 8, 1, 1); rect(306, 135, 8, 1, 1); }
    } else { rect(304, 104, 16, 32, 3); rect(305, 105, 14, 30, 2); }
    if (!game.room) { rect(0, 104, 16, 32, 3); rect(1, 105, 14, 30, 2); }
    if (game.room === 2) {
      const ready = unlocked(game); rect(147, 52, 26, 25, 2); rect(151, 46, 18, 17, 3); rect(154, 48, 12, 13, ready ? 0 : 1); rect(149, 61, 22, 4, 3); rect(159, 65, 3, 3, 3); label(ready ? 'A' : 'BELL', 160, 84, 7);
      label('MOON BEFORE SUN', 160, 193, 7, 2);
    }
    const state = game.rooms[game.room];
    state.crystals.forEach(crystal => {
      const x = crystal.x, y = crystal.y + 24;
      rect(x - 9, y + 7, 18, 6, 2); rect(x - 6, y - 7, 12, 14, 3); rect(x - 3, y - 10, 6, 20, 3); rect(x - 4, y - 5, 8, 11, crystal.lit ? 0 : 1); rect(x - 1, y - 8, 2, 16, crystal.lit ? 1 : 2);
      if (crystal.lit) { rect(x - 12, y - 2, 2, 2, 2); rect(x + 10, y - 2, 2, 2, 2); }
      label(crystal.label, x, y + 23, 7);
    });
    for (const guard of state.guards) if (guard.hp > 0) {
      const x = Math.round(guard.x), y = Math.round(guard.y) + 24;
      sprite(sprites.warden, x - 10, y - 14, guard.direction < 0, 2);
      if (guard.timer < .6) { rect(x - 14, y - 12, 4, 12, 3); rect(x + 10, y - 12, 4, 12, 3); label('!', x, y - 19, 9); }
      for (let hp = 0; hp < guard.hp; hp++) rect(x - guard.hp * 2 + hp * 4, y + 7, 3, 2, 3);
      if (guard.hurt > 0 && !quiet()) { rect(x - 8, y - 10, 2, 2, 3); rect(x + 8, y, 2, 2, 3); }
    }
    for (const shot of game.projectiles) { const x = shot.x, y = shot.y + 24; rect(x - 2, y - 2, 5, 5, 3); rect(x - 1, y - 1, 3, 3, shot.enemy ? 2 : 0); if (!shot.enemy) rect(x - Math.sign(shot.vx) * 5, y - Math.sign(shot.vy) * 5, 2, 2, 2); }
    const p = game.player;
    if (p.immune <= 0 || quiet() || Math.floor(game.time * 8) % 2 === 0) {
      const x = Math.round(p.x), y = Math.round(p.y) + 24, stride = p.walking && !quiet() ? Math.floor(game.time * 9) % 2 : 0;
      rect(x - 9, y + 4, 18, 3, 1); sprite(sprites.piccolo, x - 12, y - 24, p.facing === 'left', 2);
      // Turban, pointed ears and the pale shoulder cape remain distinct at 1x.
      rect(x - 8, y - 22, 16, 4, 0); rect(x - 13, y - 16, 4, 6, 2); rect(x + 10, y - 16, 4, 6, 2); rect(x - 14, y - 6, 28, 6, 0);
      if (stride) { rect(x - 8, y + 4, 6, 2, 3); rect(x + 4, y + 3, 6, 2, 3); }
      const [fx, fy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing]; rect(x + fx * 17 - 1, y + fy * 10 - 1, 2, 2, 2);
    }
    if (!quiet()) for (const spark of game.sparks) { const radius = Math.round((.4 - spark.life) * 24) + 5; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) rect(spark.x + dx * radius, spark.y + 24 + dy * radius, 2, 2, 3); }
    rect(0, 0, 320, 24, 3); label(ROOMS[game.room].name, 9, 10, 7, 0, 'left'); label(`ROOM ${game.room + 1}/3`, 9, 19, 6, 1, 'left');
    for (let i = 0; i < 4; i++) { const x = 265 + i * 12; label(i < game.hearts ? '♥' : '♡', x, 16, 11, i < game.hearts ? 0 : 2); }
    rect(0, 216, 320, 8, 3); label('MOVE + AIM     A: KI / INTERACT', 160, 222, 6, 1);
    if (game.phase === 'ready' || terminal() || paused) {
      rect(29, 65, 262, 112, 3); rect(32, 68, 256, 106, 0); rect(36, 72, 248, 98, 3); rect(38, 74, 244, 94, 0);
      label(paused ? 'TAKE A BREATHER' : game.phase === 'won' ? 'THE SKY SINGS AGAIN' : game.phase === 'lost' ? 'REST, THEN RISE' : "PICCOLO'S LOOKOUT", 160, 94, 12);
      label(paused ? 'Your adventure is safe.' : game.phase === 'won' ? 'Three rooms. One quiet hero.' : game.phase === 'lost' ? 'Every guardian gets another try.' : 'The bell above the clouds is silent.', 160, 115, 8);
      label(paused ? 'P / RESUME' : terminal() ? 'ENTER / PLAY AGAIN' : 'Light the seals. Restore its song.', 160, 132, 8);
      label(paused || terminal() ? '' : 'ENTER / START', 160, 154, 9);
    }
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = null; debt = 0; }
  function clearInput() {
    pendingAction = false; keys.clear(); pulses.clear();
    dialog.querySelectorAll('[data-piccolo-hold]').forEach(button => {
      for (const [id, control] of pointers) if (control === button.dataset.piccoloHold && button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
      button.removeAttribute('data-held');
    });
    pointers.clear();
  }
  function schedule() { if (!frame && dialog.open && !document.hidden && !paused && game.phase === 'playing') frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0; if (!dialog.open || document.hidden || paused) { last = null; return; }
    debt += last === null ? 0 : Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    while (debt >= 1 / 120) { step(game, input(), 1 / 120); pendingAction = false; debt -= 1 / 120; }
    update(); draw(); schedule();
  }
  function begin() { stop(); clearInput(); game = create(); start(game); paused = false; eventId = -1; update(); draw(); schedule(); canvas.focus({ preventScroll: true }); }
  function setPaused(next) { if (game.phase !== 'playing') return; paused = next; clearInput(); stop(); eventId = -1; update(); draw(); if (!paused) schedule(); }
  const keyControl = key => ({ ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'action', z: 'action' }[key]);
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p') { event.preventDefault(); if (!event.repeat) setPaused(!paused); return; }
    if (key === 'Enter' && event.target === canvas && (game.phase === 'ready' || terminal())) { event.preventDefault(); if (!event.repeat) begin(); return; }
    const control = keyControl(key); if (!control || (key === ' ' && event.target.closest('button, summary'))) return;
    event.preventDefault(); event.stopPropagation(); if (!paused && game.phase === 'playing') { keys.add(control); if (control === 'action' && !event.repeat) pendingAction = true; }
  });
  dialog.addEventListener('keyup', event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (key === ' ' && event.target.closest('button, summary')) return; const control = keyControl(key); if (control) { event.preventDefault(); keys.delete(control); } });
  dialog.querySelectorAll('[data-piccolo-hold]').forEach(button => {
    button.addEventListener('pointerdown', event => { if (event.button !== 0 || paused || game.phase !== 'playing') return; event.preventDefault(); pointers.set(event.pointerId, button.dataset.piccoloHold); if (button.dataset.piccoloHold === 'action') pendingAction = true; button.setPointerCapture(event.pointerId); button.dataset.held = 'true'; });
    const release = event => { pointers.delete(event.pointerId); button.removeAttribute('data-held'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', event => { release(event); if (button.dataset.piccoloHold === 'action') pendingAction = false; }); button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', event => { if (event.detail === 0 && !paused && game.phase === 'playing') { if (button.dataset.piccoloHold === 'action') pendingAction = true; else pulses.set(button.dataset.piccoloHold, performance.now() + 200); } });
  });
  startButton.addEventListener('click', begin); pauseButton.addEventListener('click', () => setPaused(!paused));
  const back = () => window.PortfolioGames?.run('choose', opener);
  dialog.querySelector('[data-piccolo-back]').addEventListener('click', back); dialog.querySelector('[data-piccolo-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); back(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; stop(); clearInput(); if (game.phase === 'playing') paused = true;
    const other = ['arcade-dialog', 'training-dialog', 'platformer-dialog', 'goku-dialog', 'game-loading-dialog'].some(id => document.getElementById(id)?.open);
    if (!other) { delete root.dataset.training; opener?.focus({ preventScroll: true }); }
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: other } }));
  });
  window.addEventListener('blur', () => { if (dialog.open) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialog.open) setPaused(true); });
  window.addEventListener('pagehide', () => { if (dialog.open) setPaused(true); stop(); });
  window.addEventListener('portfolio:view', () => { if (dialog.open) dialog.close(); });
  reduced.addEventListener('change', () => { if (dialog.open) draw(); });
  window.PortfolioPiccolo = Object.freeze({ open(trigger) { opener = trigger; if (!dialog.open) dialog.showModal(); root.dataset.training = 'open'; window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: true } })); update(); draw(); canvas.focus({ preventScroll: true }); dialog.scrollTop = 0; }, close() { dialog.close(); } });
})();
