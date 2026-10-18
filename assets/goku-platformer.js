/* Goku / Cloud Trail. Original cel-shaded 2.5D art; fixed-step local platform physics. */
(() => {
  'use strict';
  const WIDTH = 6000, HEIGHT = 360, GROUND = 306, GOAL = 5860, DASH_RANGE = 190, DASH_SPEED = 820;
  // Every gap has a bridge within a full jump. Ground and raised surfaces share
  // one collision model: a visible ledge is solid from every direction.
  const solids = [
    [0, GROUND, 680, 70], [780, GROUND, 540, 70], [1420, GROUND, 740, 70], [2256, GROUND, 544, 70], [2900, GROUND, 600, 70],
    [3600, GROUND, 700, 70], [4400, GROUND, 640, 70], [5140, GROUND, 860, 70],
    [260, 246, 120, 18], [470, 212, 104, 18], [700, 244, 96, 18], [960, 246, 128, 18],
    [1194, 224, 100, 18], [1350, 242, 94, 18], [1510, 240, 85, 18], [1750, 220, 106, 18],
    [1960, 238, 116, 18], [2190, 242, 96, 18], [2410, 242, 112, 18], [2670, 238, 100, 18], [2825, 236, 96, 18], [3030, 236, 128, 18],
    [3530, 242, 98, 18], [3680, 236, 120, 18], [3930, 218, 116, 18], [4230, 240, 98, 18],
    [4340, 242, 96, 18], [4590, 236, 120, 18], [4860, 224, 104, 18], [5070, 242, 98, 18], [5290, 246, 112, 18],
  ].map(([x, y, w, h]) => Object.freeze({ x, y, w, h }));
  const orbLocations = [[314, 224], [1236, 202], [2006, 216], [3086, 214], [3734, 214], [4644, 214], [5460, 280]];
  // Reusable movement rings form optional high routes above the same safe trail.
  // Scoring is once per ring per run, so circling back never farms a record.
  const ringLocations = [[205, 238], [420, 174], [555, 154], [695, 190],
    [1060, 178], [1435, 174], [1590, 150], [1750, 153], [1900, 174],
    [3160, 170], [3315, 151], [3470, 165], [3620, 183],
    [4800, 160], [4980, 155], [5150, 171], [5435, 188], [5580, 178]];
  const regions = Object.freeze([{ x: 0, name: 'BAMBOO COAST' }, { x: 1420, name: 'CLOUD PASS' }, { x: 3300, name: 'AMBER CANYON' }, { x: 5140, name: 'SKY TEMPLE' }]);
  const checkpoints = Object.freeze([1605, 3390, 5170]);
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function create() {
    const enemies = [[510, 430, 610], [990, 880, 1060], [1850, 1730, 1940], [2520, 2450, 2690], [3210, 3160, 3270], [4110, 4050, 4170]]
      .map(([x, left, right], i) => ({ kind: 'patrol', x, y: GROUND - 20, w: 24, h: 20, left, right, vx: i % 2 ? -47 : 47, alive: true, hp: 1, maxHp: 1, hit: 0 }));
    enemies.push({ kind: 'hover', x: 3870, y: 245, baseY: 245, w: 28, h: 24, left: 3820, right: 3910, vx: 36, alive: true, hp: 2, maxHp: 2, hit: 0 });
    enemies.push({ kind: 'sentry', x: 4785, y: GROUND - 30, w: 29, h: 30, left: 4785, right: 4785, vx: 0, alive: true, hp: 2, maxHp: 2, hit: 0, cooldown: 1.2 });
    enemies.push({ kind: 'guardian', x: 5660, y: GROUND - 52, w: 44, h: 52, left: 5610, right: 5740, vx: -24, alive: true, hp: 6, maxHp: 6, hit: 0, cooldown: 1.7 });
    enemies.forEach((enemy, index) => { enemy.id = `enemy-${index}`; });
    return { width: WIDTH, height: HEIGHT, phase: 'ready', time: 0, lives: 3, score: 0, chain: 0, longestChain: 0, scored: [],
      breakdown: { targets: 0, chain: 0, finish: 0 }, rushes: 0, connections: 0, checkpoint: 80, event: 'ready', eventId: 0, camera: 0, shots: [], hazards: [], bursts: [],
      player: { x: 80, y: GROUND - 31, w: 20, h: 31, vx: 0, vy: 0, grounded: true, facing: 1, coyote: .1, buffer: 0, jumpHeld: false, attackHeld: false, dashReady: true, dash: null, airTargets: [], immune: 0, cooldown: 0, fired: -10 },
      orbs: orbLocations.map(([x, y], i) => ({ id: `ball-${i}`, x, y, w: 16, h: 16, collected: false, star: i + 1 })),
      rings: ringLocations.map(([x, y], i) => ({ id: `ring-${i}`, x, y, w: 14, h: 14 })), enemies,
    };
  }
  function event(game, name) { game.event = name; game.eventId++; }
  function start(game) { if (game.phase === 'ready') { game.phase = 'playing'; event(game, 'start'); } }
  function hurt(game) {
    if (game.player.immune > 0 || game.phase !== 'playing') return false;
    game.lives--; event(game, game.lives ? 'respawn' : 'lost');
    game.shots = []; game.hazards = []; game.chain = 0; game.player.dash = null; game.player.airTargets = []; game.player.dashReady = true;
    if (!game.lives) { game.phase = 'lost'; return true; }
    Object.assign(game.player, { x: game.checkpoint, y: GROUND - 31, vx: 0, vy: 0, grounded: true, coyote: .1, buffer: 0, immune: 1.5, cooldown: .2 });
    game.camera = Math.max(0, Math.min(WIDTH - 640, game.checkpoint - 240));
    return true;
  }
  function hitEnemy(game, enemy, kind) {
    if (!enemy.alive || enemy.hit > 0) return;
    enemy.hp--; enemy.hit = .18;
    game.bursts.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, at: game.time });
    if (enemy.hp <= 0) {
      enemy.alive = false; award(game, enemy.id, enemy.kind === 'guardian' ? 1000 : 100, false);
      event(game, enemy.kind === 'guardian' ? 'guardian-down' : kind);
    } else event(game, enemy.kind === 'guardian' ? 'guardian-hit' : 'armor-hit');
  }
  function award(game, id, base, chained) {
    if (game.scored.includes(id)) return 0;
    game.scored.push(id);
    if (chained) { game.chain++; game.longestChain = Math.max(game.longestChain, game.chain); }
    const multiplier = chained ? Math.min(game.chain, 8) : 1, points = base * multiplier;
    game.breakdown.targets += base; game.breakdown.chain += points - base; game.score += points;
    return points;
  }
  const center = actor => ({ x: actor.x + actor.w / 2, y: actor.y + actor.h / 2 });
  const targetPoint = target => ({ x: target.actor.x + target.actor.w / 2, y: target.actor.y + target.actor.h / 2 - (target.kind === 'ring' ? 0 : 10) });
  function dashTargets(game) {
    return [...game.rings.map(actor => ({ id: actor.id, kind: 'ring', actor })),
      ...game.orbs.filter(actor => !actor.collected).map(actor => ({ id: actor.id, kind: 'ball', actor })),
      ...game.enemies.filter(actor => actor.alive).map(actor => ({ id: actor.id, kind: 'enemy', actor }))];
  }
  function freeBody(game, x, y) {
    const p = game.player;
    return x >= 0 && x + p.w <= WIDTH && y >= 42 && !solids.some(tile => overlaps({ x, y, w: p.w, h: p.h }, tile));
  }
  function clearDashPath(game, destination) {
    const p = game.player, origin = center(p), distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
    const count = Math.max(1, Math.ceil(distance / 3));
    for (let i = 1; i <= count; i++) {
      if (!freeBody(game, p.x + (destination.x - origin.x) * i / count, p.y + (destination.y - origin.y) * i / count)) return false;
    }
    return true;
  }
  function targetForDash(game) {
    const p = game.player;
    if (game.phase !== 'playing' || p.grounded || !p.dashReady || p.dash) return null;
    const origin = center(p);
    return dashTargets(game).filter(target => !p.airTargets.includes(target.id)).map(target => {
      const point = targetPoint(target), dx = point.x - origin.x, dy = point.y - origin.y;
      return { ...target, point, distance: Math.hypot(dx, dy), forward: dx * p.facing, rank: Math.hypot(dx, dy) + Math.abs(dy) * .18 };
    }).filter(target => target.forward >= 8 && target.distance <= DASH_RANGE && clearDashPath(game, target.point))
      .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))[0] || null;
  }
  function launchDash(game) {
    const p = game.player; if (p.grounded || !p.dashReady || p.dash) return false;
    const target = targetForDash(game), origin = center(p);
    const dx = target ? target.point.x - origin.x : p.facing, dy = target ? target.point.y - origin.y : 0;
    const length = Math.max(1, Math.hypot(dx, dy));
    p.dash = { target: target?.id || null, vx: dx / length * DASH_SPEED, vy: dy / length * DASH_SPEED, left: target ? .30 : .15 };
    p.dashReady = false; p.vy = 0; p.buffer = 0; p.coyote = 0; game.rushes++;
    event(game, target ? 'rush' : 'rush-miss'); return true;
  }
  function connectDash(game, target) {
    const p = game.player;
    p.airTargets.push(target.id); p.dash = null; p.dashReady = true; p.vy = -335; p.vx = p.facing * 205; p.immune = Math.max(p.immune, .24);
    game.connections++;
    const points = award(game, target.id, target.kind === 'ball' ? 250 : target.actor.kind === 'guardian' ? 1000 : 100, true);
    if (target.kind === 'ball') target.actor.collected = true;
    if (target.kind === 'enemy') hitEnemy(game, target.actor, 'blast');
    game.bursts.push({ ...targetPoint(target), at: game.time });
    event(game, points ? 'chain' : 'refill');
  }
  function advanceDash(game, dt) {
    const p = game.player, dash = p.dash; if (!dash) return;
    const target = dashTargets(game).find(target => target.id === dash.target), origin = center(p);
    const point = target ? targetPoint(target) : null;
    const distance = point ? Math.hypot(point.x - origin.x, point.y - origin.y) : Infinity;
    if (point && distance > 0) { dash.vx = (point.x - origin.x) / distance * DASH_SPEED; dash.vy = (point.y - origin.y) / distance * DASH_SPEED; }
    const travel = Math.min(DASH_SPEED * dt, distance), dx = dash.vx / DASH_SPEED * travel, dy = dash.vy / DASH_SPEED * travel;
    // Sweep in <=3px slices, including at the engine's largest accepted step.
    // A rush never jumps across a wall, ceiling or the side of a platform.
    const slices = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    for (let i = 0; i < slices; i++) {
      if (!freeBody(game, p.x + dx / slices, p.y + dy / slices)) { p.dash = null; p.vx = 0; p.vy = 25; event(game, 'rush-blocked'); return; }
      p.x += dx / slices; p.y += dy / slices;
    }
    if (target && distance <= DASH_SPEED * dt + .1) { connectDash(game, target); return; }
    dash.left -= dt;
    if (dash.left <= 0) { p.dash = null; p.vx = p.facing * 220; p.vy = 30; }
  }
  function step(game, input = {}, dt = 1 / 120) {
    if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
    dt = Math.min(dt, 1 / 30); game.time += dt;
    const p = game.player, direction = Math.max(-1, Math.min(1, Number(input.direction) || 0));
    const wasGrounded = p.grounded, attackPressed = Boolean(input.attackPressed) || Boolean(input.attack) && !p.attackHeld;
    p.attackHeld = Boolean(input.attack); p.immune = Math.max(0, p.immune - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.coyote = p.grounded ? .11 : Math.max(0, p.coyote - dt);
    if (input.jump && !p.jumpHeld) p.buffer = .14; else p.buffer = Math.max(0, p.buffer - dt);
    if (!input.jump && p.jumpHeld && p.vy < -180 && !p.dash) p.vy *= .55;
    p.jumpHeld = Boolean(input.jump);
    if (direction && !p.dash) p.facing = direction;
    // Ground/air intent is sampled before this frame's jump. Holding B while
    // jumping never silently turns a shot into a rush; air rush needs a new tap.
    if (attackPressed && wasGrounded && p.cooldown === 0) {
      p.cooldown = .24; p.fired = game.time;
      game.shots.push({ x: p.x + p.w / 2 + p.facing * 14 - 5, y: p.y + 10, w: 10, h: 8, vx: p.facing * 510, life: .85 });
    } else if (attackPressed && !wasGrounded) launchDash(game);
    const oldX = p.x, oldY = p.y;
    if (p.dash) advanceDash(game, dt);
    else {
      const desired = direction * 220, acceleration = p.grounded ? direction ? 1700 : 2200 : 1100;
      p.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - p.vx));
      if (p.buffer > 0 && p.coyote > 0) { p.vy = -550; p.grounded = false; p.coyote = 0; p.buffer = 0; }
      p.x = Math.max(0, Math.min(WIDTH - p.w, p.x + p.vx * dt));
      for (const tile of solids) if (overlaps(p, tile)) {
        if (oldX + p.w <= tile.x + .1) { p.x = tile.x - p.w; p.vx = 0; }
        else if (oldX >= tile.x + tile.w - .1) { p.x = tile.x + tile.w; p.vx = 0; }
      }
      p.vy = Math.min(720, p.vy + 1450 * dt); p.y += p.vy * dt; p.grounded = false;
      for (const tile of solids) if (overlaps(p, tile)) {
        if (p.vy >= 0 && oldY + p.h <= tile.y + 1) { p.y = tile.y - p.h; p.vy = 0; p.grounded = true; }
        else if (p.vy < 0 && oldY >= tile.y + tile.h - 1) { p.y = tile.y + tile.h; p.vy = 0; }
      }
      if (p.grounded) { p.dashReady = true; p.airTargets = []; game.chain = 0; }
    }
    game.bursts = game.bursts.filter(burst => game.time - burst.at < .32);
    for (const enemy of game.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.left) { enemy.x = enemy.left; enemy.vx = Math.abs(enemy.vx); }
      if (enemy.x > enemy.right) { enemy.x = enemy.right; enemy.vx = -Math.abs(enemy.vx); }
      if (enemy.kind === 'hover') enemy.y = enemy.baseY + Math.sin(game.time * 2.1) * 12;
      if (enemy.kind === 'sentry' || enemy.kind === 'guardian') {
        const nearby = Math.abs(enemy.x - p.x) < 420;
        // Waiting enemies do not bank a volley; entering range always leaves a
        // readable wind-up. The last .35s is drawn as a charging indicator.
        if (nearby) enemy.cooldown = Math.max(0, enemy.cooldown - dt);
        if (nearby && enemy.cooldown === 0) {
          const facing = p.x < enemy.x ? -1 : 1;
          game.hazards.push({ x: enemy.x + enemy.w / 2 + facing * 23, y: GROUND - 19, w: 12, h: 10, vx: facing * (enemy.kind === 'guardian' ? 175 : 145), life: 3 });
          enemy.cooldown = enemy.kind === 'guardian' ? 1.6 : 2.1;
        }
      }
    }
    game.shots = game.shots.filter(shot => {
      shot.x += shot.vx * dt; shot.life -= dt;
      if (shot.life <= 0 || solids.some(tile => overlaps(shot, tile))) return false;
      const enemy = game.enemies.find(enemy => enemy.alive && overlaps(shot, enemy));
      if (enemy) { hitEnemy(game, enemy, 'blast'); return false; }
      const hazard = game.hazards.find(hazard => hazard.life > 0 && overlaps(shot, hazard));
      if (hazard) { hazard.life = 0; game.bursts.push({ x: shot.x, y: shot.y, at: game.time }); return false; }
      return true;
    });
    let damaged = false;
    game.hazards = game.hazards.filter(hazard => {
      hazard.x += hazard.vx * dt; hazard.life -= dt;
      if (hazard.life <= 0 || solids.some(tile => overlaps(hazard, tile))) return false;
      if (overlaps(p, hazard)) { if (p.immune <= 0 && !p.dash) damaged = true; return false; }
      return true;
    });
    // Resolve damage outside filter: respawn clears every projectile reliably.
    if (damaged && hurt(game)) return game;
    for (const enemy of game.enemies) {
      if (!enemy.alive || p.dash || !overlaps(p, enemy)) continue;
      if (p.vy > 0 && oldY + p.h <= enemy.y + 8) {
        hitEnemy(game, enemy, 'stomp'); p.vy = input.jump ? -440 : -330;
      } else if (hurt(game)) return game;
    }
    if (p.y > HEIGHT + 70) { p.immune = 0; hurt(game); return game; }
    for (const orb of game.orbs) if (!orb.collected && overlaps(p, orb)) {
      if (p.dash) connectDash(game, { id: orb.id, kind: 'ball', actor: orb });
      else { orb.collected = true; award(game, orb.id, 250, false); event(game, 'orb'); }
    }
    for (const checkpoint of checkpoints) if (p.x >= checkpoint && p.grounded && p.y + p.h === GROUND && game.checkpoint < checkpoint) {
      game.checkpoint = checkpoint; event(game, 'checkpoint');
    }
    const guardian = game.enemies.find(enemy => enemy.kind === 'guardian');
    if (p.x > GOAL && game.orbs.every(orb => orb.collected) && !guardian.alive) { game.phase = 'won'; game.breakdown.finish = game.lives * 500; game.score += game.breakdown.finish; event(game, 'won'); }
    else if (p.x > GOAL - 10) {
      const nextEvent = game.orbs.some(orb => !orb.collected) ? 'missing' : 'guardian';
      if (game.event !== nextEvent) event(game, nextEvent);
    }
    const cameraTarget = Math.max(0, Math.min(WIDTH - 640, p.x - 250 + p.facing * 36));
    game.camera += (cameraTarget - game.camera) * (1 - Math.exp(-dt * 7));
    return game;
  }
  const RECORD_KEY = 'portfolio:goku-ki-rush:v1';
  const MAX_CHAIN = ringLocations.length + orbLocations.length + 9;
  const validRun = run => Boolean(run && Number.isSafeInteger(run.score) && run.score >= 0 && run.score <= 1000000
    && Number.isSafeInteger(run.chain) && run.chain >= 0 && run.chain <= MAX_CHAIN
    && Number.isSafeInteger(run.timeMs) && run.timeMs >= 1000 && run.timeMs <= 3600000);
  function validateRecord(value) {
    if (!value || value.version !== 1 || !validRun(value.best) || !validRun(value.previous)
      || !Number.isSafeInteger(value.longestChain) || value.longestChain < Math.max(value.best.chain, value.previous.chain) || value.longestChain > MAX_CHAIN
      || !Number.isSafeInteger(value.fastestMs) || value.fastestMs < 1000 || value.fastestMs > Math.min(value.best.timeMs, value.previous.timeMs)
      || value.best.score < value.previous.score) return null;
    const copy = run => ({ score: run.score, chain: run.chain, timeMs: run.timeMs });
    return { version: 1, best: copy(value.best), longestChain: value.longestChain, fastestMs: value.fastestMs, previous: copy(value.previous) };
  }
  function loadRecord(storage) {
    try { const raw = storage?.getItem(RECORD_KEY); return typeof raw === 'string' && raw.length <= 2048 ? validateRecord(JSON.parse(raw)) : null; }
    catch { return null; }
  }
  function completedRun(game) {
    if (game.phase !== 'won' || !game.orbs.every(orb => orb.collected) || game.enemies.some(enemy => enemy.kind === 'guardian' && enemy.alive)) return null;
    const result = { score: game.score, chain: game.longestChain, timeMs: Math.round(game.time * 1000) };
    return validRun(result) ? result : null;
  }
  function recordFinish(storage, game, previous = null, previousSaved = true) {
    const result = completedRun(game); if (!result) return null;
    // Another tab may have finished since this one opened. Merge both sources,
    // including session records that could not be written, before saving.
    const local = validateRecord(previous), stored = loadRecord(storage);
    const better = (a, b) => !a || b && (b.score > a.score || b.score === a.score && b.timeMs < a.timeMs) ? b : a;
    const previousBest = better(local?.best || null, stored?.best || null);
    const priorRun = (!previousSaved && local?.previous) || stored?.previous || local?.previous || null;
    const best = better(previousBest, result);
    const record = { version: 1, best, longestChain: Math.max(local?.longestChain || 0, stored?.longestChain || 0, result.chain), fastestMs: Math.min(local?.fastestMs || Infinity, stored?.fastestMs || Infinity, result.timeMs), previous: result };
    let saved = false;
    try { if (storage) { storage.setItem(RECORD_KEY, JSON.stringify(record)); saved = true; } } catch { /* A full or disabled store never interrupts play. */ }
    return { record, previous: priorRun, previousBest, result, saved };
  }
  const engine = Object.freeze({ WIDTH, HEIGHT, GROUND, GOAL, DASH_RANGE, solids, regions, checkpoints, create, start, step, overlaps, targetForDash, clearDashPath, RECORD_KEY, MAX_CHAIN, validateRecord, loadRecord, completedRun, recordFinish });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('platformer-dialog'); if (!dialog) return;
  dialog.innerHTML = `<div class="console-heading"><div><span class="console-eyebrow">00s CONSOLE / CEL-SHADED ADVENTURE</span><h2 id="platformer-title">goku <span>KI RUSH</span></h2></div><button type="button" data-platform-close aria-label="Close Goku platformer">esc</button></div>
    <div class="console-hud"><span>score <strong id="platform-score">0</strong></span><span>balls <strong id="platform-orbs">0 / 7</strong></span><span>lives <strong id="platform-lives">3</strong></span><span>stage <strong id="platform-region">1 / 4</strong></span></div>
    <div class="platform-mastery"><span id="platform-ki" data-ready="true">● KI READY</span><span>chain <strong id="platform-chain">0</strong> / best <strong id="platform-chain-best">0</strong></span><span id="platform-record">first run</span></div>
    <div class="platform-stage"><canvas id="platform-canvas" width="1280" height="720" tabindex="0" aria-label="Goku Ki Rush platform game" aria-describedby="platform-help platform-status">Run, jump, and collect seven Dragon Balls on the cloud trail. Use left and right arrows to move and Space to jump.</canvas></div>
    <p id="platform-status" role="status" aria-live="polite" aria-atomic="true">Jump with A, then tap B toward a glowing target. Chain targets for points; collect seven balls and beat the guardian.</p>
    <section id="platform-results" class="platform-results" hidden aria-label="Run results"><strong id="platform-result-total"></strong><span id="platform-result-run"></span><span id="platform-result-points"></span><span id="platform-result-compare"></span><span id="platform-result-records"></span></section>
    <div class="platform-touch" aria-label="Game controls"><div><button type="button" data-platform-hold="left" aria-label="Move left">◀</button><button type="button" data-platform-hold="right" aria-label="Move right">▶</button></div><div class="platform-buttons"><button type="button" data-platform-hold="attack" aria-label="B: ki shot on ground; rush in air">B <span>rush</span></button><button type="button" data-platform-hold="jump" aria-label="A: jump">A <span>jump</span></button></div></div>
    <div class="console-actions"><button type="button" data-platform-back>← cartridges</button><button id="platform-action" type="button">start game ↵</button><button id="platform-pause" type="button" aria-pressed="false">pause</button></div>
    <details class="console-help"><summary>how to play / controls</summary><p id="platform-help">← → or A/D to run · A / Space, ↑ or W to jump · B / X: ground shot or air rush · P to pause. Tap B again after jumping; holding it never auto-rushes. A target ring marks a clear dash path. Each connection lifts you and restores ki; a miss needs a landing. Land or take a hit to end the chain. Each target scores once per run, ×1 up to ×8 in a chain. Hollow rings still refill ki. Collect seven balls, defeat the guardian, then enter the red gate. Three flags save progress. Completed score, chain and time records stay on this device. Escape returns to cartridges.</p></details>`;
  const root = document.documentElement, canvas = dialog.querySelector('#platform-canvas'), context = canvas.getContext('2d');
  if (!context) return;
  const status = dialog.querySelector('#platform-status'), action = dialog.querySelector('#platform-action'), pause = dialog.querySelector('#platform-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const storage = () => { try { return window.localStorage; } catch { return null; } };
  let record = loadRecord(storage()), recordSaved = true, finish = null;
  let game = create(), opener, frame = 0, lastTime = null, accumulator = 0, paused = false, lastEvent = -1;
  const keys = new Set(), pointers = new Map(), pendingActions = new Set(), pulses = new Set(), pulseTimers = new Map();
  const actionForKey = key => ({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', x: 'attack' }[key]);
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  const terminal = () => game.phase === 'won' || game.phase === 'lost';
  const held = control => [...keys].some(key => actionForKey(key) === control) || [...pointers.values()].includes(control) || pulses.has(control);
  const input = () => ({ direction: Number(held('right')) - Number(held('left')), jump: held('jump') || pendingActions.has('jump'), attack: held('attack') || pendingActions.has('attack'), attackPressed: pendingActions.has('attack') });
  const latch = control => { if (control === 'jump' || control === 'attack') pendingActions.add(control); };
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = null; accumulator = 0; }
  function releaseControls() {
    keys.clear(); pointers.clear(); pendingActions.clear(); pulses.clear();
    pulseTimers.forEach(timer => clearTimeout(timer)); pulseTimers.clear();
    dialog.querySelectorAll('[data-platform-hold]').forEach(button => button.removeAttribute('data-held'));
  }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  const formatTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
  function announce() {
    const count = game.orbs.filter(orb => orb.collected).length;
    dialog.dataset.phase = game.phase;
    if (game.phase === 'won' && !finish) { finish = recordFinish(storage(), game, record, recordSaved); if (finish) { record = finish.record; recordSaved = finish.saved; } }
    setText(dialog.querySelector('#platform-chain'), String(game.chain));
    setText(dialog.querySelector('#platform-chain-best'), String(game.longestChain));
    const ki = dialog.querySelector('#platform-ki'); ki.dataset.ready = String(game.player.dashReady);
    setText(ki, game.player.dash ? '◆ RUSHING' : game.player.dashReady ? '● KI READY' : '○ LAND TO REFILL');
    setText(dialog.querySelector('#platform-record'), record ? `record ${record.best.score}` : 'first run');
    const resultPanel = dialog.querySelector('#platform-results'); resultPanel.hidden = !terminal();
    if (terminal()) {
      setText(dialog.querySelector('#platform-result-total'), `${game.phase === 'won' ? 'CLEAR' : 'TRY AGAIN'} · ${game.score} POINTS`);
      setText(dialog.querySelector('#platform-result-run'), `chain ${game.longestChain} · ${formatTime(game.time * 1000)}`);
      setText(dialog.querySelector('#platform-result-points'), `${game.breakdown.targets} targets + ${game.breakdown.chain} chain + ${game.breakdown.finish} finish`);
      setText(dialog.querySelector('#platform-result-compare'), finish?.previous ? `Previous ${finish.previous.score} (${game.score - finish.previous.score >= 0 ? '+' : ''}${game.score - finish.previous.score}) · best ${record.best.score}${game.score > (finish.previousBest?.score ?? -1) ? ' NEW' : ''}` : finish ? `First clear · best ${record.best.score}` : 'Finish the course to set a record.');
      setText(dialog.querySelector('#platform-result-records'), finish ? `Best chain ${record.longestChain} · fastest ${formatTime(record.fastestMs)} · ${finish.saved ? 'saved here' : 'session only'}` : record ? `Best clear ${record.best.score} · chain ${record.longestChain}` : 'Land safely, then build another chain.');
    }
    setText(dialog.querySelector('#platform-score'), String(game.score)); setText(dialog.querySelector('#platform-orbs'), `${count} / 7`); setText(dialog.querySelector('#platform-lives'), String(game.lives));
    setText(dialog.querySelector('#platform-region'), `${regions.filter(region => game.player.x >= region.x).length} / 4`);
    setText(action, terminal() ? 'play again ↵' : game.phase === 'ready' ? 'start game ↵' : 'restart ↻');
    setText(pause, paused ? 'resume' : 'pause'); if (pause.getAttribute('aria-pressed') !== String(paused)) pause.setAttribute('aria-pressed', String(paused)); pause.disabled = game.phase === 'ready' || terminal();
    if (paused) status.textContent = 'Paused. Resume when you are ready.';
    else if (game.eventId !== lastEvent) {
      lastEvent = game.eventId;
      const messages = { ready: 'Jump with A, then tap B toward a glowing target. Chain targets for points; collect seven balls and beat the guardian.', start: 'First lesson: jump toward the blue ring, then tap B / X. A connection lifts you and refills ki.', rush: 'Ki Rush! Release B, then tap again when the next target glows.', 'rush-miss': 'Free rush used. Land to refill ki.', 'rush-blocked': 'Ledge blocked the rush. Land to refill ki.', chain: `${game.chain}-target chain! Ki refilled. Tap B toward the next target.`, refill: 'Ki refilled. This target already scored; find a bright new one.', orb: `Dragon Ball ${count} of 7 collected.`, stomp: 'Bot bounced! Keep moving.', blast: 'Ki hit! Target cleared.', respawn: `${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left. Back at your checkpoint; collected balls are safe.`, checkpoint: `Checkpoint ${checkpoints.indexOf(game.checkpoint) + 1} of 3 reached. Balls and defeated enemies stay saved.`, missing: `${7 - count} Dragon ${7 - count === 1 ? 'Ball remains' : 'Balls remain'}. Follow the trail back to find them.`, 'armor-hit': 'Armored bot hit. Keep firing or bounce again.', 'guardian-hit': `Sky Guardian hit. ${game.enemies.find(enemy => enemy.kind === 'guardian').hp} hits remain.`, 'guardian-down': 'Sky Guardian defeated! Reach the red gate to complete your journey.', guardian: 'The Sky Guardian still stands. Turn back and use ki or jump on its head.', won: `Wish granted! All seven Dragon Balls collected. ${game.score} points.`, lost: `Run ended. ${count} of seven Dragon Balls, ${game.score} points. Play again to try a new run.` };
      status.textContent = messages[game.event] || messages.start;
    }
  }
  function rect(x, y, w, h, color) { context.fillStyle = color; context.fillRect(x, y, w, h); }
  function text(label, x, y, size = 12, color = '#fff5d2', align = 'center') {
    context.font = `bold ${size}px system-ui, sans-serif`; context.textAlign = align; context.fillStyle = color; context.fillText(label, x, y);
  }
  function poly(points, fill, stroke = '#23384b', width = 1.2) {
    context.beginPath(); points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y)); context.closePath();
    context.fillStyle = fill; context.fill();
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke(); }
  }
  function oval(x, y, rx, ry, fill, stroke = null, width = 1) {
    context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke(); }
  }
  function line(points, color, width = 1) {
    context.beginPath(); points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.strokeStyle = color; context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  }
  function cloud(x, y, scale = 1) {
    context.save(); context.translate(x, y); context.scale(scale, scale);
    context.beginPath(); context.moveTo(-45, 14); context.bezierCurveTo(-60, -3, -29, -15, -18, -8);
    context.bezierCurveTo(-10, -32, 24, -28, 28, -8); context.bezierCurveTo(59, -15, 67, 13, 41, 18);
    context.closePath(); context.fillStyle = '#edf5ed'; context.fill();
    context.beginPath(); context.moveTo(-45, 14); context.bezierCurveTo(-12, 9, 23, 22, 47, 11); context.lineTo(41, 18); context.closePath(); context.fillStyle = '#b8d8de'; context.fill(); context.restore();
  }
  function mountain(x, base, width, height, color, lit) {
    const peak = x + width * .47;
    poly([[x, base], [x + width * .15, base - height * .42], [peak, base - height], [x + width * .69, base - height * .59], [x + width, base]], color, null);
    poly([[x, base], [peak, base - height], [x + width * .43, base - height * .37], [x + width * .67, base]], lit, null);
    poly([[peak, base - height], [x + width * .58, base - height * .75], [x + width * .43, base - height * .69]], '#d6e6db', null);
  }
  function background(camera) {
    const sky = context.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#2787b9'); sky.addColorStop(.54, '#89cbd9'); sky.addColorStop(1, '#f7dfb3');
    rect(0, 0, 640, 360, sky); oval(505 - camera * .018, 60, 28, 28, '#fff2c6');
    for (let i = -1; i < 8; i++) cloud(i * 185 - (camera * .09 % 185), 64 + ((i + 8) % 3) * 20, .6 + (i % 2) * .14);
    for (let i = -1; i < 8; i++) mountain(i * 180 - (camera * .16 % 180), 305, 250, 112 + ((i + 9) % 3) * 38, '#769fb3', '#a1c1c8');
    for (let i = -1; i < 7; i++) mountain(i * 205 - (camera * .32 % 205), 336, 242, 124 + ((i + 8) % 3) * 26, '#48798d', '#72a49f');
    // Tall faceted rock islands establish a near plane and a distant river.
    for (let i = -1; i < 7; i++) {
      const x = i * 157 - (camera * .48 % 157), y = 204 + ((i + 9) % 3) * 17;
      poly([[x, 332], [x + 7, y], [x + 43, y - 13], [x + 77, y + 4], [x + 90, 332]], '#477b80', null);
      poly([[x + 7, y], [x + 43, y - 13], [x + 35, 332], [x, 332]], '#73a091', null);
      poly([[x + 7, y], [x + 43, y - 13], [x + 77, y + 4], [x + 42, y + 11]], '#aed0a1', null);
    }
    rect(0, 315, 640, 45, '#41839b');
    for (let i = 0; i < 14; i++) line([[i * 61 - (camera * .64 % 61), 325 + (i % 3) * 12], [i * 61 + 31 - (camera * .64 % 61), 325 + (i % 3) * 12]], '#9fc9cf', 1.5);
  }
  function terrain(tile, camera) {
    const x = tile.x - camera, y = tile.y, w = tile.w, h = tile.h, canyon = tile.x > 3300 && tile.x < 5140;
    if (x > 660 || x + w < -20) return;
    const top = canyon ? '#e7cb8d' : '#a6db78', face = canyon ? '#bb8666' : '#8b9d77', shade = canyon ? '#8c5b58' : '#4e7566';
    // The front edge is exactly the collision plane; the top recedes into depth.
    poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], face, '#36585c', 1.5);
    poly([[x, y], [x + 14, y - 12], [x + w + 14, y - 12], [x + w, y]], top, '#3b6562', 1.3);
    poly([[x + w, y], [x + w + 14, y - 12], [x + w + 14, y + h - 12], [x + w, y + h]], shade, '#36585c', 1.3);
    for (let dx = 0; dx < w; dx += 79) {
      const span = Math.min(79, w - dx);
      poly([[x + dx, y + h], [x + dx + span * .38, y + 7], [x + dx + span, y + h * .61], [x + dx + span, y + h]], shade, null);
      if (h > 20) poly([[x + dx + span * .38, y + 7], [x + dx + span * .17, y + h * .55], [x + dx + span * .63, y + h * .4]], canyon ? '#d4a27b' : '#aec099', null);
    }
    line([[x, y + 1], [x + w, y + 1]], canyon ? '#fff0bb' : '#daf0ad', 3);
    line([[x, y + 5], [x + w, y + 5]], canyon ? '#a37652' : '#539553', 3);
  }
  function scenery(camera) {
    for (const bx of [45,128,575,920,1460,2100,2320,2720,3190]) {
      const x = bx - camera, h = 62 + bx % 3 * 14;
      if (x < -40 || x > 680) continue;
      poly([[x, GROUND], [x + 2, GROUND - h], [x + 7, GROUND - h], [x + 8, GROUND]], '#477f58', '#30564c');
      line([[x + 3, GROUND - h + 2], [x + 3, GROUND - 4]], '#9cc67d', 2);
      for (let k = 0; k < 3; k++) { const y = GROUND - h + 14 + k * 18; poly([[x + 5, y], [x + 23, y - 10], [x + 31, y - 8], [x + 13, y + 2]], '#659769', null); poly([[x + 3, y + 4], [x - 18, y - 1], [x - 24, y + 3], [x - 8, y + 9]], '#457d61', null); }
    }
    for (const cp of checkpoints) {
      const x = cp - camera, active = game.checkpoint >= cp; if (x < -45 || x > 685) continue;
      oval(x + 9, GROUND + 3, 21, 5, '#35584e'); poly([[x - 4, GROUND], [x + 7, GROUND - 8], [x + 27, GROUND - 8], [x + 19, GROUND]], '#c6d1ae');
      line([[x + 6, 247], [x + 6, GROUND - 4]], '#344e6b', 3);
      poly([[x + 7, 248], [x + 35, 254], [x + 28, 270], [x + 7, 264]], active ? '#ffbf53' : '#7086a2', '#354e6a');
      text(active ? '✓' : String(checkpoints.indexOf(cp) + 1), x + 18, 263, 12, '#fff5d4');
    }
    // Temple silhouette, raised roof and pillars all share the same depth axis.
    const g = GOAL + 15 - camera;
    if (g > -100 && g < 740) {
      poly([[g - 52, 306], [g - 35, 290], [g + 64, 290], [g + 49, 306]], '#b5c7bb');
      for (const dx of [-35, 31]) { poly([[g + dx, 218], [g + dx + 9, 218], [g + dx + 9, 302], [g + dx, 302]], '#ce6959'); poly([[g + dx + 9, 218], [g + dx + 16, 211], [g + dx + 16, 295], [g + dx + 9, 302]], '#7c4653'); }
      poly([[g - 55, 218], [g - 36, 201], [g + 48, 201], [g + 63, 218]], '#313d5a');
      poly([[g - 55, 218], [g - 36, 211], [g + 50, 211], [g + 63, 218]], '#f0bb77');
      poly([[g - 28, 240], [g + 40, 240], [g + 40, 247], [g - 28, 247]], '#bd6057');
      oval(g + 6, 232, 9, 11, '#ffe0a0', '#694958', 1.5);
    }
  }
  function ball(orb, x, y, small = false) {
    const r = small ? 5.3 : 8, cx = x + (small ? 5 : 8), cy = y + (small ? 5 : 8);
    if (!small) oval(cx, cy, 12, 12, '#ffe0a025');
    oval(cx, cy, r, r, '#ffb443', '#8a5638', small ? 1 : 1.4);
    context.save(); context.beginPath(); context.ellipse(cx, cy, r - 1, r - 1, 0, 0, Math.PI * 2); context.clip();
    oval(cx + 4, cy + 5, r, r, '#df8137'); oval(cx - 3, cy - 3, r * .48, r * .27, '#ffeaa3'); context.restore();
    if (!small) {
      const positions = [[0,0],[-3,-3],[3,3],[3,-3],[-3,3],[0,-4],[0,4]];
      positions.slice(0, orb.star).forEach(([dx,dy]) => poly([[cx+dx,cy+dy-1.5],[cx+dx+1.4,cy+dy],[cx+dx,cy+dy+1.5],[cx+dx-1.4,cy+dy]], '#ad4830', null));
    }
  }
  function playerSprite(p, camera) {
    const blinking = p.immune > 0 && !quiet() && Math.floor(game.time * 12) % 2;
    if (blinking) return;
    const feet = p.y + p.h, running = p.grounded && Math.abs(p.vx) > 20, stride = running && !quiet() ? Math.sin(game.time * 15) : 0;
    const shooting = Boolean(p.dash) || game.time - p.fired < .18, jump = !p.grounded;
    oval(p.x - camera + p.w / 2 + 3, feet + 2, 16, 3.8, '#173f4c45');
    context.save(); context.translate(p.x - camera + p.w / 2, feet); context.scale(p.facing, 1);
    const ink = '#28334b', orange = '#fc8527', light = '#ffbf5c', shade = '#bb4f35', blue = '#294c86', skin = '#f3ba88';
    function limb(points, color, width = 7, lit = null) { line(points, ink, width + 2.6); line(points, color, width); if (lit) line(points.map(([x,y])=>[x-1,y-1]), lit, Math.max(1.5,width*.3)); }
    // Far limbs, torso, then near limbs create a readable articulated silhouette.
    limb([[-4,-28],[-11,-21-stride*3],[-9,-15-stride*5]], '#bd795f', 5);
    const backKnee = jump ? [-10,-12] : [-4-stride*7,-10], backFoot = jump ? [-17,-13] : [-4-stride*11,-3];
    limb([[-4,-18],backKnee,backFoot], shade, 8); limb([backFoot,[backFoot[0]+6,backFoot[1]]], blue, 5, '#6994bc');
    const knee = jump ? [10,-13] : [5+stride*6,-10], foot = jump ? [16,-6] : [5+stride*11,-3];
    limb([[4,-18],knee,foot], orange, 8, light); limb([foot,[foot[0]+6,foot[1]]], blue, 5, '#7ab2cf');
    poly([[-8,-35],[6,-36],[11,-27],[7,-17],[-8,-17],[-12,-27]], orange, ink, 1.8);
    poly([[-8,-34],[-3,-35],[2,-22],[-6,-21],[-10,-28]], light, null);
    poly([[4,-34],[9,-29],[7,-18],[2,-19]], shade, null);
    poly([[-2,-35],[6,-36],[7,-31],[1,-28]], blue, ink, 1);
    poly([[-9,-21],[8,-21],[8,-17],[-9,-17]], blue, ink, 1);
    poly([[1,-19],[5,-18],[10,-9],[6,-9]], '#386a9c', ink, .8);
    oval(-5,-28,3.8,4.1,'#fff0c9',ink,.7); line([[-7,-28],[-3,-28]],ink,.7); line([[-5,-30],[-5,-26]],ink,.7);
    if (shooting) { limb([[8,-31],[17,-28],[24,-28]],skin,5.5,'#ffddb2'); limb([[16,-28],[19,-28]],blue,6); oval(25,-28,3.2,4.5,'#ffddb2',ink,1); }
    else if (jump) { limb([[7,-31],[13,-37],[15,-42]],skin,5,'#ffddb2'); limb([[14,-38],[15,-41]],blue,6); }
    else { limb([[8,-31],[12,-23+stride*5],[14,-18+stride*7]],skin,5.5,'#ffd6a4'); limb([[13,-21+stride*6],[14,-18+stride*7]],blue,6); }
    oval(2,-41,8.1,9.2,skin,ink,1.5); poly([[5,-46],[9,-43],[10,-39],[7,-34],[3,-33],[4,-40]],'#d88b67',null);
    oval(-5,-40,2.4,3.2,'#f3ba88',ink,1); line([[5,-42],[9,-42]],ink,1.5); line([[7,-40],[9,-40]],'#fff8db',2); line([[9,-41],[9,-39]],ink,1); line([[7,-36],[9,-36]],ink,.8);
    poly([[-7,-41],[-12,-45],[-8,-46],[-14,-51],[-7,-49],[-8,-57],[-2,-52],[3,-62],[5,-54],[12,-57],[10,-50],[15,-51],[11,-44],[4,-46],[0,-43],[-3,-47]],'#242c40',ink,1.4);
    poly([[-7,-49],[-3,-51],[-1,-47],[3,-55],[3,-48],[8,-51],[6,-46],[1,-46]],'#455066',null);
    context.restore();
  }
  function enemySprite(enemy, camera) {
    const x = enemy.x - camera, y = enemy.y, boss = enemy.kind === 'guardian', w = enemy.w, h = enemy.h;
    if (x < -60 || x > 690) return;
    const flash = enemy.hit > 0 && !quiet(), shell = flash ? '#fff2b4' : boss ? '#74588d' : enemy.kind === 'sentry' ? '#a76470' : '#7189a7';
    oval(x + w / 2 + 3, enemy.kind === 'hover' ? GROUND + 1 : y + h + 2, w * .65, 4, '#24485845');
    poly([[x+2,y+7],[x+w*.25,y],[x+w*.78,y],[x+w,y+9],[x+w-2,y+h-4],[x+w*.6,y+h],[x+4,y+h-3]],shell,'#2b3650',1.8);
    poly([[x+w*.25,y],[x+w*.78,y],[x+w,y+9],[x+w*.42,y+7]],boss?'#ba9cc7':'#b2cbd4',null);
    poly([[x+w*.7,y+9],[x+w,y+9],[x+w-2,y+h-4],[x+w*.7,y+h-1]],boss?'#4d406d':'#455f7e',null);
    poly([[x+4,y+h*.31],[x+w-4,y+h*.31],[x+w-5,y+h*.53],[x+4,y+h*.53]],'#24364d',null);
    line([[x+7,y+h*.41],[x+w-8,y+h*.41]],boss?'#f4b173':'#95e4dc',boss?4:2.5);
    if (enemy.kind === 'hover') { poly([[x+6,y+h],[x+10,y+h+7],[x+15,y+h]],'#a3eddf',null); poly([[x+w-14,y+h],[x+w-10,y+h+7],[x+w-6,y+h]],'#a3eddf',null); }
    else { poly([[x+3,y+h-3],[x+12,y+h-3],[x+13,y+h+3],[x,y+h+3]],'#354764'); poly([[x+w-12,y+h-3],[x+w-3,y+h-3],[x+w+2,y+h+3],[x+w-12,y+h+3]],'#354764'); }
    if (boss || enemy.kind === 'sentry') {
      const charging = enemy.cooldown < .35 && Math.abs(enemy.x-game.player.x)<420;
      oval(x+w/2,y+h*.70,boss?7:4,boss?7:4,charging?'#ffe19b':'#f19763','#493c59',1.2);
      if (charging) { oval(x+w/2,y+h*.70,boss?11:7,boss?11:7,'#ffd28340'); text('!',x+w/2,y-9,17,'#ffe2a0'); }
    }
    if (enemy.maxHp>1) { rect(x,y-6,w,3,'#253a55'); rect(x,y-6,w*enemy.hp/enemy.maxHp,3,boss?'#e7ab70':'#a4d8d0'); }
  }
  function draw() {
    context.setTransform(2, 0, 0, 2, 0, 0); context.imageSmoothingEnabled = true;
    const camera = game.camera;
    background(camera); scenery(camera); solids.forEach(tile => terrain(tile, camera));
    for (const ring of game.rings) {
      const x = ring.x - camera + 7, y = ring.y + 7; if (x < -20 || x > 660) continue;
      const claimed = game.scored.includes(ring.id), used = game.player.airTargets.includes(ring.id);
      oval(x,y,11,11,claimed?'#70b8bf14':'#8de3e32a',used?'#648d9a':claimed?'#8cbac1':'#b6fbdf',used?1:2);
      if(!claimed) poly([[x,y-6],[x+5,y],[x,y+6],[x-5,y]],'#b7ffe9','#3a879b',1);
      else oval(x,y,3,3,'#96cbd0');
    }
    for (const orb of game.orbs) if (!orb.collected) ball(orb,orb.x-camera,orb.y+(quiet()?0:Math.sin(game.time*3+orb.star)*2));
    for (const enemy of game.enemies) if (enemy.alive) enemySprite(enemy,camera);
    for (const hazard of game.hazards) { oval(hazard.x-camera+6,hazard.y+5,9,7,'#f4777650'); oval(hazard.x-camera+6,hazard.y+5,6,5,'#ef987d','#785169',1); }
    for (const shot of game.shots) {
      const x=shot.x-camera, cy=shot.y+4;
      poly([[x+5,cy-5],[x-(shot.vx>0?20:-26),cy],[x+5,cy+5]],'#ffcc6c70',null);
      oval(x+5,cy,9,7,'#ffe09a80'); oval(x+5,cy,6,4,'#fffce0');
    }
    const lock = targetForDash(game);
    if (lock && !paused) {
      const point = lock.point, x = point.x-camera, y=point.y;
      if (!quiet()) {
        const origin=center(game.player), length=Math.hypot(point.x-origin.x,point.y-origin.y);
        for(let t=14;t<length-17;t+=14) { const u=t/length, v=Math.min(1,(t+5)/length); line([[origin.x-camera+(point.x-origin.x)*u,origin.y+(point.y-origin.y)*u],[origin.x-camera+(point.x-origin.x)*v,origin.y+(point.y-origin.y)*v]],'#d9ffdb80',1); }
      }
      for(const dx of [-1,1])for(const dy of [-1,1])line([[x+dx*17,y+dy*9],[x+dx*17,y+dy*17],[x+dx*9,y+dy*17]],'#f4ffc6',2);
      text('B',x,y-23,12,'#f4ffc6');
    }
    if(game.player.dash&&!quiet()) {
      const p=game.player, c=center(p); line([[c.x-camera-p.dash.vx*.05,c.y-p.dash.vy*.05],[c.x-camera,c.y]],'#b2f6ee60',13);
      line([[c.x-camera-p.dash.vx*.04,c.y-p.dash.vy*.04],[c.x-camera,c.y]],'#eaffdaaa',3);
    }
    playerSprite(game.player,camera);
    if (!quiet()) for (const burst of game.bursts) {
      const age=(game.time-burst.at)/.32;
      for(let i=0;i<7;i++){const angle=i*Math.PI/3.5, x=burst.x-camera+Math.cos(angle)*age*27,y=burst.y+Math.sin(angle)*age*25; poly([[x,y-3*(1-age)],[x+3*(1-age),y],[x,y+3*(1-age)],[x-3*(1-age),y]],'#ffe2a1',null);}
    }
    // Lightweight translucent mission HUD leaves the jump and landing plane clear.
    const region=[...regions].reverse().find(region=>game.player.x>=region.x);
    poly([[10,10],[212,10],[200,39],[10,39]],'#213e57df','#9ac7ce80',1);
    text(region.name,21,29,13,'#ecf5e2','left');
    poly([[493,10],[630,10],[630,39],[482,39]],'#263953df','#a6bccb80',1);
    game.orbs.forEach((orb,i)=>{if(orb.collected)ball(orb,502+i*17,20,true);else oval(507+i*17,25,4.3,4.3,'#748ba4','#b2c9ce',.7);});
    const guardian=game.enemies.find(enemy=>enemy.kind==='guardian'), missing=game.orbs.find(orb=>!orb.collected);
    const target=missing?missing.x:guardian.alive?guardian.x:GOAL+15, distance=target-camera;
    if(game.phase==='playing'&&!paused&&(distance<24||distance>612)) text(`${distance<24?'◀':'▶'} ${missing?`BALL ${missing.star}`:guardian.alive?'GUARDIAN':'GATE'}`,distance<24?18:622,58,12,'#fff2bc',distance<24?'left':'right');
    if(guardian.alive&&Math.abs(game.player.x-guardian.x)<450){
      rect(211,14,218,22,'#23394ddd');text('SKY GUARDIAN',320,29,11,'#f0d5ad');rect(219,39,202,5,'#253b53');rect(219,39,202*guardian.hp/guardian.maxHp,5,'#e9a66a');
    }
    if(game.phase==='playing'&&!paused&&game.player.x<680&&game.connections<2){
      rect(16,69,300,32,'#244559dd');text(game.connections?'Release B. Tap again at the next target.':'Jump → aim right → tap B at the blue ring.',26,89,11,'#e9ffcf','left');
    }
    if(game.phase==='ready'||terminal()||paused){
      rect(0,0,640,360,'#18344d55');
      poly([[107,97],[541,97],[526,251],[92,251]],'#243953ed','#bdd9d3',1.5);
      poly([[107,97],[541,97],[537,118],[105,118]],'#5e6d9c','#a7b9d0',1);
      text(paused?'SYSTEM / PAUSE':terminal()?'MISSION / RESULTS':'ONE COURSE / BUILD YOUR BEST CHAIN',320,112,10,'#e7f0e5');
      text(paused?'TAKE A BREATHER':game.phase==='won'?'WISH GRANTED':game.phase==='lost'?'ONE MORE JOURNEY?':'GOKU / KI RUSH',320,158,25,'#ffdf9f');
      text(paused?'The trail will be here when you return.':game.phase==='won'?`${game.score} POINTS · LONGEST CHAIN ${game.longestChain}`:game.phase==='lost'?'Your next journey starts with a fresh slate.':'Jump. Tap B at a target. Rise. Chain the next.',320,188,12,'#e0eae7');
      oval(242,219,10,10,'#48bc94','#c5f3ca',1);text('A',242,223,12,'#163e42');
      text(paused?'P / RESUME':terminal()?'ENTER / PLAY AGAIN':'START · A / JUMP · B / RUSH',338,224,11,'#dae5f0');
    }
  }
  function schedule() { if (!frame && dialog.open && !document.hidden && !paused && game.phase === 'playing') frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0; if (!dialog.open || document.hidden || paused) { lastTime = null; return; }
    const elapsed = lastTime === null ? 0 : Math.min(.1, Math.max(0, (now - lastTime) / 1000)); lastTime = now; accumulator += elapsed;
    // Keep an action edge until a physics tick consumes it, even if a quick tap
    // starts and ends between animation frames. A release still gives a short jump.
    while (accumulator >= 1 / 120) { step(game, input(), 1 / 120); pendingActions.clear(); accumulator -= 1 / 120; }
    announce(); draw(); schedule();
  }
  function begin() {
    stop(); releaseControls(); if (game.phase !== 'ready') game = create(); finish = null; paused = false; lastEvent = -1;
    start(game); announce(); draw(); schedule(); canvas.focus({ preventScroll: true });
  }
  function setPaused(next) {
    if (game.phase !== 'playing') return;
    paused = next; releaseControls(); stop(); lastEvent = -1; announce(); draw(); if (!paused) schedule();
  }
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p') { event.preventDefault(); if (!event.repeat) setPaused(!paused); return; }
    if (key === 'Enter' && (terminal() || game.phase === 'ready') && event.target === canvas) { event.preventDefault(); begin(); return; }
    if (event.repeat && !keys.has(key)) return;
    const control = actionForKey(key); if (!control || (key === ' ' && event.target.closest('button, summary'))) return;
    event.preventDefault(); event.stopPropagation();
    if (control === 'jump' && game.phase === 'ready' && !event.repeat) begin();
    if (!paused && game.phase === 'playing') { keys.add(key); if (!event.repeat) latch(control); }
  });
  dialog.addEventListener('keyup', event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; keys.delete(key); if (key === ' ' && event.target.closest('button, summary')) return; if (actionForKey(key)) event.preventDefault(); });
  dialog.querySelectorAll('[data-platform-hold]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return; event.preventDefault();
      if (game.phase === 'ready') begin();
      if (paused || terminal()) return;
      const control = button.dataset.platformHold; pointers.set(event.pointerId, control); latch(control); button.setPointerCapture(event.pointerId); button.dataset.held = 'true';
    });
    const release = event => { pointers.delete(event.pointerId); if (![...pointers.values()].includes(button.dataset.platformHold)) button.removeAttribute('data-held'); };
    button.addEventListener('pointerup', release);
    const cancel = event => {
      const control = pointers.get(event.pointerId); release(event);
      if (control && !held(control)) pendingActions.delete(control);
    };
    button.addEventListener('pointercancel', cancel); button.addEventListener('lostpointercapture', cancel);
    // Native button activation remains useful to switch users: a brief move/jump.
    button.addEventListener('click', event => {
      if (event.detail !== 0 || paused || terminal()) return;
      if (game.phase === 'ready') begin();
      const control = button.dataset.platformHold; pulses.add(control); latch(control);
      clearTimeout(pulseTimers.get(control));
      pulseTimers.set(control, setTimeout(() => { pulses.delete(control); pulseTimers.delete(control); }, control === 'jump' ? 220 : 160));
    });
  });
  // A browser can release a captured pointer or a key outside the dialog.
  // Global release handlers clear physical input without stealing native keys.
  window.addEventListener('keyup', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  });
  const releasePointer = (event, cancelled) => {
    const control = pointers.get(event.pointerId); pointers.delete(event.pointerId);
    if (!control) return;
    if (cancelled && !held(control)) pendingActions.delete(control);
    if (![...pointers.values()].includes(control)) dialog.querySelectorAll('[data-platform-hold]').forEach(button => {
      if (button.dataset.platformHold === control) button.removeAttribute('data-held');
    });
  };
  window.addEventListener('pointerup', event => releasePointer(event, false));
  window.addEventListener('pointercancel', event => releasePointer(event, true));
  action.addEventListener('click', begin); pause.addEventListener('click', () => setPaused(!paused));
  const back = () => window.PortfolioGames?.run('choose', opener);
  dialog.querySelector('[data-platform-back]').addEventListener('click', back);
  dialog.querySelector('[data-platform-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); back(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; stop(); releaseControls(); if (game.phase === 'playing') paused = true;
    const other = ['arcade-dialog', 'training-dialog', 'piccolo-dialog', 'goku-dialog', 'game-loading-dialog'].some(id => document.getElementById(id)?.open);
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
