(() => {
  'use strict';
  const cards = [...document.querySelectorAll('[data-project]')];
  const names = cards.map(card => card.querySelector('h3').textContent);
  let selected = 0;
  let audio = null;
  let sound = false;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionOff = motionPreference.matches;
  let motionChosen = false;
  const reduced = () => motionOff || motionPreference.matches;
  const typing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  const cue = () => {
    if (!sound) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      void audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + .07);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + .08);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { sound = false; syncSound(); }
  };
  const soundButton = document.querySelector('[data-sound-toggle]');
  function syncSound() {
    soundButton.textContent = `Sound: ${sound ? 'on' : 'off'}`;
    soundButton.setAttribute('aria-pressed', String(sound));
  }
  soundButton.addEventListener('click', () => { sound = !sound; syncSound(); cue(); });
  const motionButton = document.querySelector('[data-motion-toggle]');
  function syncMotion() {
    document.documentElement.dataset.motion = reduced() ? 'reduced' : 'full';
    motionButton.textContent = reduced() ? 'Motion: reduced' : 'Motion: on';
    motionButton.setAttribute('aria-pressed', String(reduced()));
    motionButton.disabled = motionPreference.matches;
    motionButton.title = motionPreference.matches ? 'Following your device’s reduced-motion preference' : 'Reduce animation';
  }
  motionButton.addEventListener('click', () => { motionChosen = true; motionOff = !motionOff; syncMotion(); });
  motionPreference.addEventListener('change', () => { if (!motionChosen) motionOff = motionPreference.matches; syncMotion(); });
  syncMotion();
  function select(index, {scroll = false, focus = false} = {}) {
    selected = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      card.classList.toggle('is-selected', i === selected);
      if (i === selected) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
    });
    document.querySelector('[data-selection-status]').textContent = `0${selected + 1} / ${names[selected]} selected`;
    if (scroll) cards[selected].scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block: 'center'});
    if (focus) cards[selected].focus({preventScroll: true});
  }
  select(0);
  cards.forEach((card, i) => {
    card.setAttribute('aria-label', `Load ${names[i]} cartridge`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.querySelector('.card-action').firstChild.textContent = 'LOAD CARTRIDGE ';
    card.addEventListener('focus', () => select(i));
    card.addEventListener('click', () => { select(i); cue(); });
  });
  document.querySelectorAll('[data-select-step]').forEach(button => button.addEventListener('click', () => { select(selected + Number(button.dataset.selectStep)); cue(); }));
  function closeOthers(except) {
    document.querySelectorAll('dialog[open]').forEach(dialog => { if (dialog !== except) dialog.close(); });
  }
  function openProject(id = cards[selected].dataset.project) {
    closeOthers();
    window.portfolioPlayground?.open(id);
    cue();
  }
  document.querySelectorAll('[data-controller-open]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); openProject(); }));
  const go = id => {
    closeOthers();
    const destination = document.getElementById(id);
    destination?.scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block: 'start'});
    const focusTarget = destination?.querySelector('h1, h2') ?? destination;
    if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({preventScroll: true}); }
  };
  document.querySelectorAll('[data-controller-back]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); go('top'); cue(); }));

  const tools = {
    Java: ['Reconcile Kit uses Java for typed records and exact-money reconciliation.', ['reconcile-kit']],
    Python: ['Python powers the inference, evaluation, and image experiment projects.', ['batchline', 'evaldeck', 'prism-studio']],
    Gradle: ['Gradle builds and tests Reconcile Kit.', ['reconcile-kit']],
    awk: ['awk is useful for quick checks of delimited data alongside Reconcile Kit’s CSV workflow.', ['reconcile-kit']],
    'C++': ['Part of my wider toolkit. No C++ project is featured in this four-cartridge collection yet.', []],
    PyTorch: ['PyTorch provides the model runtime for Prism Studio’s image workbench.', ['prism-studio']],
    Streamlit: ['Streamlit provides the interface for Prism Studio’s local image workbench.', ['prism-studio']],
    Docker: ['Docker provides reproducible environments for running the Batchline service.', ['batchline']],
    AWS: ['This portfolio is hosted on AWS with a private S3 origin and CloudFront delivery.', []],
    Diffusers: ['Diffusers powers the image-generation pipelines in Prism Studio.', ['prism-studio']],
  };
  const toolButtons = [...document.querySelectorAll('[data-tool]')];
  toolButtons.forEach(button => { button.disabled = false; });
  const toolHint = document.querySelector('[data-tool-hint]');
  if (toolHint) toolHint.textContent = 'Tap a tool to see where it fits.';
  function filterTool(tool) {
    const [description, ids] = tools[tool] ?? ['Choose a tool to explore its role in these projects.', []];
    toolButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
    document.querySelector('[data-tool-description]').textContent = description;
    cards.forEach(card => card.classList.toggle('tool-match', ids.includes(card.dataset.project)));
    const targets = document.querySelector('[data-tool-projects]');
    targets.replaceChildren();
    ids.forEach(id => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button';
      button.textContent = `Try ${names[cards.findIndex(card => card.dataset.project === id)]}`;
      button.addEventListener('click', () => openProject(id)); targets.append(button);
    });
    document.querySelector('[data-tool-reset]').hidden = !tool;
  }
  toolButtons.forEach(button => button.addEventListener('click', () => filterTool(button.getAttribute('aria-pressed') === 'true' ? null : button.dataset.tool)));
  document.querySelector('[data-tool-reset]').addEventListener('click', () => {
    const previous = toolButtons.find(button => button.getAttribute('aria-pressed') === 'true');
    filterTool(null); previous?.focus();
  });

  const terminal = document.createElement('dialog');
  terminal.className = 'terminal-dialog';
  terminal.setAttribute('aria-labelledby', 'terminal-title');
  terminal.innerHTML = `<div class="terminal-bar"><h2 id="terminal-title">elliott / terminal</h2><button type="button" class="text-button" data-terminal-close aria-label="Close terminal">Close · Esc</button></div>
    <p class="terminal-intro">A shortcut to explore. Choose a command or type one below.</p>
    <div class="terminal-commands" aria-label="Suggested commands"></div>
    <div class="terminal-output" role="status" aria-live="polite" aria-atomic="true">Ready. Try help to see the commands.</div>
    <form class="terminal-form"><label for="terminal-input">Command</label><div><input id="terminal-input" name="command" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Try projects" maxlength="100"><button type="submit" class="text-button">Run</button></div></form>`;
  document.body.append(terminal);
  const input = terminal.querySelector('input');
  let terminalOpener;
  let restoreTerminalFocus = true;
  function openTerminal() {
    terminalOpener = document.activeElement;
    restoreTerminalFocus = true;
    closeOthers(terminal); if (!terminal.open) terminal.showModal();
    input.value = ''; input.focus();
  }
  terminal.addEventListener('close', () => {
    // Do not steal focus from another dialog opened by a terminal command.
    if (restoreTerminalFocus && !document.querySelector('dialog[open]') && terminalOpener?.isConnected) terminalOpener.focus({preventScroll:true});
  });
  terminal.querySelector('[data-terminal-close]').addEventListener('click', () => terminal.close());
  const output = terminal.querySelector('.terminal-output');
  function command(raw) {
    const command = raw.trim().toLowerCase();
    if (!command) { output.textContent = 'Enter a command, or choose one above.'; return; }
    const destinations = {projects:'work', about:'about', contact:'contact', toolkit:'toolkit'};
    if (Object.hasOwn(destinations, command)) { restoreTerminalFocus = false; terminal.close(); go(destinations[command]); return; }
    if (command === 'theme') {
      document.querySelector('[data-theme-toggle]').click();
      output.textContent = `Theme switched to ${document.documentElement.dataset.theme}.`; return;
    }
    if (command === 'arcade') { terminal.close(); window.portfolioArcade?.open(); return; }
    if (command === 'help') { output.textContent = 'projects · about · contact · toolkit · theme · arcade · clear. You can also type a project name: batchline, evaldeck, reconcile-kit, prism-studio.'; return; }
    if (command === 'clear') { output.textContent = 'Terminal cleared. Ready for a command.'; return; }
    if (cards.some(card => card.dataset.project === command)) { terminal.close(); openProject(command); return; }
    output.textContent = `Unknown command: “${raw.trim()}”. Try help or choose a suggestion.`;
  }
  ['projects','about','contact','toolkit','theme','help'].forEach(name => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = name;
    button.addEventListener('click', () => command(name)); terminal.querySelector('.terminal-commands').append(button);
  });
  terminal.querySelector('form').addEventListener('submit', event => { event.preventDefault(); command(input.value); input.value = ''; });
  document.querySelectorAll('[data-terminal-open]').forEach(button => button.addEventListener('click', openTerminal));
  // Delegated, capture-phase coordination keeps only one modal active.
  document.addEventListener('click', event => {
    if (event.target.closest('[data-arcade-open]')) closeOthers();
    if (event.target.closest('[data-project]')) closeOthers();
  }, true);
  document.addEventListener('keydown', event => {
    if (typing(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (document.querySelector('dialog[open]')) {
      if (event.key.toLowerCase() === 'b' && !terminal.open) { event.preventDefault(); closeOthers(); }
      return;
    }
    if (event.key === '/') { event.preventDefault(); openTerminal(); return; }
    // Arrow navigation is scoped to the controller/collection; it never steals page scrolling elsewhere.
    const inCollection = event.target.closest('.controller-area, .project-grid');
    if (inCollection && ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)) {
      event.preventDefault(); select(selected + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1), {scroll: true, focus: true}); cue();
    } else if (inCollection && event.key.toLowerCase() === 'a') { event.preventDefault(); openProject(); }
    else if (inCollection && event.key.toLowerCase() === 'b') { event.preventDefault(); go('top'); }
  });
  document.querySelectorAll('[data-terminal-open], .dpad-controls, .comfort-controls, [data-arcade-open], [data-selection-status], .keyboard-hint, #tool-detail').forEach(el => { el.hidden = false; });
})();
