/* Capsule Blocks: deterministic placement rules and an event-driven, accessible board. */
(() => {
  'use strict';
  const SIZE = 8;
  const SHAPES = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  ];
  const NAMES = ['single block', 'horizontal pair', 'vertical pair', 'horizontal three', 'vertical three', 'horizontal four', 'vertical four', 'two by two square', 'three-block L, foot right', 'three-block L, foot left', 'three-block L, top bar and right foot', 'three-block L, top bar and left foot', 'T, three across with center below', 'tall L, three down with right foot', 'Z, two across then two shifted right', 'three wide by two high rectangle', 'three by three square'];
  function piece(index) { return { name: NAMES[index], cells: SHAPES[index].map(cell => [...cell]), color: index % 5 + 1 }; }
  function fits(board, shape, x, y) {
    return Boolean(shape) && shape.cells.every(([dx, dy]) => x + dx >= 0 && x + dx < SIZE && y + dy >= 0 && y + dy < SIZE && !board[(y + dy) * SIZE + x + dx]);
  }
  function hasMove(board, shape) {
    if (!shape) return false;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fits(board, shape, x, y)) return true;
    return false;
  }
  function deal(game, random) {
    game.tray = Array.from({ length: 3 }, () => piece(Math.min(SHAPES.length - 1, Math.floor(Math.max(0, random()) * SHAPES.length))));
    game.over = !game.tray.some(shape => hasMove(game.board, shape));
  }
  function create(random = Math.random) {
    const game = { board: Array(64).fill(0), tray: [], score: 0, lines: 0, streak: 0, over: false, moves: 0 };
    deal(game, random); return game;
  }
  function place(game, slot, x, y, random = Math.random) {
    const shape = game.tray[slot];
    if (game.over || !Number.isInteger(x) || !Number.isInteger(y) || !fits(game.board, shape, x, y)) return { accepted: false, cleared: [], lines: 0 };
    for (const [dx, dy] of shape.cells) game.board[(y + dy) * SIZE + x + dx] = shape.color;
    game.tray[slot] = null; game.moves++;
    const rows = [], columns = [];
    for (let i = 0; i < SIZE; i++) {
      if (game.board.slice(i * SIZE, i * SIZE + SIZE).every(Boolean)) rows.push(i);
      if (Array.from({ length: SIZE }, (_, y) => game.board[y * SIZE + i]).every(Boolean)) columns.push(i);
    }
    const cleared = new Set();
    for (const row of rows) for (let x = 0; x < SIZE; x++) cleared.add(row * SIZE + x);
    for (const column of columns) for (let y = 0; y < SIZE; y++) cleared.add(y * SIZE + column);
    cleared.forEach(index => { game.board[index] = 0; });
    const lines = rows.length + columns.length;
    game.streak = lines ? game.streak + 1 : 0;
    const points = shape.cells.length * 10 + lines * lines * 100 + Math.max(0, game.streak - 1) * 50;
    game.score += points; game.lines += lines;
    if (game.tray.every(shape => !shape)) deal(game, random);
    else game.over = !game.tray.some(shape => hasMove(game.board, shape));
    return { accepted: true, cleared: [...cleared], lines, points };
  }
  const engine = Object.freeze({ SIZE, SHAPES, piece, fits, hasMove, create, place });
  if (typeof module !== 'undefined') module.exports = engine;
  if (typeof document === 'undefined') return;
  const dialog = document.getElementById('blocks-dialog');
  if (!dialog) return;
  dialog.innerHTML = `<div class="console-heading"><div><span class="console-eyebrow">CARTRIDGE 01 / PUZZLE</span><h2 id="blocks-title">capsule blocks<span>BLOCK BLAST</span></h2></div><button type="button" data-block-close aria-label="Close block blast">esc</button></div>
    <div class="console-hud"><span>score <strong id="blocks-score">0</strong></span><span>lines <strong id="blocks-lines">0</strong></span><span id="blocks-combo">take your time</span></div>
    <div class="blocks-board-shell"><div id="blocks-board" role="grid" aria-label="Block board, eight rows and eight columns" aria-describedby="blocks-help blocks-status"></div><div id="blocks-end" class="console-result" hidden><strong>nice run!</strong><span id="blocks-end-score"></span><button type="button" data-block-restart>play again ↵</button></div></div>
    <div id="blocks-tray" role="group" aria-label="Choose one of three pieces"></div>
    <p id="blocks-status" role="status" aria-live="polite" aria-atomic="true">Select a piece, then place its top-left corner on the board.</p>
    <div class="console-actions"><button type="button" data-block-back>← cartridges</button><button type="button" data-block-restart>new game ↻</button></div>
    <details class="console-help"><summary>how to play / controls</summary><p id="blocks-help">Fill a row or column to clear it. Use all three pieces for a fresh tray. Tap a piece, then a square. Keyboard: 1–3 picks a piece; arrows move; Enter places it. No timer.</p></details>`;
  const root = document.documentElement, board = dialog.querySelector('#blocks-board'), tray = dialog.querySelector('#blocks-tray');
  const status = dialog.querySelector('#blocks-status'), result = dialog.querySelector('#blocks-end');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let game = create(), selected = 0, cursor = 0, preview = -1, opener, clearTimer;
  const cells = [], choices = [];
  function clearPreview() { preview = -1; cells.forEach(cell => { delete cell.dataset.preview; }); }
  function showPreview(index) {
    clearPreview(); preview = index;
    const shape = game.tray[selected]; if (!shape || game.over) return;
    const x = index % 8, y = Math.floor(index / 8), valid = fits(game.board, shape, x, y);
    for (const [dx, dy] of shape.cells) if (x + dx < 8 && y + dy < 8) cells[(y + dy) * 8 + x + dx].dataset.preview = valid ? String(shape.color) : 'invalid';
  }
  function select(slot, focus = false) {
    if (!game.tray[slot] || game.over) return;
    selected = slot; render();
    status.textContent = `Piece ${slot + 1} selected: ${game.tray[slot].name}. Choose its top-left square.`;
    if (focus) cells[cursor].focus({ preventScroll: true });
  }
  function commit(index) {
    const move = place(game, selected, index % 8, Math.floor(index / 8));
    if (!move.accepted) { status.textContent = 'That piece does not fit there. Try another square or piece.'; return; }
    clearTimeout(clearTimer); cells.forEach(cell => { delete cell.dataset.cleared; });
    if (move.cleared.length && !reduced.matches && root.dataset.motion !== 'paused') {
      move.cleared.forEach(index => { cells[index].dataset.cleared = 'true'; });
      clearTimer = setTimeout(() => cells.forEach(cell => { delete cell.dataset.cleared; }), 360);
    }
    selected = game.tray.findIndex(shape => hasMove(game.board, shape));
    if (selected < 0) selected = game.tray.findIndex(Boolean);
    render();
    status.textContent = game.over ? `Board complete. No pieces fit. Final score ${game.score}. Play again for a fresh board.` : `${move.lines ? `${move.lines} ${move.lines === 1 ? 'line' : 'lines'} cleared! ` : ''}+${move.points} points.${game.streak > 1 ? ` ${game.streak} clear streak!` : ''} ${game.tray.filter(Boolean).length} pieces ready.`;
    if (game.over) result.querySelector('button').focus({ preventScroll: true });
  }
  for (let row = 0; row < 8; row++) {
    const line = document.createElement('div'); line.setAttribute('role', 'row'); board.append(line);
    for (let column = 0; column < 8; column++) {
      const index = row * 8 + column, cell = document.createElement('button');
      cell.type = 'button'; cell.setAttribute('role', 'gridcell'); cell.tabIndex = index ? -1 : 0;
      cell.addEventListener('pointerenter', () => showPreview(index));
      cell.addEventListener('focus', () => { cells[cursor].tabIndex = -1; cursor = index; cell.tabIndex = 0; showPreview(index); });
      cell.addEventListener('click', () => commit(index));
      cell.addEventListener('keydown', event => {
        const key = event.key;
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[key];
        if (delta) {
          event.preventDefault();
          const next = delta === -1 ? row * 8 + (column + 7) % 8 : delta === 1 ? row * 8 + (column + 1) % 8 : (index + delta + 64) % 64;
          cells[next].focus({ preventScroll: true });
        }
      });
      cells.push(cell); line.append(cell);
    }
  }
  board.addEventListener('pointerleave', clearPreview);
  for (let slot = 0; slot < 3; slot++) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'blocks-piece';
    button.addEventListener('click', () => select(slot, true)); choices.push(button); tray.append(button);
  }
  function render() {
    cells.forEach((cell, index) => {
      cell.dataset.color = String(game.board[index]);
      cell.setAttribute('aria-label', `Row ${Math.floor(index / 8) + 1}, column ${index % 8 + 1}, ${game.board[index] ? 'filled' : 'empty'}`);
      cell.setAttribute('aria-disabled', String(game.over));
    });
    choices.forEach((button, slot) => {
      const shape = game.tray[slot]; button.disabled = !shape || game.over;
      button.setAttribute('aria-pressed', String(slot === selected && Boolean(shape)));
      button.setAttribute('aria-label', shape ? `Piece ${slot + 1}, ${shape.name}, ${shape.cells.length} blocks${hasMove(game.board, shape) ? '' : ', no space yet'}` : `Piece ${slot + 1}, used`);
      button.replaceChildren();
      const caption = document.createElement('span'); caption.className = 'blocks-piece-label'; caption.textContent = shape ? `0${slot + 1}` : '✓'; button.append(caption);
      if (!shape) return;
      const grid = document.createElement('span'); grid.className = 'blocks-piece-grid'; grid.setAttribute('aria-hidden', 'true');
      const width = Math.max(...shape.cells.map(([x]) => x)) + 1, height = Math.max(...shape.cells.map(([, y]) => y)) + 1;
      grid.style.gridTemplateColumns = `repeat(${width}, 1fr)`; grid.style.gridTemplateRows = `repeat(${height}, 1fr)`;
      grid.style.width = `${width * 18}px`; grid.style.height = `${height * 18}px`;
      for (const [x, y] of shape.cells) {
        const block = document.createElement('span'); block.dataset.color = shape.color; block.style.gridColumn = x + 1; block.style.gridRow = y + 1; grid.append(block);
      }
      button.append(grid);
    });
    dialog.querySelector('#blocks-score').textContent = String(game.score);
    dialog.querySelector('#blocks-lines').textContent = String(game.lines);
    dialog.querySelector('#blocks-combo').textContent = game.streak > 1 ? `${game.streak}× clear streak` : 'take your time';
    result.hidden = !game.over; dialog.querySelector('#blocks-end-score').textContent = `${game.score} points · ${game.lines} lines`;
    if (preview >= 0) showPreview(preview);
  }
  function restart() { clearTimeout(clearTimer); cells.forEach(cell => { delete cell.dataset.cleared; }); clearPreview(); game = create(); selected = 0; render(); status.textContent = 'Fresh board. Choose a piece, then place its top-left square.'; choices[0].focus({ preventScroll: true }); }
  function close() { dialog.close(); }
  const back = () => window.PortfolioGames?.run('choose', opener);
  dialog.querySelector('[data-block-close]').addEventListener('click', close);
  dialog.querySelector('[data-block-back]').addEventListener('click', back);
  dialog.querySelectorAll('[data-block-restart]').forEach(button => button.addEventListener('click', restart));
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (['1', '2', '3'].includes(event.key)) { event.preventDefault(); select(Number(event.key) - 1, true); }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); back(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    clearTimeout(clearTimer); clearPreview();
    const other = ['arcade-dialog', 'training-dialog', 'platformer-dialog', 'goku-dialog', 'game-loading-dialog'].some(id => document.getElementById(id)?.open);
    if (!other) { delete root.dataset.training; opener?.focus({ preventScroll: true }); }
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: other } }));
  });
  window.addEventListener('portfolio:view', () => { if (dialog.open) close(); });
  window.PortfolioBlocks = Object.freeze({ open(trigger) {
    opener = trigger; render(); if (!dialog.open) dialog.showModal(); root.dataset.training = 'open';
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open: true } }));
    (game.over ? result.querySelector('button') : choices[Math.max(0, selected)]).focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }, close });
})();
