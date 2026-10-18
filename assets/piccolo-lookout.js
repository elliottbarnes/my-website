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
    { name: 'THE QUIET COURT', map: map([[6, 6, 2, 3], [12, 3, 2, 3]], [[3, 3, 3, 2]]),
      crystals: [{ x: 120, y: 48, label: 'KI' }], guards: [],
      intro: 'Light the KI crystal with A. Its glow opens the eastern gate.', inscription: 'A LIGHTS SEALS AND FIRES KI' },
    { name: 'HALL OF WARDENS', map: map([[6, 3, 2, 2], [6, 8, 2, 1], [12, 3, 2, 2], [12, 8, 2, 1]]), crystals: [],
      guards: [{ x: 152, y: 64, hp: 2, axis: 'y', low: 56, high: 136 }, { x: 248, y: 136, hp: 2, axis: 'y', low: 56, high: 136 }],
      intro: 'Wardens raise their arms before firing. Face them and use ki; your shots can deflect theirs.', inscription: 'WATCH THE WIND-UP' },
    { name: 'THE MOON GARDEN', map: map([[8, 5, 4, 2]], [[3, 7, 3, 2], [14, 7, 3, 2]]), ordered: true,
      crystals: [{ x: 56, y: 48, label: 'MOON' }, { x: 264, y: 48, label: 'SUN' }], guards: [{ x: 160, y: 144, hp: 3, axis: 'x', low: 112, high: 208 }],
      intro: 'The inscription says moon before sun. Light both seals and quiet the garden warden.', inscription: 'MOON BEFORE SUN' },
    { name: 'THE TIDE CISTERN', map: map([[4, 7, 2, 2], [14, 2, 2, 2]], [[9, 1, 2, 10]]), bridge: { x: 9, y: 5, w: 2, h: 2, crystal: 0 },
      crystals: [{ x: 72, y: 48, label: 'TIDE' }, { x: 248, y: 144, label: 'GATE' }], guards: [],
      intro: 'The TIDE seal raises a bridge. Cross the water, then light the GATE seal.', inscription: 'THE TIDE REVEALS A WAY' },
    { name: 'THE WIND TERRACE', map: map([[6, 3, 2, 2], [6, 8, 2, 2], [12, 5, 2, 2]]), crystals: [],
      guards: [{ x: 152, y: 48, hp: 3, kind: 'sentry', axis: 'x', low: 152, high: 152 }, { x: 248, y: 144, hp: 3, kind: 'scout', axis: 'y', low: 48, high: 152 }],
      intro: 'The horned sentry fires a slow fan. The scout moves quickly. Use cover and answer with ki.', inscription: 'COVER, THEN COUNTER' },
    { name: 'THE MOON BELL', map: map([[8, 5, 4, 2]], [[3, 7, 3, 2], [14, 7, 3, 2]]), bell: { x: 160, y: 40 },
      crystals: [{ x: 56, y: 48, label: 'DAWN' }, { x: 264, y: 48, label: 'DUSK' }],
      guards: [{ x: 160, y: 128, hp: 8, kind: 'keeper', axis: 'x', low: 112, high: 208 }],
      intro: 'Dawn and dusk hold the keeper’s shield. Light both, defeat the keeper, then ring the bell.', inscription: 'TWO SEALS BREAK THE SHIELD' },
  ];
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const freshRoom = room => ({ crystals: room.crystals.map(crystal => ({ ...crystal, lit: false })),
    guards: room.guards.map((guard, i) => ({ kind: 'warden', ...guard, direction: i % 2 ? -1 : 1, timer: 1.6 + i * .7, hurt: 0 })), cleared: false });
  const freshPlayer = () => ({ x: 40, y: 144, facing: 'up', immune: 0, cooldown: 0, walking: false, actionHeld: false, actionBuffer: 0 });
  function create() {
    return { phase: 'ready', time: 0, room: 0, checkpoint: 0, attempts: 1, hearts: 4, hits: 0, shots: 0, deflections: 0, event: 'intro', eventId: 0,
      player: freshPlayer(), projectiles: [], sparks: [], rooms: ROOMS.map(freshRoom) };
  }
  function say(game, message) { if (game.event !== message) { game.event = message; game.eventId++; } }
  function start(game) { if (game.phase === 'ready') { game.phase = 'playing'; say(game, ROOMS[0].intro); } }
  function unlocked(game, room = game.room) {
    const state = game.rooms[room];
    return state.crystals.every(crystal => crystal.lit) && state.guards.every(guard => guard.hp <= 0);
  }
  function tileAt(game, x, y) {
    const room = ROOMS[game.room], bridge = room.bridge;
    if (bridge && game.rooms[game.room].crystals[bridge.crystal].lit && x >= bridge.x && x < bridge.x + bridge.w && y >= bridge.y && y < bridge.y + bridge.h) return '=';
    return room.map[y]?.[x];
  }
  function solid(game, x, y) {
    if (x < 6 || y < 16 || x > WIDTH - 6 || y > HEIGHT - 16) return true;
    if (x < 16 && game.room === 0 || x >= 304 && (game.room === ROOMS.length - 1 || !unlocked(game))) return true;
    return !['.', '='].includes(tileAt(game, Math.floor(x / TILE), Math.floor(y / TILE)));
  }
  function canStand(game, x, y) { return ![[x - 5, y - 4], [x + 5, y - 4], [x - 5, y + 4], [x + 5, y + 4]].some(([x, y]) => solid(game, x, y)); }
  function move(game, actor, dx, dy) {
    if (canStand(game, actor.x + dx, actor.y)) actor.x += dx;
    if (canStand(game, actor.x, actor.y + dy)) actor.y += dy;
  }
  function clearLine(game, a, b) {
    const samples = Math.ceil(distance(a, b) / 4);
    for (let i = 1; i < samples; i++) if (solid(game, a.x + (b.x - a.x) * i / samples, a.y + (b.y - a.y) * i / samples)) return false;
    return true;
  }
  function light(game, index) {
    const room = ROOMS[game.room], crystals = game.rooms[game.room].crystals, crystal = crystals[index];
    if (!crystal || crystal.lit) return;
    if (room.ordered && crystals.slice(0, index).some(crystal => !crystal.lit)) { say(game, 'The sun waits. Light the crescent moon on the left first.'); return; }
    crystal.lit = true; game.sparks.push({ x: crystal.x, y: crystal.y, life: .4 });
    say(game, room.bridge && index === room.bridge.crystal ? 'The bridge rises! Cross the middle and light the GATE seal.'
      : room.bell && crystals.every(crystal => crystal.lit) ? 'The keeper’s shield is down. Answer its attacks with ki!'
        : room.ordered && index === 0 ? 'Moon seal lit. Now light the sun seal on the right.' : `${crystal.label} seal lit.`);
  }
  const shielded = (game, guard) => guard.kind === 'keeper' && game.rooms[game.room].crystals.some(crystal => !crystal.lit);
  function fire(game) {
    const p = game.player, state = game.rooms[game.room], bell = ROOMS[game.room].bell;
    if (bell && distance(p, bell) < 25 && clearLine(game, p, bell)) {
      if (unlocked(game)) { game.phase = 'won'; say(game, 'The bell rings again. Six rooms restored; the Lookout is safe. Well done, Piccolo.'); return; }
      say(game, 'The bell needs both seals and a quiet room. Lower the shield and defeat the keeper.');
    }
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing];
    state.crystals.forEach((crystal, index) => { if (distance(p, crystal) < 23 && clearLine(game, p, crystal)) light(game, index); });
    game.projectiles.push({ x: p.x + dx * 9, y: p.y + dy * 9, vx: dx * 158, vy: dy * 158, life: 1.2, enemy: false });
    p.cooldown = .28; p.actionBuffer = 0; game.shots++;
  }
  function damage(game, source) {
    const p = game.player; if (p.immune > 0 || game.phase !== 'playing') return;
    game.hearts--; game.hits++; p.immune = 1.25;
    const length = Math.max(1, distance(p, source)); move(game, p, (p.x - source.x) / length * 10, (p.y - source.y) / length * 10);
    if (game.hearts <= 0) { game.phase = 'lost'; say(game, `Rest, then return. Continue from room ${game.checkpoint + 1}; earlier rooms are safe.`); }
    else say(game, `${game.hearts} hearts remain. Move aside or deflect the next shot with ki.`);
  }
  function enter(game, room, fromRight = false) {
    game.room = room; game.checkpoint = Math.max(game.checkpoint, room);
    Object.assign(game.player, { x: fromRight ? 291 : 28, y: 96, immune: .8, facing: fromRight ? 'left' : 'right', walking: false });
    game.projectiles = []; game.sparks = [];
    say(game, `Room ${room + 1} saved. ${ROOMS[room].intro}`);
  }
  function retry(game) {
    if (game.phase !== 'lost') return game;
    for (let room = game.checkpoint; room < ROOMS.length; room++) game.rooms[room] = freshRoom(ROOMS[room]);
    game.phase = 'playing'; game.hearts = 4; game.attempts++; game.player = freshPlayer();
    enter(game, game.checkpoint);
    if (game.room === 0) Object.assign(game.player, { x: 40, y: 144, facing: 'up' });
    say(game, `Room ${game.room + 1} checkpoint. Four hearts; try a new approach.`);
    return game;
  }
  function shootGuard(game, guard) {
    const angle = Math.atan2(game.player.y - guard.y, game.player.x - guard.x);
    const fan = ['sentry', 'keeper'].includes(guard.kind) ? [-.32, 0, .32] : [0];
    const speed = guard.kind === 'scout' ? 64 : guard.kind === 'keeper' ? 56 : 50;
    for (const offset of fan) game.projectiles.push({ x: guard.x, y: guard.y, vx: Math.cos(angle + offset) * speed, vy: Math.sin(angle + offset) * speed, life: 3, enemy: true });
    guard.timer = guard.kind === 'scout' ? 2 : guard.kind === 'keeper' ? 2.6 : 2.8;
  }
  function step(game, input = {}, dt = 1 / 120) {
    if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
    dt = Math.min(dt, 1 / 30); game.time += dt;
    const p = game.player, state = game.rooms[game.room];
    p.immune = Math.max(0, p.immune - dt); p.cooldown = Math.max(0, p.cooldown - dt);
    if (input.action && !p.actionHeld) p.actionBuffer = .14; else p.actionBuffer = Math.max(0, p.actionBuffer - dt);
    p.actionHeld = Boolean(input.action);
    let dx = Math.max(-1, Math.min(1, Number(input.x) || 0)), dy = Math.max(-1, Math.min(1, Number(input.y) || 0));
    const length = Math.max(1, Math.hypot(dx, dy)); dx /= length; dy /= length;
    if (dx || dy) p.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    const oldX = p.x, oldY = p.y; move(game, p, dx * 68 * dt, dy * 68 * dt); p.walking = p.x !== oldX || p.y !== oldY;
    if ((input.action || p.actionBuffer > 0) && p.cooldown <= 0) fire(game);
    if (game.phase !== 'playing') return game;
    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      guard.hurt = Math.max(0, guard.hurt - dt); guard.timer -= dt;
      if (guard.timer > .65 && guard.kind !== 'sentry') {
        const before = guard[guard.axis], speed = guard.kind === 'scout' ? 32 : 20;
        move(game, guard, guard.axis === 'x' ? guard.direction * speed * dt : 0, guard.axis === 'y' ? guard.direction * speed * dt : 0);
        if (guard[guard.axis] === before || guard[guard.axis] >= guard.high) { guard[guard.axis] = Math.min(guard[guard.axis], guard.high); guard.direction = -1; }
        if (guard[guard.axis] <= guard.low) { guard[guard.axis] = guard.low; guard.direction = 1; }
      }
      if (guard.timer <= 0) shootGuard(game, guard);
      if (distance(guard, p) < 13) damage(game, guard);
      if (game.phase !== 'playing') return game;
    }
    // Move every shot before resolving contacts so the result is independent of
    // insertion order. A friendly bolt can cancel one enemy bolt, then disappears.
    for (const shot of game.projectiles) {
      shot.life -= dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (solid(game, shot.x, shot.y)) shot.life = 0;
    }
    for (const shot of game.projectiles) if (!shot.enemy && shot.life > 0) {
      const incoming = game.projectiles.find(other => other.enemy && other.life > 0 && distance(shot, other) < 8);
      if (incoming) { shot.life = incoming.life = 0; game.deflections++; game.sparks.push({ x: shot.x, y: shot.y, life: .2 }); }
    }
    for (const shot of game.projectiles) {
      if (shot.life <= 0) continue;
      if (shot.enemy) { if (distance(shot, p) < 9) { damage(game, shot); shot.life = 0; } }
      else {
        const index = state.crystals.findIndex(crystal => !crystal.lit && distance(crystal, shot) < 10);
        const guard = state.guards.find(guard => guard.hp > 0 && distance(guard, shot) < 12);
        if (index >= 0) { light(game, index); shot.life = 0; }
        else if (guard) {
          shot.life = 0; game.sparks.push({ x: guard.x, y: guard.y, life: .3 });
          if (shielded(game, guard)) say(game, 'The shield holds. Light DAWN and DUSK first.');
          else { guard.hp--; guard.hurt = .16; say(game, guard.hp ? 'Clean hit! Keep your distance.' : guard.kind === 'keeper' ? 'The keeper rests. The bell awaits.' : 'Warden quieted.'); }
        }
      }
      if (game.phase !== 'playing') return game;
    }
    game.projectiles = game.projectiles.filter(shot => shot.life > 0);
    game.sparks = game.sparks.filter(spark => { spark.life -= dt; return spark.life > 0; });
    if (unlocked(game) && !state.cleared) {
      state.cleared = true; game.hearts = Math.min(4, game.hearts + 1);
      game.projectiles = game.projectiles.filter(shot => !shot.enemy);
      say(game, ROOMS[game.room].bell ? 'The bell is ready. Approach it at the top and press A.' : 'Room restored. One heart returns; the eastern gate is open.');
    }
    if (p.x > 308 && game.room < ROOMS.length - 1 && unlocked(game)) enter(game, game.room + 1);
    else if (p.x < 12 && game.room > 0) enter(game, game.room - 1, true);
    return game;
  }
  function objective(game) {
    const room = ROOMS[game.room], state = game.rooms[game.room];
    if (unlocked(game)) return room.bell ? 'Press A beside the bell ↑' : 'Eastern gate →';
    const unlit = state.crystals.find(crystal => !crystal.lit);
    if (unlit) return room.bridge && unlit.label === 'GATE' ? 'Cross the bridge; light GATE below' : `Light the ${unlit.label} seal with A`;
    const remaining = state.guards.filter(guard => guard.hp > 0).length;
    return room.bell ? 'Shield down! Quiet the bell keeper' : `Quiet the wardens: ${remaining} remaining`;
  }
  const engine = Object.freeze({ TILE, WIDTH, HEIGHT, ROOMS, create, start, retry, step, solid, tileAt, canStand, unlocked, objective });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('piccolo-dialog'); if (!dialog) return;
  dialog.innerHTML = `<header class="piccolo-heading"><div><span class="piccolo-edition">90s HANDHELD · 8-BIT</span><h2 id="piccolo-title">Piccolo’s Lookout</h2></div><button type="button" data-piccolo-close aria-label="Close Piccolo’s Lookout">esc</button></header>
    <div class="piccolo-screen-bezel"><div class="piccolo-screen-label"><span><i aria-hidden="true"></i> POWER</span><span>FOUR SHADES / ONE SMALL WORLD</span></div><canvas id="piccolo-canvas" width="320" height="224" tabindex="0" aria-label="Piccolo's Lookout, a top-down six-room adventure" aria-describedby="piccolo-objective piccolo-help piccolo-status">Move with arrows or WASD. Space or Z fires ki and activates nearby seals. Restore the Lookout bell.</canvas><div class="piccolo-screen-brand"><span id="piccolo-room">ROOM 1 / 6</span><span id="piccolo-hearts">4 HEARTS</span><span>CAPSULE POCKET</span></div></div>
    <ol class="piccolo-route" aria-label="Adventure progress">${ROOMS.map((room, index) => `<li data-piccolo-room="${index}" title="${room.name}">${index + 1}</li>`).join('')}</ol><p id="piccolo-objective">Light the KI crystal with A</p><p id="piccolo-status" role="status" aria-live="polite" aria-atomic="true">The Lookout’s bell has fallen silent. Six rooms, a hidden bridge, and the bell keeper await Piccolo.</p>
    <div class="piccolo-controller"><div class="piccolo-dpad" role="group" aria-label="Movement controls"><button type="button" data-piccolo-hold="up" aria-label="Move up">▲</button><button type="button" data-piccolo-hold="left" aria-label="Move left">◀</button><span aria-hidden="true"></span><button type="button" data-piccolo-hold="right" aria-label="Move right">▶</button><button type="button" data-piccolo-hold="down" aria-label="Move down">▼</button></div><div class="piccolo-ab"><button type="button" data-piccolo-hold="action" aria-label="A: fire ki or interact">A</button><span>KI / INTERACT</span></div><div class="piccolo-speaker" aria-hidden="true">▰▰▰<br>▰▰▰<br>▰▰▰</div></div>
    <div class="piccolo-actions"><button type="button" data-piccolo-back>← cartridges</button><button type="button" id="piccolo-start">start ↵</button><button type="button" id="piccolo-pause" aria-pressed="false">pause</button></div>
    <details class="piccolo-help"><summary>how to play / controls</summary><p id="piccolo-help">Arrows or WASD to move. Face a target and hold Space or Z to fire ki; A also activates nearby seals and the bell. Wardens raise their arms before firing: move aside or deflect their shots with ki. Light moon before sun, raise the tide bridge, and break the bell keeper’s shield. P pauses; Escape returns to cartridges. Each new room saves a checkpoint. Continue after a defeat with four hearts; restart begins a new adventure.</p></details>`;
  const root = document.documentElement, canvas = dialog.querySelector('#piccolo-canvas'), ctx = canvas.getContext('2d'); if (!ctx) return;
  const status = dialog.querySelector('#piccolo-status'), objectiveNode = dialog.querySelector('#piccolo-objective'), startButton = dialog.querySelector('#piccolo-start'), pauseButton = dialog.querySelector('#piccolo-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let game = create(), opener, frame = 0, last = null, debt = 0, paused = false, eventId = -1, pendingAction = false;
  const keys = new Set(), pointers = new Map(), pulses = new Map();
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  const held = control => [...keys].some(key => keyControl(key) === control) || [...pointers.values()].includes(control) || (pulses.get(control) || 0) > performance.now();
  const input = () => ({ x: Number(held('right')) - Number(held('left')), y: Number(held('down')) - Number(held('up')), action: held('action') || pendingAction });
  const terminal = () => game.phase === 'won' || game.phase === 'lost';
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function update() {
    setText(dialog.querySelector('#piccolo-room'), `ROOM ${game.room + 1} / ${ROOMS.length}`);
    setText(dialog.querySelector('#piccolo-hearts'), `${game.hearts} ${game.hearts === 1 ? 'HEART' : 'HEARTS'}`);
    setText(objectiveNode, game.phase === 'won' ? 'Six rooms restored. The sky is peaceful.' : game.phase === 'lost' ? `Continue from room ${game.checkpoint + 1} / ${ROOMS.length}` : objective(game));
    dialog.querySelectorAll('[data-piccolo-room]').forEach(node => { const index = Number(node.dataset.piccoloRoom); node.dataset.cleared = String(game.rooms[index].cleared); node.setAttribute('aria-current', index === game.room ? 'step' : 'false'); });
    setText(startButton, game.phase === 'ready' ? 'start ↵' : game.phase === 'lost' ? 'continue ↵' : game.phase === 'won' ? 'play again ↵' : 'restart ↻');
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
    const room = ROOMS[game.room];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) {
      const px = x * 16, py = y * 16 + 24, tile = tileAt(game, x, y);
      if (tile === '#') { rect(px, py, 16, 16, 3); rect(px + 1, py + 1, 14, 12, 2); rect(px + 2, py + 2, 12, 2, 1); rect(px + 7, py + 5, 1, 8, 3); rect(px + 1, py + 8, 6, 1, 3); }
      else if (tile === '=') { rect(px, py, 16, 16, 1); rect(px, py, 16, 2, 3); rect(px, py + 14, 16, 2, 3); for (let plank = 3; plank < 16; plank += 4) rect(px + plank, py + 2, 1, 12, 2); }
      else if (tile === '~') { rect(px, py, 16, 16, 2); rect(px + 2, py + 4, 5, 1, 1); rect(px + 9, py + 10, 5, 1, 1); }
      else { rect(px, py, 16, 16, 0); if ((x + y) % 3 === 0) { rect(px + 3, py + 11, 2, 1, 1); rect(px + 11, py + 5, 1, 1, 1); } }
    }
    // Doorways visibly change from bars to an invitation.
    if (game.room < ROOMS.length - 1) {
      if (!unlocked(game)) { rect(304, 104, 15, 32, 2); for (let x = 306; x < 320; x += 4) rect(x, 104, 2, 32, 3); rect(306, 117, 12, 5, 3); }
      else { label('→', 310, 124, 15); rect(306, 105, 8, 1, 1); rect(306, 135, 8, 1, 1); }
    } else { rect(304, 104, 16, 32, 3); rect(305, 105, 14, 30, 2); }
    if (!game.room) { rect(0, 104, 16, 32, 3); rect(1, 105, 14, 30, 2); }
    if (room.bell) {
      const ready = unlocked(game); rect(147, 52, 26, 25, 2); rect(151, 46, 18, 17, 3); rect(154, 48, 12, 13, ready ? 0 : 1); rect(149, 61, 22, 4, 3); rect(159, 65, 3, 3, 3); label(ready ? 'A' : 'BELL', 160, 84, 7);
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
      if (guard.timer < .65) { rect(x - 14, y - 12, 4, 12, 3); rect(x + 10, y - 12, 4, 12, 3); label('!', x, y - 19, 9); }
      if (guard.kind === 'sentry') { rect(x - 12, y - 17, 3, 9, 3); rect(x + 9, y - 17, 3, 9, 3); rect(x - 3, y - 8, 6, 3, 0); }
      if (guard.kind === 'scout') { rect(x - 13, y - 7, 5, 2, 2); rect(x + 8, y - 7, 5, 2, 2); rect(x - 2, y - 12, 4, 3, 0); }
      if (guard.kind === 'keeper') { rect(x - 15, y - 5, 5, 13, 2); rect(x + 10, y - 5, 5, 13, 2); rect(x - 10, y - 17, 20, 3, 3); rect(x - 5, y - 20, 3, 6, 3); rect(x + 2, y - 20, 3, 6, 3);
        if (shielded(game, guard)) { rect(x - 17, y - 16, 2, 24, 2); rect(x + 15, y - 16, 2, 24, 2); rect(x - 14, y - 19, 28, 2, 1); rect(x - 14, y + 9, 28, 2, 1); label('SEALS', x, y - 24, 6, 3); } }
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
    rect(0, 0, 320, 24, 3); label(ROOMS[game.room].name, 9, 10, 7, 0, 'left'); label(`ROOM ${game.room + 1}/${ROOMS.length}`, 9, 19, 6, 1, 'left');
    for (let i = 0; i < 4; i++) { const x = 265 + i * 12; label(i < game.hearts ? '♥' : '♡', x, 16, 11, i < game.hearts ? 0 : 2); }
    label(room.inscription, 160, 208, 6, 0);
    rect(0, 216, 320, 8, 3); label('MOVE + AIM     A: KI / INTERACT', 160, 222, 6, 1);
    if (game.phase === 'ready' || terminal() || paused) {
      rect(29, 65, 262, 112, 3); rect(32, 68, 256, 106, 0); rect(36, 72, 248, 98, 3); rect(38, 74, 244, 94, 0);
      label(paused ? 'TAKE A BREATHER' : game.phase === 'won' ? 'THE SKY SINGS AGAIN' : game.phase === 'lost' ? 'REST, THEN RISE' : "PICCOLO'S LOOKOUT", 160, 94, 12);
      label(paused ? 'Your adventure is safe.' : game.phase === 'won' ? 'Six rooms. One quiet hero.' : game.phase === 'lost' ? `Room ${game.checkpoint + 1} is your checkpoint.` : 'The bell above the clouds is silent.', 160, 115, 8);
      label(paused ? 'P / RESUME' : game.phase === 'lost' ? 'ENTER / CONTINUE' : game.phase === 'won' ? 'ENTER / PLAY AGAIN' : 'Light the seals. Restore its song.', 160, 132, 8);
      label(paused || terminal() ? '' : 'ENTER / START', 160, 154, 9);
    }
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = null; debt = 0; }
  function clearInput() {
    pendingAction = false; keys.clear(); pulses.clear();
    game.player.actionBuffer = 0; game.player.actionHeld = false; game.player.walking = false;
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
  function begin() { stop(); clearInput(); if (game.phase === 'lost') retry(game); else { game = create(); start(game); } paused = false; eventId = -1; update(); draw(); schedule(); canvas.focus({ preventScroll: true }); }
  function setPaused(next) { if (game.phase !== 'playing') return; paused = next; clearInput(); stop(); eventId = -1; update(); draw(); if (!paused) schedule(); }
  const keyControl = key => ({ ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'action', z: 'action' }[key]);
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p') { event.preventDefault(); if (!event.repeat) setPaused(!paused); return; }
    if (key === 'Enter' && event.target === canvas && (game.phase === 'ready' || terminal())) { event.preventDefault(); if (!event.repeat) begin(); return; }
    const control = keyControl(key); if (!control || (key === ' ' && event.target.closest('button, summary'))) return;
    event.preventDefault(); event.stopPropagation();
    // Reset/pause clears the physical-key set. Auto-repeat from an older hold
    // must not re-arm movement until that key has been released and pressed anew.
    if (!paused && game.phase === 'playing' && (!event.repeat || keys.has(key))) { keys.add(key); if (control === 'action' && !event.repeat) pendingAction = true; }
  });
  const releaseKey = event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; keys.delete(key); return key; };
  dialog.addEventListener('keyup', event => { const key = releaseKey(event); if (key === ' ' && event.target.closest('button, summary')) return; if (keyControl(key)) event.preventDefault(); });
  window.addEventListener('keyup', releaseKey);
  function releasePointer(event, cancelled = false) {
    const control = pointers.get(event.pointerId); pointers.delete(event.pointerId);
    if (cancelled && control === 'action') pendingAction = false;
    dialog.querySelectorAll('[data-piccolo-hold]').forEach(button => {
      if (![...pointers.values()].includes(button.dataset.piccoloHold)) button.removeAttribute('data-held');
    });
  }
  // Capture usually routes the release to its button. Window fallbacks also
  // cover releases after capture is lost, layout changes, or the pointer leaves.
  window.addEventListener('pointerup', event => releasePointer(event));
  window.addEventListener('pointercancel', event => releasePointer(event, true));
  window.addEventListener('pointermove', event => {
    if (['mouse', 'pen'].includes(event.pointerType) && event.buttons === 0) releasePointer(event, true);
  });
  dialog.querySelectorAll('[data-piccolo-hold]').forEach(button => {
    button.addEventListener('pointerdown', event => { if (event.button !== 0 || paused || game.phase !== 'playing') return; event.preventDefault(); pointers.set(event.pointerId, button.dataset.piccoloHold); if (button.dataset.piccoloHold === 'action') pendingAction = true; button.setPointerCapture(event.pointerId); button.dataset.held = 'true'; });
    button.addEventListener('pointerup', event => releasePointer(event)); button.addEventListener('pointercancel', event => releasePointer(event, true)); button.addEventListener('lostpointercapture', event => releasePointer(event, true));
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
  dialog.addEventListener('focusout', event => { if (!event.relatedTarget || !dialog.contains(event.relatedTarget)) clearInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialog.open) setPaused(true); });
  window.addEventListener('pagehide', () => { if (dialog.open) setPaused(true); stop(); });
  window.addEventListener('portfolio:view', () => { if (dialog.open) dialog.close(); });
  reduced.addEventListener('change', () => { if (dialog.open) draw(); });
  window.PortfolioPiccolo = Object.freeze({ open(trigger) { opener = trigger; if (!dialog.open) dialog.showModal(); root.dataset.training = 'open'; window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: true } })); update(); draw(); canvas.focus({ preventScroll: true }); dialog.scrollTop = 0; }, close() { dialog.close(); } });
})();
