/* Optional arcade: game modules and console stylesheet load only on request. */
(() => {
  'use strict';
  const root = document.documentElement;
  const scripts = new Map(), styles = new Map();
  let request = 0, opener, lastMode;
  const ids = ['arcade-dialog', 'training-dialog', 'piccolo-dialog', 'platformer-dialog', 'goku-dialog'];
  const paths = {
    choose: ['/assets/hidden-games.js'], ki: ['/assets/hidden-games.js'], radar: ['/assets/hidden-games.js'],
    piccolo: ['/assets/piccolo-lookout.js'], platformer: ['/assets/goku-platformer.js'],
    breaker: ['/assets/brick-breaker.js', '/assets/training-chamber.js'],
    goku: ['/assets/goku-story.js', '/assets/goku-terminal.js', '/assets/goku-adventure.js'],
  };
  const stylePaths = { piccolo: ['/assets/piccolo.css'], platformer: ['/assets/goku-platformer.css'] };
  const loading = document.createElement('dialog');
  loading.id = 'game-loading-dialog'; loading.className = 'arcade-loading';
  loading.setAttribute('aria-labelledby', 'game-loading-title');
  loading.innerHTML = '<h2 id="game-loading-title">loading cartridge…</h2><p id="game-loading-status" role="status">One moment.</p><div><button type="button" data-game-retry hidden>try again</button> <button type="button" data-game-dismiss>close</button></div>';
  document.body.append(loading);
  const status = loading.querySelector('[role="status"]'), retry = loading.querySelector('[data-game-retry]');
  function announce(open) {
    if (open) root.dataset.training = 'open'; else delete root.dataset.training;
    window.dispatchEvent(new CustomEvent('portfolio:training', { detail: { open } }));
  }
  function active() { return ids.some(id => document.getElementById(id)?.open); }
  function restore() {
    if (!active()) {
      announce(false);
      const target = opener?.isConnected && !opener.closest?.('dialog:not([open]), [hidden]') ? opener : document.querySelector('[data-game-trigger]');
      target?.focus({ preventScroll: true });
    }
  }
  function dismiss() { request++; loading.close(); restore(); }
  loading.querySelector('[data-game-dismiss]').addEventListener('click', dismiss);
  loading.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); dismiss(); });
  retry.addEventListener('click', () => { open(lastMode, opener).catch(() => {}); });
  function loadStyle(path) {
    if (!styles.has(path)) styles.set(path, new Promise((resolve, reject) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = path;
      link.onload = resolve;
      link.onerror = () => { link.remove(); styles.delete(path); reject(new Error('Cartridge styles could not load.')); };
      document.head.append(link);
    }));
    return styles.get(path);
  }
  function loadScript(path) {
    if (!scripts.has(path)) scripts.set(path, new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = path; script.async = false;
      script.onload = resolve;
      script.onerror = () => { script.remove(); scripts.delete(path); reject(new Error('Game cartridge could not load.')); };
      document.head.append(script);
    }));
    return scripts.get(path);
  }
  async function open(mode = 'choose', trigger = document.activeElement) {
    if (!paths[mode]) throw new Error('Unknown arcade cartridge.');
    if (trigger?.isConnected && !trigger.closest?.('dialog')) opener = trigger;
    if (!opener?.isConnected) opener = document.querySelector('[data-game-trigger]');
    const token = ++request; lastMode = mode;
    retry.hidden = true; status.textContent = 'Loading your game. You can close this at any time.';
    if (!loading.open) loading.showModal(); announce(true);
    // Stop a running cartridge immediately, even on slow/offline connections.
    for (const id of ids) { const dialog = document.getElementById(id); if (dialog?.open) dialog.close(); }
    try {
      await loadStyle('/assets/arcade.css');
      if (token !== request) return false;
      for (const path of stylePaths[mode] || []) { await loadStyle(path); if (token !== request) return false; }
      for (const path of paths[mode]) { await loadScript(path); if (token !== request) return false; }
      if (token !== request) return false;
      const api = mode === 'breaker' ? window.PortfolioTraining : mode === 'piccolo' ? window.PortfolioPiccolo : mode === 'platformer' ? window.PortfolioPlatformer : mode === 'goku' ? window.PortfolioGoku : window.PortfolioArcade;
      if (!api || api.lazy) throw new Error('The cartridge could not start.');
      // Keep one modal active and the original footer/command trigger through handoffs.
      for (const id of ids) { const dialog = document.getElementById(id); if (dialog?.open) dialog.close(); }
      loading.close();
      const result = ['choose', 'ki', 'radar'].includes(mode) ? api.open(mode, opener) : api.open(opener);
      if (result === false) throw new Error('The cartridge could not open.');
      return true;
    } catch (error) {
      if (token !== request) return false;
      if (!loading.open) loading.showModal(); announce(true);
      status.textContent = 'This cartridge could not load. Check your connection, then try again.';
      retry.hidden = false; retry.focus();
      throw error;
    }
  }
  const run = (mode, trigger) => open(mode, trigger).catch(() => false);
  window.PortfolioGames = Object.freeze({ open, run });
  window.PortfolioArcade = { lazy: true, open: (mode, trigger) => run(mode, trigger) };
  window.PortfolioTraining = { lazy: true, open: trigger => run('breaker', trigger) };
  window.PortfolioGoku = { lazy: true, open: trigger => run('goku', trigger) };
  document.querySelectorAll('[data-arcade-open]').forEach(button => button.addEventListener('click', () => run(button.dataset.arcadeOpen, button)));
  document.querySelectorAll('[data-training-open]').forEach(button => button.addEventListener('click', () => run('breaker', button)));
  window.addEventListener('portfolio:view', () => { if (loading.open) dismiss(); });
})();
