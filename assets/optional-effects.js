// Source discoveries load only after an explicit activation. Literal URLs let
// the build content-address every dependency, including optional files.
(() => {
  'use strict';
  const scripts = new Map();
  const base = ['/assets/entrance-effects.js'];
  const groups = {
    ecdsa: ['/assets/ecdsa-math.js', '/assets/ecdsa-effect.js'],
    signal: ['/assets/source-signal-effects.js'],
    structure: ['/assets/source-structure-effects.js'],
  };
  const kinds = new Set(['history', 'tokens', 'sort', 'automaton', 'graph', 'interference',
    'ecdsa', 'fourier', 'attractor', 'phyllotaxis', 'pathfinding', 'quadtree', 'convolution']);
  const group = kind => kind === 'ecdsa' ? 'ecdsa'
    : ['fourier', 'attractor', 'phyllotaxis'].includes(kind) ? 'signal'
      : ['pathfinding', 'quadtree', 'convolution'].includes(kind) ? 'structure' : null;
  function ready(kind) {
    if (!kinds.has(kind)) return true; // Portrait and framebuffer live in the core.
    if (!window.PortfolioEntranceEffects) return false;
    const category = group(kind);
    return category === 'ecdsa' ? Boolean(window.PortfolioECDSA && window.PortfolioECDSAEffect)
      : category === 'signal' ? Boolean(window.PortfolioSignalEffects)
        : category === 'structure' ? Boolean(window.PortfolioStructureEffects) : true;
  }
  function loadScript(path) {
    if (scripts.has(path)) return scripts.get(path);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path; script.async = false;
      const timer = setTimeout(() => finish(new Error('Source experiment timed out.')), 12000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = null; script.onerror = null;
        if (error) { script.remove(); scripts.delete(path); reject(error); }
        else resolve();
      }
      script.onload = () => finish();
      script.onerror = () => finish(new Error('Source experiment could not load.'));
      document.head.append(script);
    });
    scripts.set(path, promise);
    return promise;
  }
  async function load(kind) {
    if (ready(kind)) return;
    const paths = [...base, ...(groups[group(kind)] || [])];
    for (const path of paths) await loadScript(path);
    if (!ready(kind)) {
      for (const path of paths) scripts.delete(path);
      throw new Error('Source experiment could not start.');
    }
  }
  window.PortfolioEffects = Object.freeze({ ready, load });
})();
