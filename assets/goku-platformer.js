/* Goku / Cloud Trail. Original pixel scenery; fixed-step, local-only platform physics. */
(() => {
  'use strict';
  const WIDTH = 3400, HEIGHT = 360, GROUND = 306;
  // Three short regions: a forgiving foothill, stepped cloud bridges, then the shrine.
  // The 100px gaps fit comfortably inside the full jump's roughly 165px travel.
  const solids = [
    [0, GROUND, 680, 70], [780, GROUND, 540, 70], [1420, GROUND, 740, 70], [2256, GROUND, 544, 70], [2900, GROUND, 500, 70],
    [260, 246, 120, 18], [470, 212, 104, 18], [700, 244, 96, 18], [960, 246, 128, 18],
    [1194, 224, 100, 18], [1350, 242, 94, 18], [1510, 240, 85, 18], [1750, 220, 106, 18],
    [1960, 238, 116, 18], [2190, 242, 96, 18], [2410, 242, 112, 18], [2670, 238, 100, 18], [2825, 236, 96, 18], [3030, 236, 128, 18],
  ].map(([x, y, w, h]) => Object.freeze({ x, y, w, h }));
  const orbLocations = [[314, 224], [850, 280], [1236, 202], [1650, 280], [2006, 216], [2570, 280], [3086, 214]];
  const regions = Object.freeze([{ x: 0, name: 'BAMBOO FOOTHILLS' }, { x: 1120, name: 'CLOUD PASS' }, { x: 2260, name: 'SUNSET SHRINE' }]);
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function create() {
    return { width: WIDTH, height: HEIGHT, phase: 'ready', time: 0, lives: 3, score: 0, checkpoint: 80, event: 'ready', eventId: 0, camera: 0, shots: [], bursts: [],
      player: { x: 80, y: GROUND - 31, w: 20, h: 31, vx: 0, vy: 0, grounded: true, facing: 1, coyote: .1, buffer: 0, jumpHeld: false, immune: 0, cooldown: 0, fired: -10 },
      orbs: orbLocations.map(([x, y], i) => ({ x, y, w: 16, h: 16, collected: false, star: i + 1 })),
      enemies: [[510, 430, 610], [990, 880, 1060], [1850, 1730, 1940], [2520, 2450, 2690], [3210, 3160, 3270]].map(([x, left, right], i) => ({ x, y: GROUND - 20, w: 24, h: 20, left, right, vx: i % 2 ? -47 : 47, alive: true })),
    };
  }
  function event(game, name) { game.event = name; game.eventId++; }
  function start(game) { if (game.phase === 'ready') { game.phase = 'playing'; event(game, 'start'); } }
  function hurt(game) {
    if (game.player.immune > 0 || game.phase !== 'playing') return;
    game.lives--; event(game, game.lives ? 'respawn' : 'lost');
    game.shots = [];
    if (!game.lives) { game.phase = 'lost'; return; }
    Object.assign(game.player, { x: game.checkpoint, y: GROUND - 31, vx: 0, vy: 0, grounded: true, coyote: .1, buffer: 0, immune: 1.5, cooldown: .2 });
    game.camera = Math.max(0, Math.min(WIDTH - 640, game.checkpoint - 240));
  }
  function step(game, input = {}, dt = 1 / 120) {
    if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
    dt = Math.min(dt, 1 / 30); game.time += dt;
    const p = game.player, direction = Math.max(-1, Math.min(1, Number(input.direction) || 0));
    p.immune = Math.max(0, p.immune - dt);
    p.coyote = p.grounded ? .11 : Math.max(0, p.coyote - dt);
    if (input.jump && !p.jumpHeld) p.buffer = .14; else p.buffer = Math.max(0, p.buffer - dt);
    if (!input.jump && p.jumpHeld && p.vy < -180) p.vy *= .55;
    p.jumpHeld = Boolean(input.jump);
    const desired = direction * 220, acceleration = p.grounded ? direction ? 1700 : 2200 : 1100;
    p.vx += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - p.vx));
    if (direction) p.facing = direction;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -550; p.grounded = false; p.coyote = 0; p.buffer = 0; }
    const oldX = p.x, oldY = p.y;
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
    p.cooldown = Math.max(0, p.cooldown - dt);
    game.bursts = game.bursts.filter(burst => game.time - burst.at < .32);
    if (input.attack && p.cooldown === 0) {
      p.cooldown = .34; p.fired = game.time;
      game.shots.push({ x: p.x + p.w / 2 + p.facing * 14 - 5, y: p.y + 10, w: 10, h: 8, vx: p.facing * 510, life: .85 });
    }
    game.shots = game.shots.filter(shot => {
      shot.x += shot.vx * dt; shot.life -= dt;
      if (shot.life <= 0 || solids.some(tile => overlaps(shot, tile))) return false;
      const enemy = game.enemies.find(enemy => enemy.alive && overlaps(shot, enemy));
      if (enemy) {
        enemy.alive = false; game.score += 100;
        game.bursts.push({ x: enemy.x + 12, y: enemy.y + 8, at: game.time });
        event(game, 'blast'); return false;
      }
      return true;
    });
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.left) { enemy.x = enemy.left; enemy.vx = Math.abs(enemy.vx); }
      if (enemy.x > enemy.right) { enemy.x = enemy.right; enemy.vx = -Math.abs(enemy.vx); }
      if (!overlaps(p, enemy)) continue;
      if (p.vy > 0 && oldY + p.h <= enemy.y + 8) { enemy.alive = false; p.vy = input.jump ? -440 : -330; game.score += 100; game.bursts.push({ x: enemy.x + 12, y: enemy.y + 8, at: game.time }); event(game, 'stomp'); }
      else { hurt(game); break; }
    }
    if (p.y > HEIGHT + 70) { p.immune = 0; hurt(game); }
    if (game.phase !== 'playing') return game;
    for (const orb of game.orbs) if (!orb.collected && overlaps(p, orb)) { orb.collected = true; game.score += 250; event(game, 'orb'); }
    if (p.x >= 1600 && p.grounded && p.y + p.h === GROUND && game.checkpoint < 1540) { game.checkpoint = 1605; event(game, 'checkpoint'); }
    if (p.x > 3280 && game.orbs.every(orb => orb.collected)) { game.phase = 'won'; game.score += game.lives * 500; event(game, 'won'); }
    else if (p.x > 3270 && game.orbs.some(orb => !orb.collected) && game.event !== 'missing') event(game, 'missing');
    const cameraTarget = Math.max(0, Math.min(WIDTH - 640, p.x - 250 + p.facing * 36));
    game.camera += (cameraTarget - game.camera) * (1 - Math.exp(-dt * 7));
    return game;
  }
  const engine = Object.freeze({ WIDTH, HEIGHT, GROUND, solids, regions, create, start, step, overlaps });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('platformer-dialog'); if (!dialog) return;
  dialog.innerHTML = `<div class="console-heading"><div><span class="console-eyebrow">16-BIT / ACTION ADVENTURE</span><h2 id="platformer-title">goku<span>CLOUD TRAIL</span></h2></div><button type="button" data-platform-close aria-label="Close Goku platformer">esc</button></div>
    <div class="console-hud"><span>power <strong id="platform-score">0</strong></span><span>balls <strong id="platform-orbs">0 / 7</strong></span><span>lives <strong id="platform-lives">3</strong></span></div>
    <div class="platform-stage"><canvas id="platform-canvas" width="640" height="360" tabindex="0" aria-label="Goku Cloud Trail platform game" aria-describedby="platform-help platform-status">Run, jump, and collect seven Dragon Balls on the cloud trail. Use left and right arrows to move and Space to jump.</canvas></div>
    <p id="platform-status" role="status" aria-live="polite" aria-atomic="true">Collect seven Dragon Balls and reach the red gate. Start when you are ready.</p>
    <div class="platform-touch" aria-label="Game controls"><div><button type="button" data-platform-hold="left" aria-label="Move left">◀</button><button type="button" data-platform-hold="right" aria-label="Move right">▶</button></div><div class="platform-buttons"><button type="button" data-platform-hold="attack" aria-label="Fire ki blast">X <span>ki</span></button><button type="button" data-platform-hold="jump" aria-label="Jump">B <span>jump</span></button></div></div>
    <div class="console-actions"><button type="button" data-platform-back>← cartridges</button><button id="platform-action" type="button">start game ↵</button><button id="platform-pause" type="button" aria-pressed="false">pause</button></div>
    <details class="console-help"><summary>how to play / controls</summary><p id="platform-help">← → or A/D to run · Space, ↑ or W to jump · X to fire ki · P to pause. Hold jump for height. Bounce on patrol bots or blast a path. The orange halfway flag saves your checkpoint; collected balls stay with you. Escape returns to cartridges.</p></details>`;
  const root = document.documentElement, canvas = dialog.querySelector('#platform-canvas'), context = canvas.getContext('2d');
  if (!context) return;
  const status = dialog.querySelector('#platform-status'), action = dialog.querySelector('#platform-action'), pause = dialog.querySelector('#platform-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let game = create(), opener, frame = 0, lastTime = null, accumulator = 0, paused = false, lastEvent = -1;
  const keys = new Set(), pointers = new Map(), pendingActions = new Set(), pulses = new Set(), pulseTimers = new Map();
  const actionForKey = key => ({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', x: 'attack' }[key]);
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  const terminal = () => game.phase === 'won' || game.phase === 'lost';
  const held = control => [...keys].some(key => actionForKey(key) === control) || [...pointers.values()].includes(control) || pulses.has(control);
  const input = () => ({ direction: Number(held('right')) - Number(held('left')), jump: held('jump') || pendingActions.has('jump'), attack: held('attack') || pendingActions.has('attack') });
  const latch = control => { if (control === 'jump' || control === 'attack') pendingActions.add(control); };
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = null; accumulator = 0; }
  function releaseControls() {
    keys.clear(); pointers.clear(); pendingActions.clear(); pulses.clear();
    pulseTimers.forEach(timer => clearTimeout(timer)); pulseTimers.clear();
    dialog.querySelectorAll('[data-platform-hold]').forEach(button => button.removeAttribute('data-held'));
  }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  function announce() {
    const count = game.orbs.filter(orb => orb.collected).length;
    setText(dialog.querySelector('#platform-score'), String(game.score)); setText(dialog.querySelector('#platform-orbs'), `${count} / 7`); setText(dialog.querySelector('#platform-lives'), String(game.lives));
    setText(action, terminal() ? 'play again ↵' : game.phase === 'ready' ? 'start game ↵' : 'restart ↻');
    setText(pause, paused ? 'resume' : 'pause'); if (pause.getAttribute('aria-pressed') !== String(paused)) pause.setAttribute('aria-pressed', String(paused)); pause.disabled = game.phase === 'ready' || terminal();
    if (paused) status.textContent = 'Paused. Resume when you are ready.';
    else if (game.eventId !== lastEvent) {
      lastEvent = game.eventId;
      const messages = { ready: 'Collect seven Dragon Balls and reach the red gate. Start when you are ready.', start: 'Cloud Trail. Run, jump, and collect all seven Dragon Balls.', orb: `Dragon Ball ${count} of 7 collected.`, stomp: 'Bot bounced! +100 power.', blast: 'Ki hit! +100 power.', respawn: `${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left. Back at your checkpoint; collected balls are safe.`, checkpoint: 'Halfway checkpoint reached. Your collected balls stay with you.', missing: `${7 - count} Dragon ${7 - count === 1 ? 'Ball remains' : 'Balls remain'}. Follow the trail back to find them.`, won: `Wish granted! All seven Dragon Balls collected. ${game.score} power.`, lost: `Great effort. ${count} of seven Dragon Balls, ${game.score} power. Play again to try a new run.` };
      status.textContent = messages[game.event] || messages.start;
    }
  }
  function rect(x, y, w, h, color) { context.fillStyle = color; context.fillRect(Math.round(x), Math.round(y), w, h); }
  function text(label, x, y, size = 12, color = '#fff5d2', align = 'center') { context.font = `bold ${size}px monospace`; context.textAlign = align; context.fillStyle = color; context.fillText(label, Math.round(x), Math.round(y)); }
  // Small original sprite atlases: one drawing pixel stays one canvas pixel.
  // Build once on opening this cartridge, then reuse drawImage while playing.
  const spriteCache = new Map();
  function sprite(key, width, height, paint) {
    if (!spriteCache.has(key)) {
      const image = document.createElement('canvas'); image.width = width; image.height = height;
      const ctx = image.getContext('2d');
      const pixel = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
      paint(pixel); spriteCache.set(key, image);
    }
    return spriteCache.get(key);
  }
  function gokuSprite(pose) {
    return sprite(`goku-${pose}`, 40, 48, (r) => {
      const ink = '#1c1c35', hair = '#30334d', shine = '#4c4c68', skin = '#f4b87e', light = '#ffdda0', shade = '#bc704c';
      const orange = '#f47c2b', gold = '#ffb846', red = '#b83f36', blue = '#355998', pale = '#6594c5';
      const jumping = pose === 'jump' || pose === 'fall', shooting = pose === 'shot';
      const stride = /^run/.test(pose) ? Number(pose.at(-1)) : -1;
      // Boots and trouser folds use distinct silhouettes, not a sliding rectangle.
      if (jumping) {
        r(8,33,12,8,ink); r(10,34,9,5,orange); r(11,34,6,2,gold); r(5,39,13,6,ink); r(6,40,10,3,blue); r(5,44,11,2,pale);
        r(20,32,10,8,ink); r(21,34,7,4,orange); r(25,37,10,7,ink); r(26,38,7,4,blue); r(29,41,7,3,pale);
      } else if (stride === 0 || stride === 2) {
        const front = stride === 0;
        r(8,34,10,7,ink); r(9,35,8,5,orange); r(4,39,12,5,ink); r(5,40,9,3,red); r(1,43,13,5,ink); r(2,44,10,3,blue); r(2,46,11,1,pale);
        r(20,34,9,7,ink); r(21,35,6,4,front ? gold : orange); r(26,39,7,6,ink); r(27,40,5,3,orange); r(28,43,11,5,ink); r(29,44,9,3,blue); r(30,46,9,1,pale);
      } else {
        r(9,34,10,11,ink); r(10,35,8,8,orange); r(11,36,3,5,gold); r(15,38,3,5,red); r(7,43,12,5,ink); r(8,44,10,3,blue); r(8,46,10,1,pale);
        r(21,34,9,stride === 1 ? 8 : 11,ink); r(22,35,6,stride === 1 ? 5 : 8,orange); r(26,36,2,5,red); r(20,stride === 1 ? 40 : 43,13,5,ink); r(21,stride === 1 ? 41 : 44,11,3,blue); r(25,stride === 1 ? 43 : 46,7,1,pale);
      }
      // Gi: dark undershirt, tied belt, shaded orange cloth and a tiny back emblem.
      r(9,23,20,12,ink); r(11,22,16,14,orange); r(13,23,6,3,gold); r(23,25,4,9,red);
      r(19,21,8,4,blue); r(20,24,5,4,blue); r(20,23,3,2,pale); r(10,33,19,4,ink); r(10,33,18,2,blue); r(19,34,3,6,blue);
      r(12,26,6,6,'#fff0bf'); r(11,27,8,4,'#fff0bf'); r(14,27,1,4,ink); r(12,28,5,1,ink); r(13,30,4,1,ink);
      // Far arm and near arm change with the run, leap and firing poses.
      r(5,25,7,9,ink); r(6,26,5,6,skin); r(6,31,5,3,blue); r(5,34,6,3,shade);
      if (shooting) { r(26,25,12,7,ink); r(27,26,8,4,skin); r(29,26,3,4,blue); r(36,23,3,10,light); }
      else if (jumping) { r(27,18,6,13,ink); r(28,19,4,9,skin); r(28,24,4,3,blue); r(27,16,6,5,light); }
      else { const swing = stride === 1 ? -3 : stride === 3 ? 2 : 0; r(27,25+swing,7,10,ink); r(28,26+swing,5,7,skin); r(28,31+swing,5,3,blue); r(29,34+swing,5,3,light); }
      // Skin, ear, cheek and a single high contrast eye under the brow.
      r(13,12,15,11,ink); r(14,13,12,9,skin); r(16,14,10,4,light); r(12,16,4,5,shade); r(13,17,3,3,skin); r(20,21,5,3,shade);
      r(23,16,5,2,ink); r(24,18,3,2,'#fff9d8'); r(26,18,1,2,ink); r(26,20,3,1,skin); r(23,22,3,1,ink);
      // Goku's stepped, swept spikes are deliberately larger than the face.
      const runs = [[0,15,2],[1,15,3],[2,14,4],[3,5,2],[3,14,5],[3,25,2],[4,5,4],[4,13,6],[4,24,3],[5,6,5],[5,12,9],[5,23,4],[6,6,22],[7,4,24],[8,5,24],[9,6,24],[10,7,22],[11,7,21],[12,8,20],[13,9,18],[14,11,12],[15,12,6]];
      runs.forEach(([y,x,w]) => r(x,y,w,1,ink));
      r(14,5,3,5,hair); r(11,8,5,4,hair); r(17,7,7,5,hair); r(22,6,3,4,hair); r(9,10,5,2,shine); r(17,8,5,1,shine); r(24,9,3,2,shine);
    });
  }
  function botSprite(frame) {
    return sprite(`bot-${frame}`, 32, 26, r => {
      const dark='#272c53', edge='#47426b', mid='#77639a', light='#a88fbd';
      r(7,0,18,2,dark); r(4,2,24,4,dark); r(2,6,28,13,dark); r(5,19,22,3,dark);
      r(7,2,17,3,light); r(5,5,22,12,mid); r(6,5,17,2,light); r(24,7,3,10,edge); r(4,14,22,4,edge);
      r(5,8,22,6,dark); r(7,9,18,3,'#bde6d6'); r(11,9,3,3,'#ed6d79'); r(21,9,3,3,'#ed6d79');
      r(12,16,9,3,dark); r(14,17,5,1,light); r(0,10,3,7,edge); r(29,10,3,7,edge);
      r(frame ? 5 : 3,21,9,4,dark); r(frame ? 20 : 22,21,9,4,dark); r(frame ? 5 : 3,21,8,1,light); r(frame ? 20 : 22,21,8,1,light);
    });
  }
  function cloud(x, y, scale = 1) {
    const colors=['#d7d9e6','#eff0e8','#fff5dc'];
    rect(x,y+12*scale,80*scale,12*scale,colors[0]); rect(x+8*scale,y+5*scale,62*scale,16*scale,colors[1]);
    rect(x+20*scale,y,26*scale,17*scale,colors[2]); rect(x+47*scale,y+8*scale,23*scale,9*scale,colors[2]);
  }
  function mountain(x, base, width, height, color, lit) {
    for(let y=0;y<height;y+=10) {
      const half=Math.round((width/2)*(y/height)*.75+width*.08), center=x+width*.52;
      rect(center-half,base-height+y,half*2,10,color);
      rect(center-half,base-height+y,Math.max(3,half*.63),10,lit);
    }
  }
  function background(camera) {
    const sky=['#6579b2','#758bbf','#869dc9','#9aafcf','#b0c0d6','#c8cfd8','#dfd9d1','#efdfc5'];
    sky.forEach((color,i)=>rect(0,i*37,640,38,color));
    rect(485-camera*.025,45,36,34,'#f7e6bd'); rect(489-camera*.025,41,28,42,'#f7e6bd');
    // Far ridgelines, rock spires and bamboo are different depth planes.
    for(let i=-1;i<9;i++) mountain(i*150-camera*.12,282,220,100+(i%3)*31,'#8d98bb','#a4aec8');
    for(let i=-1;i<10;i++) mountain(i*190-camera*.27,306,155,110+((i+10)%4)*23,'#697f9d','#8595ac');
    for(let i=-1;i<11;i++) {
      const x=i*185-camera*.49, y=184+(i%3)*13;
      rect(x,y+16,66,132,'#4b737b'); rect(x+10,y,46,146,'#59838a'); rect(x+11,y,12,146,'#6d9694');
      rect(x+39,y+13,9,132,'#426773'); rect(x-8,y+36,80,7,'#658f87');
      for(let k=0;k<4;k++) { rect(x+8+k*11,y+28+(k%2)*27,4,31,'#466b78'); }
    }
    for(let i=-1;i<8;i++) cloud(i*179-camera*.18,38+((i+8)%3)*21,.75+(i%2)*.25);
    // The river stays below the collision plane; bright grass always means solid ground.
    rect(0,307,640,53,'#5b899c');
    for(let i=0;i<12;i++) rect((i*79-Math.round(camera*.65)%79),318+(i%4)*10,39,2,'#9dbbbf');
  }
  function terrain(tile,camera) {
    const x=Math.round(tile.x-camera), ground=tile.y===GROUND;
    if(x>640||x+tile.w<0)return;
    const shrine=tile.x>2250, base=shrine?'#947369':'#8b785d', shade=shrine?'#6c535e':'#59645a';
    rect(x,tile.y,tile.w,tile.h,shade); rect(x+2,tile.y+7,tile.w-4,tile.h-8,base);
    // Block seams and broken highlights are deterministic and do not shimmer.
    for(let dx=0;dx<tile.w;dx+=24) {
      rect(x+dx,tile.y+14,Math.min(21,tile.w-dx),2,shade);
      rect(x+dx+7,tile.y+15,2,Math.min(15,tile.h-15),shade);
      if(ground) { rect(x+dx+4,tile.y+28,14,3,'#b29472'); rect(x+dx+16,tile.y+39,2,16,shade); rect(x+dx+3,tile.y+52,17,2,shade); }
    }
    rect(x,tile.y,tile.w,3,'#344e51'); rect(x,tile.y-2,tile.w,3,shrine?'#d5cd8b':'#c3d784');
    rect(x,tile.y+2,tile.w,4,'#71945d'); rect(x+2,tile.y+6,tile.w-4,2,'#425f56');
    for(let dx=5;dx<tile.w-6;dx+=17) { rect(x+dx,tile.y-4,3,3,'#b5cf7d'); if(ground)rect(x+dx+4,tile.y+6,2,4,'#597a57'); }
  }
  function scenery(camera) {
    // Decorative bamboo lives behind the path; no trunk looks like a solid wall.
    for(const bx of [45,128,575,920,1460,2100,2320,2720,3190]) {
      const x=bx-camera, h=bx%3*15+70;
      if(x < -40 || x > 680) continue;
      rect(x,GROUND-h,5,h,'#376454'); rect(x+1,GROUND-h,2,h,'#73a270');
      for(let i=0;i<h;i+=18){rect(x-1,GROUND-h+i,7,2,'#9bbc7b');rect(x+5,GROUND-h+i+4,13,3,'#568969');rect(x+11,GROUND-h+i,10,3,'#568969');rect(x-13,GROUND-h+i+6,12,3,'#4c7c63');}
    }
    // A visible orange flag marks the safe ground where a respawn actually occurs.
    const cp=1605-camera; rect(cp,248,3,58,'#45486a'); rect(cp-3,304,10,3,'#d4c99c');
    rect(cp+3,248,26,16,game.checkpoint>80?'#f6b348':'#777b9a'); rect(cp+3,250,18,4,game.checkpoint>80?'#ffdd82':'#a3a4b5'); rect(cp+18,260,11,4,'#8a6357');
    const g=3295-camera;
    rect(g-32,215,9,91,'#633e54');rect(g+30,215,9,91,'#633e54');rect(g-31,219,4,85,'#d37867');rect(g+31,219,4,85,'#d37867');
    rect(g-43,208,94,11,'#7d4059');rect(g-47,203,102,6,'#df9a75');rect(g-39,199,86,4,'#f1c397');rect(g-33,235,72,7,'#a25760');rect(g-8,216,20,14,'#e5bb79');
    for(let i=0;i<3;i++)rect(g-30+i*31,306,28,3,'#c2b08e');
  }
  function ball(orb,x,y,small=false) {
    if(small) { rect(x+2,y,7,11,'#9b513f');rect(x,y+2,11,7,'#9b513f');rect(x+2,y+1,7,8,'#f8bd57');rect(x+2,y+2,3,2,'#fff0b1');return; }
    rect(x+4,y,9,17,'#9f4d3f');rect(x+1,y+3,15,11,'#9f4d3f');rect(x+4,y+1,9,15,'#ed9039');rect(x+2,y+4,13,9,'#f8b347');
    rect(x+4,y+2,7,3,'#ffe5a0');rect(x+3,y+5,2,4,'#ffe5a0');rect(x+11,y+12,2,2,'#d96d35');
    const stars=[[8,8],[6,7],[10,10],[10,6],[5,11],[12,8],[8,12]];
    stars.slice(0,orb.star).forEach(([sx,sy])=>rect(x+sx,y+sy,2,2,'#b84c40'));
  }
  function playerSprite(p,camera) {
    if(p.immune>0&&!quiet()&&Math.floor(game.time*12)%2)return;
    const pose=game.time-p.fired<.16?'shot':!p.grounded?p.vy<0?'jump':'fall':Math.abs(p.vx)>20&&!quiet()?`run${Math.floor(game.time*11)%4}`:'idle';
    context.save();context.translate(Math.round(p.x-camera+p.w/2),Math.round(p.y-17));context.scale(p.facing,1);
    context.drawImage(gokuSprite(pose),-20,0);context.restore();
  }
  function draw() {
    const camera=Math.round(game.camera);
    context.imageSmoothingEnabled=false;background(camera);scenery(camera);
    solids.forEach(tile=>terrain(tile,camera));
    for(const orb of game.orbs)if(!orb.collected)ball(orb,Math.round(orb.x-camera),Math.round(orb.y+(quiet()?0:Math.sin(game.time*3+orb.star)*2)));
    for(const enemy of game.enemies)if(enemy.alive){context.drawImage(botSprite(quiet()?0:Math.floor(game.time*6)%2),Math.round(enemy.x-camera-4),Math.round(enemy.y-5));}
    for(const shot of game.shots){const x=shot.x-camera;rect(x-(shot.vx>0?8:-8),shot.y+2,12,4,'#f7c35e');rect(x,shot.y,10,8,'#fff1a1');rect(x+2,shot.y+2,6,4,'#fffce0');}
    playerSprite(game.player,camera);
    if(!quiet())for(const burst of game.bursts){const age=(game.time-burst.at)/.32;for(let i=0;i<8;i++){const angle=i*Math.PI/4;rect(burst.x-camera+Math.cos(angle)*age*25,burst.y+Math.sin(angle)*age*25,3,3,i%2?'#ffe5a0':'#e99d58');}}
    // A subdued foreground edge adds depth without covering any walking surface.
    for(let i=0;i<10;i++){const x=i*91-(camera%91);rect(x,349,21,11,'#345865');rect(x+8,342,5,18,'#345865');rect(x+13,347,11,3,'#557a76');}
    const region=[...regions].reverse().find(region=>game.player.x>=region.x);
    rect(10,10,182,22,'#293652');text(region.name,19,25,10,'#e8e4c8','left');
    rect(500,10,130,22,'#293652');game.orbs.forEach((orb,i)=>{if(orb.collected)ball(orb,509+i*16,15,true);else{rect(511+i*16,17,7,7,'#54647e');rect(513+i*16,19,3,3,'#a6adba');}});
    const missing=game.orbs.find(orb=>!orb.collected), target=missing?missing.x:3295;
    const distance=target-camera;
    if(game.phase==='playing'&&!paused&&(distance<24||distance>612))text(`${distance<24?'◀':'▶'} ${missing?`BALL ${missing.star}`:'GATE'}`,distance<24?18:622,53,10,'#fff2bc',distance<24?'left':'right');
    if(game.phase==='ready'||terminal()||paused){
      rect(101,105,438,144,'#29334b');rect(105,109,430,136,'#60617f');rect(109,113,422,128,'#343b58');rect(113,117,414,2,'#aaa3b0');
      text(paused?'PAUSED':game.phase==='won'?'WISH GRANTED!':game.phase==='lost'?'ONE MORE JOURNEY?':'GOKU / CLOUD TRAIL',320,151,22,'#ffe8a6');
      text(paused?'Take your time. The trail will wait.':game.phase==='won'?`${game.score} POWER · ALL SEVEN FOUND`:game.phase==='lost'?'Collected courage. Try the trail again.':'Seven Dragon Balls, beyond the cloud pass.',320,181,11,'#dce0e5');
      text(paused?'P / resume':terminal()?'Enter / play again':'Space / start · X / ki blast',320,214,11,'#c6badf');
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
    stop(); releaseControls(); if (game.phase !== 'ready') game = create(); paused = false; lastEvent = -1;
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
    const control = actionForKey(key); if (!control || (key === ' ' && event.target.closest('button'))) return;
    event.preventDefault(); event.stopPropagation();
    if (control === 'jump' && game.phase === 'ready' && !event.repeat) begin();
    if (!paused && game.phase === 'playing') { keys.add(key); if (!event.repeat) latch(control); }
  });
  dialog.addEventListener('keyup', event => { if (event.key === ' ' && event.target.closest('button')) return; const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (actionForKey(key)) { event.preventDefault(); keys.delete(key); } });
  dialog.querySelectorAll('[data-platform-hold]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return; event.preventDefault();
      if (game.phase === 'ready') begin();
      if (paused || terminal()) return;
      const control = button.dataset.platformHold; pointers.set(event.pointerId, control); latch(control); button.setPointerCapture(event.pointerId); button.dataset.held = 'true';
    });
    const release = event => { pointers.delete(event.pointerId); button.removeAttribute('data-held'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    // Native button activation remains useful to switch users: a brief move/jump.
    button.addEventListener('click', event => {
      if (event.detail !== 0 || paused || terminal()) return;
      if (game.phase === 'ready') begin();
      const control = button.dataset.platformHold; pulses.add(control); latch(control);
      clearTimeout(pulseTimers.get(control));
      pulseTimers.set(control, setTimeout(() => { pulses.delete(control); pulseTimers.delete(control); }, control === 'jump' ? 220 : 160));
    });
  });
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
