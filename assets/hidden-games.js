// Deterministic rules; the optional UI keeps completed records on this device.
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
    return { found: false, distance, label: `${distance} ${distance === 1 ? 'step' : 'steps'} to the nearest ball` };
  }
  function validRecords(value) {
    const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
    const ki = value?.ki, radar = value?.radar;
    return {
      ki: integer(ki?.hits, 0, 5) && integer(ki?.perfects, 0, ki.hits) ? { hits: ki.hits, perfects: ki.perfects } : null,
      radar: integer(radar?.scans, 7, 252) ? { scans: radar.scans } : null
    };
  }
  function mergeRecords(left, right) {
    const a = validRecords(left), b = validRecords(right);
    return {
      ki: !a.ki || (b.ki && (b.ki.hits > a.ki.hits || (b.ki.hits === a.ki.hits && b.ki.perfects > a.ki.perfects))) ? b.ki : a.ki,
      radar: !a.radar || (b.radar && b.radar.scans < a.radar.scans) ? b.radar : a.radar
    };
  }
  const rules = Object.freeze({ bands, level, release, field, ping, validRecords, mergeRecords });
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
  const record = document.getElementById('arcade-record');
  const canvas = document.getElementById('ki-canvas'), ctx = canvas.getContext('2d');
  let mode = 'ki', opener, frame = 0, started = null, round = 0, hits = 0, perfects = 0, energy = 0;
  let targets = [], found = [], scanned = new Map(), scans = 0, resultAt = 0, resultHit = false, resultPerfect = false, hasResult = false, pressStarted = false, chargePointer = null;
  const visited = new Set(), outcomes = [], recordKey = 'portfolio-arcade-records-v1';
  let records = validRecords(null), recordScope = 'this device';
  function refreshRecords() {
    try { records = mergeRecords(records, JSON.parse(window.localStorage.getItem(recordKey))); } catch { recordScope = 'this session'; }
  }
  refreshRecords();
  function showRecord() {
    const best = records[mode];
    record.textContent = mode === 'ki' ? best ? `best ${best.hits}/5 hits · ${best.perfects} perfect · ${recordScope}` : 'First goal: 3 hits. The centre earns a perfect.'
      : best ? `best ${best.scans} scans · ${recordScope}` : 'Find all seven to set your first personal best.';
  }
  function saveRecord() {
    // Another tab may have finished a better run since this dialog opened.
    refreshRecords();
    const best = records[mode];
    const improved = mode === 'ki' ? !best || hits > best.hits || (hits === best.hits && perfects > best.perfects) : !best || scans < best.scans;
    if (improved) {
      records[mode] = mode === 'ki' ? { hits, perfects } : { scans };
      try { window.localStorage.setItem(recordKey, JSON.stringify(records)); recordScope = 'this device'; } catch { recordScope = 'this session'; }
    }
    showRecord(); return improved ? ' New personal best!' : '';
  }
  const quiet = () => reduced.matches || root.dataset.motion === 'paused';
  function announce(text) { status.textContent = text; }
  function stop() { cancelAnimationFrame(frame); frame = 0; started = null; action.textContent = round >= 5 ? 'train again' : 'charge ki'; action.setAttribute('aria-pressed', 'false'); }
  function draw(now = performance.now()) {
    if (!ctx || !dialog.open || mode !== 'ki') return;
    const p = energy / 100, active = started !== null;
    const [low, high] = bands[(hasResult ? round - 1 : round) % 5];
    const centred = Math.abs(energy - (low + high) / 2) <= 3;
    const burst = quiet() || !hasResult ? 0 : Math.max(0, 1 - (now - resultAt) / 700);
    const ink = '#19334e', gold = '#ffcf61', cyan = '#56e7ef';
    const circle = (x, y, radius, fill, stroke = ink) => {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    };
    ctx.fillStyle = '#80ddea'; ctx.fillRect(0, 0, 360, 230);
    ctx.fillStyle = '#b7f0ed'; ctx.fillRect(0, 83, 360, 80);
    for (let x = -20; x < 380; x += 75) {
      circle(x, 156, 32, '#f8f4d9', null); circle(x + 28, 169, 38, '#f8f4d9', null);
    }
    ctx.fillStyle = '#46a895'; ctx.beginPath(); ctx.moveTo(0, 147); ctx.lineTo(30, 94); ctx.lineTo(63, 143); ctx.lineTo(110, 104); ctx.lineTo(155, 165); ctx.lineTo(0, 165); ctx.fill();
    ctx.fillStyle = '#e8b761'; ctx.fillRect(0, 180, 360, 50);
    ctx.fillStyle = '#fff1cf'; ctx.fillRect(0, 173, 360, 15);
    ctx.strokeStyle = '#c49150'; ctx.lineWidth = 1;
    for (let x = -60; x < 420; x += 60) { ctx.beginPath(); ctx.moveTo(180 + (x - 180) * .55, 188); ctx.lineTo(x, 230); ctx.stroke(); }
    // A readable training stance: orange gi, blue boots, dark hair and forward hands.
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = '#f78c3e'; ctx.beginPath(); ctx.moveTo(69, 115); ctx.lineTo(89, 116); ctx.lineTo(99, 147); ctx.lineTo(111, 170); ctx.lineTo(95, 173); ctx.lineTo(79, 151); ctx.lineTo(68, 174); ctx.lineTo(52, 170); ctx.lineTo(64, 143); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2765b0'; ctx.fillRect(62, 137, 29, 7); ctx.fillRect(50, 169, 20, 7); ctx.fillRect(94, 168, 22, 8);
    circle(77, 105, 12, '#ffd391');
    ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(63, 107); ctx.lineTo(53, 98); ctx.lineTo(65, 99); ctx.lineTo(60, 87); ctx.lineTo(74, 94); ctx.lineTo(79, 81); ctx.lineTo(85, 94); ctx.lineTo(97, 90); ctx.lineTo(89, 106); ctx.lineTo(79, 101); ctx.lineTo(70, 110); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(82, 123); ctx.lineTo(106, 130); ctx.lineTo(121, 122); ctx.stroke();
    ctx.strokeStyle = '#ffd391'; ctx.lineWidth = 7; ctx.stroke(); circle(123, 121, 5, '#ffd391');
    // The destination seal stays visible behind the beam; a perfect hit earns gold rays.
    const won = hasResult && resultHit;
    circle(286, 120, 31 + burst * (resultPerfect ? 8 : 3), won ? '#fff3bd' : '#3e6e86');
    circle(286, 120, 23, won ? gold : '#a1e8e2');
    ctx.fillStyle = ink; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.fillText(won ? (resultPerfect ? '★' : '✓') : '◎', 286, 129);
    if (hasResult && resultPerfect) {
      ctx.strokeStyle = '#d77828'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(286 + Math.cos(a) * 39, 120 + Math.sin(a) * 39); ctx.lineTo(286 + Math.cos(a) * 47, 120 + Math.sin(a) * 47); ctx.stroke(); }
    }
    if (won) {
      ctx.fillStyle = resultPerfect ? '#f5b52c' : '#257eaa'; ctx.fillRect(139, 114 - burst * 7, 119, 12 + burst * 14);
      ctx.fillStyle = '#fff7d0'; ctx.fillRect(140, 118 - burst * 3, 118, 4 + burst * 6);
    }
    if (active || !hasResult) {
      const radius = 7 + p * 22;
      circle(145, 120, radius + 5, centred ? gold : '#3398ba');
      circle(145, 120, radius, '#edffea');
      if (active && !quiet()) {
        ctx.strokeStyle = centred ? '#ae622b' : '#23739a'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + (now - started) / 450; ctx.beginPath(); ctx.moveTo(145 + Math.cos(a) * (radius + 10), 120 + Math.sin(a) * (radius + 10)); ctx.lineTo(145 + Math.cos(a) * (radius + 16), 120 + Math.sin(a) * (radius + 16)); ctx.stroke(); }
      }
    }
    ctx.fillStyle = ink; ctx.fillRect(31, 14, 298, 32);
    ctx.fillStyle = '#fff2cc'; ctx.font = 'bold 13px "Plex Mono",monospace'; ctx.textAlign = 'center';
    const message = hasResult ? resultPerfect ? 'PERFECT CONTROL!' : resultHit ? 'CLEAN RELEASE!' : energy < low ? 'TOO EARLY · HOLD LONGER' : 'TOO MUCH · RELEASE SOONER' : active ? energy > high ? 'TOO HIGH · RELEASE TO RETRY' : centred ? 'CENTRE! RELEASE!' : energy >= low ? 'RELEASE!' : 'BUILD YOUR ENERGY' : 'HOLD · AIM FOR GOLD';
    ctx.fillText(message, 180, 35);
    ctx.font = 'bold 13px monospace';
    for (let i = 0; i < 5; i++) {
      const outcome = outcomes[i], x = 128 + i * 26;
      circle(x, 210, 10, outcome === 'perfect' ? gold : outcome === 'hit' ? '#9ceada' : outcome === 'miss' ? '#ffe4cc' : '#f7edce');
      ctx.fillStyle = ink; ctx.fillText(outcome === 'perfect' ? '★' : outcome === 'hit' ? '✓' : outcome === 'miss' ? '×' : String(i + 1), x, 214);
    }
  }
  function tick(now) {
    frame = 0;
    if (!dialog.open || document.hidden || mode !== 'ki') return;
    if (started !== null) {
      energy = level(now - started); meter.value = energy; powerText.textContent = `${Math.round(energy)}%`;
      if (energy >= 100) { finish(now); return; }
    }
    draw(now);
    if (started !== null || (!quiet() && now - resultAt < 700)) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function setBand(displayRound = round) {
    const [low, high] = bands[displayRound % 5]; target.style.left = `${low}%`; target.style.width = `${high - low}%`;
    document.getElementById('ki-band').textContent = `${low}–${high}%`;
    score.textContent = `${Math.min(round + 1, 5)} / 5 · ${hits} hits · ${perfects} perfect`;
  }
  function begin() {
    if (round >= 5) { reset(); return; }
    if (started !== null) return;
    setBand();
    started = performance.now(); energy = 0; hasResult = false; action.textContent = 'release ki'; action.setAttribute('aria-pressed', 'true');
    announce(`Charging. Release at ${bands[round][0]} to ${bands[round][1]} percent.`); schedule();
  }
  function finish(now = performance.now()) {
    if (started === null) return;
    const [low, high] = bands[round];
    const result = release(round, now - started); energy = result.power; resultHit = result.hit; resultPerfect = result.perfect; hasResult = true;
    if (result.hit) hits++;
    if (result.perfect) perfects++;
    outcomes.push(result.perfect ? 'perfect' : result.hit ? 'hit' : 'miss');
    stop(); round++; resultAt = now;
    meter.value = energy; powerText.textContent = `${Math.round(energy)}%`;
    const feedback = result.perfect ? 'Perfect control!' : result.hit ? 'Clean release!' : energy >= 100 ? 'Overcharged! Release sooner.' : energy < low ? 'Below the target. Hold a little longer.' : 'Above the target. Release a little sooner.';
    announce(`${feedback} ${Math.round(energy)}% against ${low}–${high}%. ${round >= 5 ? `Training complete: ${hits} of 5 hits, ${perfects} perfect.${saveRecord()}` : 'Ready for the next round.'}`);
    action.textContent = round >= 5 ? 'train again' : 'charge ki'; setBand(round - 1); draw(now); schedule();
  }
  function renderGrid() {
    [...grid.children].forEach((button, index) => {
      const match = found.indexOf(index), signal = scanned.get(index);
      button.dataset.signal = match >= 0 ? 'found' : signal?.distance <= 1 ? 'hot' : signal?.distance <= 2 ? 'warm' : signal ? 'cold' : visited.has(index) ? 'visited' : '';
      button.dataset.cell = `${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}`;
      button.textContent = match >= 0 ? '★' : signal ? String(signal.distance) : visited.has(index) ? '○' : '·';
      if (match >= 0) {
        const orb = document.createElement('img'); orb.src = orbPaths[match]; orb.alt = ''; orb.width = 32; orb.height = 32; button.replaceChildren(orb);
      }
      button.setAttribute('aria-label', `${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}${match >= 0 ? ', ball found' : signal ? `, ${signal.label}` : visited.has(index) ? ', empty, scan for an updated distance' : ', scan'}`);
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
      if (scanned.has(i)) {
        announce(`${String.fromCharCode(65 + Math.floor(i / 6))}${i % 6 + 1}: ${scanned.get(i).label}. Same reading; no extra scan used.`);
        return;
      }
      scans++; visited.add(i); const signal = ping(targets, found, i);
      if (signal.found) {
        found.push(i); scanned.clear();
        announce(found.length === 7 ? `All seven found in ${scans} scans. The dragon answers your call.${saveRecord()}` : `Ball ${found.length} of 7 found. Old readings cleared; empty squares keep a ring. Search for the next signal.`);
      } else { scanned.set(i, signal); announce(`${String.fromCharCode(65 + Math.floor(i / 6))}${i % 6 + 1}: ${signal.label}. Distance counts horizontal and vertical steps.`); }
      renderGrid();
    });
    button.tabIndex = i === 0 ? 0 : -1;
    button.addEventListener('focus', () => {
      [...grid.children].forEach(cell => { cell.tabIndex = cell === button ? 0 : -1; });
    });
    button.addEventListener('keydown', event => {
      const row = Math.floor(i / 6), column = i % 6;
      const next = { ArrowRight: row * 6 + Math.min(5, column + 1), ArrowLeft: row * 6 + Math.max(0, column - 1),
        ArrowDown: Math.min(5, row + 1) * 6 + column, ArrowUp: Math.max(0, row - 1) * 6 + column,
        Home: row * 6, End: row * 6 + 5 }[event.key];
      if (next !== undefined) { event.preventDefault(); grid.children[next].focus(); }
    }); grid.append(button);
  }
  function reset() {
    // Keep any interrupted gesture's trailing click suppressed. A fresh
    // pointerdown establishes its own pressStarted value.
    round = 0; stop(); chargePointer = null; hits = 0; perfects = 0; outcomes.length = 0; energy = 0; resultAt = 0; hasResult = false; meter.value = 0; powerText.textContent = '0%';
    targets = field(); found = []; scanned.clear(); visited.clear(); scans = 0; refreshRecords(); showRecord();
    if (mode === 'ki') { setBand(); announce('Five rounds. Release inside the marked target band.'); draw(); }
    else { renderGrid(); announce('Find seven hidden balls. Scan a square; its reading points toward the nearest remaining ball.'); }
  }
  function select(next) {
    mode = next; const choosing = mode === 'choose';
    ki.hidden = mode !== 'ki'; radar.hidden = mode !== 'radar'; picker.hidden = !choosing;
    back.hidden = choosing; score.hidden = choosing; status.hidden = choosing; record.hidden = choosing;
    document.getElementById('arcade-reset').hidden = choosing;
    title.textContent = choosing ? 'capsule arcade' : mode === 'ki' ? 'ki control' : 'dragon radar hunt';
    dialog.dataset.mode = mode;
    if (choosing) { stop(); chargePointer = null; announce('Choose a training game.'); } else reset();
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
  function cancelCharge(message) { chargePointer = null; if (started !== null) { stop(); energy = 0; meter.value = 0; powerText.textContent = '0%'; announce(message); } draw(); }
  action.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || chargePointer !== null) return;
    // Safari does not focus buttons on pointer press by default. Owning focus
    // makes later Tab/focus changes cancel the same held charge in every engine.
    action.focus({ preventScroll: true });
    pressStarted = started === null && round < 5;
    if (pressStarted) { chargePointer = event.pointerId; begin(); action.setPointerCapture(event.pointerId); }
  });
  // Keep the focus explicitly assigned above. WebKit's touch compatibility
  // mousedown otherwise blurs this button before click; cancelling only that
  // default preserves the click needed for two-tap release and replay.
  action.addEventListener('mousedown', event => { if (event.button === 0) event.preventDefault(); });
  action.addEventListener('pointerup', event => {
    if (event.pointerId !== chargePointer) return;
    chargePointer = null;
    if (started !== null && pressStarted && performance.now() - started > 200) finish();
  });
  const cancelPointer = event => {
    if (chargePointer === null || event.pointerId !== chargePointer) return;
    chargePointer = null; cancelCharge('Charge cancelled. Ready to try again.');
    // A pointer release may still synthesize a click after capture is lost.
    pressStarted = true;
  };
  action.addEventListener('pointercancel', cancelPointer);
  action.addEventListener('lostpointercapture', cancelPointer);
  action.addEventListener('click', event => {
    if (event.detail && pressStarted) { pressStarted = false; return; }
    if (started !== null) finish(); else begin();
  });
  action.addEventListener('keydown', event => { if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault(); });
  action.addEventListener('blur', () => cancelCharge('Charge cancelled when focus moved. No round lost.'));
  if (!window.PortfolioGames) document.querySelectorAll('[data-arcade-open]').forEach(button => button.addEventListener('click', () => open(button.dataset.arcadeOpen)));
  document.getElementById('arcade-reset').addEventListener('click', () => { reset(); focusGame(); });
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
