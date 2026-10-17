// Small, deterministic rules shared by the UI and tests. No storage or network.
(() => {
  const orbPaths = ['/assets/dragon-ball-1.webp', '/assets/dragon-ball-2.webp', '/assets/dragon-ball-3.webp', '/assets/dragon-ball-4.webp', '/assets/dragon-ball-5.webp', '/assets/dragon-ball-6.webp', '/assets/dragon-ball-7.webp'];
  const bands = [[56, 78], [42, 61], [68, 84], [49, 63], [73, 85]];
  const level = elapsed => Math.min(100, Math.max(0, elapsed / 22));
  function release(round, elapsed) {
    const power = level(elapsed), [low, high] = bands[round % bands.length];
    return { power, hit: power >= low && power <= high, perfect: Math.abs(power - (low + high) / 2) <= 3 };
  }
  function field(random = Math.random) {
    const cells = Array.from({ length: 36 }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells.slice(0, 7);
  }
  function ping(targets, found, index) {
    const remaining = targets.filter(i => !found.includes(i));
    if (remaining.includes(index)) return { found: true, distance: 0, label: 'signal found' };
    const distance = Math.min(...remaining.map(i => Math.abs(i % 6 - index % 6) + Math.abs(Math.floor(i / 6) - Math.floor(index / 6))));
    return { found: false, distance, label: distance <= 1 ? 'hot · one step away' : distance <= 2 ? 'warm · two steps away' : 'cold · keep searching' };
  }
  const rules = Object.freeze({ bands, level, release, field, ping });
  if (typeof module !== 'undefined') module.exports = rules;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('arcade-dialog');
  if (!dialog) return;
  const root = document.documentElement, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const title = document.getElementById('arcade-title'), status = document.getElementById('arcade-status');
  const ki = document.getElementById('ki-game'), radar = document.getElementById('radar-game');
  const action = document.getElementById('ki-charge'), meter = document.getElementById('ki-meter');
  const powerText = document.getElementById('ki-power'), target = document.getElementById('ki-target');
  const picker = document.getElementById('arcade-picker'), back = document.getElementById('arcade-back');
  const score = document.getElementById('arcade-score'), grid = document.getElementById('hunt-grid');
  const canvas = document.getElementById('ki-canvas'), ctx = canvas.getContext('2d');
  let mode = 'ki', opener, frame = 0, started = null, round = 0, hits = 0, energy = 0;
  let targets = [], found = [], scanned = new Map(), scans = 0, resultAt = 0, resultHit = false, pressStarted = false;
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  function announce(text) { status.textContent = text; }
  function stop() { cancelAnimationFrame(frame); frame = 0; started = null; action.textContent = round >= 5 ? 'train again' : 'charge ki'; action.setAttribute('aria-pressed', 'false'); }
  function draw(now = performance.now()) {
    if (!ctx || !dialog.open || mode !== 'ki') return;
    ctx.clearRect(0, 0, 360, 230);
    const t = quiet() ? 0 : now / 1000, p = energy / 100, burst = quiet() ? 0 : Math.max(0, 1 - (now - resultAt) / 700);
    const glow = ctx.createRadialGradient(180, 126, 2, 180, 126, 135);
    glow.addColorStop(0, `rgba(101,240,255,${.10 + p * .35})`); glow.addColorStop(1, 'rgba(50,100,180,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 360, 230);
    ctx.strokeStyle = '#29475d'; ctx.lineWidth = 1;
    for (let y = 172; y < 230; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = -180; x <= 540; x += 60) { ctx.beginPath(); ctx.moveTo(180 + (x - 180) * .25, 168); ctx.lineTo(x, 230); ctx.stroke(); }
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath(); ctx.strokeStyle = ring === 1 ? '#ffbd79' : '#83e8f1'; ctx.globalAlpha = .25 + p * .5;
      ctx.ellipse(180, 126, 28 + p * 48 + ring * 15, 19 + p * 28 + ring * 12, t * .4 + ring, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.399 + t * .7, radius = 30 + ((i * 19 + t * 35) % 85);
      const x = 180 + Math.cos(angle) * radius, y = 126 + Math.sin(angle) * radius * .7;
      ctx.fillStyle = i % 3 ? '#82eaf3' : '#ffbd79'; ctx.globalAlpha = (.15 + p * .75) * (1 - radius / 150);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1; ctx.shadowColor = '#69e9ff'; ctx.shadowBlur = 12 + p * 20;
    ctx.fillStyle = '#ddfcff'; ctx.beginPath(); ctx.arc(180, 126, 7 + p * 19, 0, Math.PI * 2); ctx.fill();
    if (burst && resultHit) { ctx.fillStyle = `rgba(185,250,255,${burst * .8})`; ctx.fillRect(180, 126 - burst * 21, 180, burst * 42); }
    ctx.shadowBlur = 0; ctx.fillStyle = '#afc4d6'; ctx.font = '10px "Plex Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText(round >= 5 ? 'TRAINING COMPLETE' : started !== null ? 'CONTROL YOUR ENERGY' : 'READY WHEN YOU ARE', 180, 28);
  }
  function tick(now) {
    frame = 0;
    if (!dialog.open || document.hidden || mode !== 'ki') return;
    if (started !== null) {
      energy = level(now - started); meter.value = energy; powerText.textContent = `${Math.round(energy)}%`;
      if (energy >= 100) finish(now);
    }
    draw(now);
    if (started !== null || (!quiet() && now - resultAt < 700)) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function setBand() {
    const [low, high] = bands[round % 5]; target.style.left = `${low}%`; target.style.width = `${high - low}%`;
    document.getElementById('ki-band').textContent = `${low}–${high}%`;
    score.textContent = `${Math.min(round + 1, 5)} / 5 · ${hits} hits`;
  }
  function begin() {
    if (round >= 5) { reset(); return; }
    if (started !== null) return;
    started = performance.now(); energy = 0; action.textContent = 'release ki'; action.setAttribute('aria-pressed', 'true');
    announce(`Charging. Release at ${bands[round][0]} to ${bands[round][1]} percent.`); schedule();
  }
  function finish(now = performance.now()) {
    if (started === null) return;
    const result = release(round, now - started); energy = result.power; resultHit = result.hit;
    if (result.hit) hits++;
    stop(); round++; resultAt = now;
    meter.value = energy; powerText.textContent = `${Math.round(energy)}%`;
    announce(`${result.perfect ? 'Perfect control!' : result.hit ? 'Clean release!' : energy >= 100 ? 'Overcharged!' : 'Outside the target.'} ${Math.round(energy)}%. ${round >= 5 ? `Training complete: ${hits} of 5 hits.` : 'Ready for the next round.'}`);
    action.textContent = round >= 5 ? 'train again' : 'charge ki'; setBand(); draw(now); schedule();
  }
  function renderGrid() {
    [...grid.children].forEach((button, index) => {
      const match = found.indexOf(index), signal = scanned.get(index);
      button.dataset.signal = match >= 0 ? 'found' : signal?.distance <= 1 ? 'hot' : signal?.distance <= 2 ? 'warm' : signal ? 'cold' : '';
      button.textContent = match >= 0 ? '★' : signal ? signal.distance <= 1 ? '!' : signal.distance <= 2 ? '+' : '·' : '·';
      if (match >= 0) {
        const orb = document.createElement('img'); orb.src = orbPaths[match]; orb.alt = ''; orb.width = 32; orb.height = 32; button.replaceChildren(orb);
      }
      button.setAttribute('aria-label', `${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}${match >= 0 ? ', ball found' : signal ? `, ${signal.label}` : ', scan'}`);
      button.setAttribute('aria-disabled', String(match >= 0 || found.length === 7));
    });
    score.textContent = `${found.length} / 7 · ${scans} scans`;
    const trophy = document.getElementById('hunt-dragon'); trophy.hidden = found.length !== 7;
    if (found.length === 7 && !trophy.getAttribute('src')) trophy.src = '/assets/shenron.webp';
  }
  for (let i = 0; i < 36; i++) {
    const button = document.createElement('button'); button.type = 'button';
    button.addEventListener('click', () => {
      if (found.includes(i) || found.length === 7) return;
      scans++; const signal = ping(targets, found, i);
      if (signal.found) {
        found.push(i); scanned.clear();
        announce(found.length === 7 ? `All seven found in ${scans} scans. The dragon answers your call.` : `Ball ${found.length} of 7 found. Old readings cleared; search for the next signal.`);
      } else { scanned.set(i, signal); announce(`${String.fromCharCode(65 + Math.floor(i / 6))}${i % 6 + 1}: ${signal.label}. Distance counts horizontal and vertical steps.`); }
      renderGrid();
    });
    button.addEventListener('keydown', event => {
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 }[event.key];
      if (delta) { event.preventDefault(); grid.children[(i + delta + 36) % 36].focus(); }
    }); grid.append(button);
  }
  function reset() {
    stop(); round = 0; hits = 0; energy = 0; resultAt = 0; meter.value = 0; powerText.textContent = '0%';
    targets = field(); found = []; scanned.clear(); scans = 0;
    if (mode === 'ki') { setBand(); announce('Five rounds. Release inside the marked target band.'); draw(); }
    else { renderGrid(); announce('Find seven hidden balls. Scan a square; its reading points toward the nearest remaining ball.'); }
  }
  function select(next) {
    mode = next; const choosing = mode === 'choose';
    ki.hidden = mode !== 'ki'; radar.hidden = mode !== 'radar'; picker.hidden = !choosing;
    back.hidden = choosing; score.hidden = choosing; status.hidden = choosing;
    document.getElementById('arcade-reset').hidden = choosing;
    title.textContent = choosing ? 'capsule arcade' : mode === 'ki' ? 'ki control' : 'dragon radar hunt';
    dialog.dataset.mode = mode;
    if (choosing) { stop(); announce('Choose a training game.'); } else reset();
  }
  function open(next = 'ki', trigger = document.activeElement) {
    opener = trigger;
    if (document.getElementById('training-dialog')?.open) { window.PortfolioTraining.close(); opener = document.querySelector('[data-game-trigger]'); }
    dialog.showModal(); root.dataset.training = 'open'; select(next);
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: true } }));
    focusGame();
  }
  function focusGame() { (mode === 'choose' ? (document.getElementById('game-pick-piccolo') || document.getElementById('game-pick-breaker')) : mode === 'ki' ? action : grid.children[0]).focus(); }
  for (const game of ['breaker', 'piccolo', 'platformer', 'ki', 'radar']) document.getElementById(`game-pick-${game}`)?.addEventListener('click', () => {
    if (['breaker', 'piccolo', 'platformer'].includes(game)) {
      if (window.PortfolioGames) window.PortfolioGames.run(game, opener);
      else if (game === 'breaker') { const trigger = opener; dialog.close(); window.PortfolioTraining?.open(trigger); }
    } else { select(game); focusGame(); }
  });
  back.addEventListener('click', () => { select('choose'); focusGame(); });
  function cancelCharge(message) { if (started !== null) { stop(); energy = 0; meter.value = 0; powerText.textContent = '0%'; announce(message); } draw(); }
  action.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    pressStarted = started === null && round < 5;
    if (pressStarted) { begin(); action.setPointerCapture(event.pointerId); }
  });
  action.addEventListener('pointerup', () => { if (started !== null && pressStarted && performance.now() - started > 200) finish(); });
  action.addEventListener('pointercancel', () => { pressStarted = false; cancelCharge('Charge cancelled. Ready to try again.'); });
  action.addEventListener('click', event => {
    if (event.detail && pressStarted) { pressStarted = false; return; }
    if (started !== null) finish(); else begin();
  });
  action.addEventListener('blur', () => cancelCharge('Charge cancelled when focus moved. No round lost.'));
  if (!window.PortfolioGames) document.querySelectorAll('[data-arcade-open]').forEach(button => button.addEventListener('click', () => open(button.dataset.arcadeOpen)));
  document.getElementById('arcade-reset').addEventListener('click', reset);
  document.getElementById('arcade-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    stop(); const trainingOpen = ['training-dialog', 'piccolo-dialog', 'platformer-dialog', 'goku-dialog', 'game-loading-dialog'].some(id => document.getElementById(id)?.open);
    if (!trainingOpen) delete root.dataset.training;
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: trainingOpen } }));
    if (!trainingOpen && opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', event => { if (mode !== 'choose') { event.preventDefault(); select('choose'); focusGame(); } event.stopPropagation(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelCharge('Charge cancelled while away. No round lost.'); cancelAnimationFrame(frame); frame = 0; } });
  window.addEventListener('blur', () => cancelCharge('Charge cancelled while away. No round lost.'));
  reduced.addEventListener('change', () => draw());
  new MutationObserver(() => draw()).observe(root, { attributes: true, attributeFilter: ['data-motion'] });
  window.PortfolioArcade = Object.freeze({ open });
})();
