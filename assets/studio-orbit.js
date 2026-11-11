/* A small, optional kinetic composition. Project navigation never moves. */
(() => {
  'use strict';
  const root = document.querySelector('[data-orbit]');
  if (!root) return;
  const stage = root.querySelector('[data-orbit-stage]');
  const cards = [...root.querySelectorAll('[data-orbit-item]')];
  const controls = root.querySelector('[data-orbit-controls]');
  const pauseButton = root.querySelector('[data-orbit-pause]');
  const resetButton = root.querySelector('[data-orbit-reset]');
  const status = root.querySelector('[data-orbit-status]');
  if (!stage || !cards.length || !controls || !pauseButton || !resetButton) return;

  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  const angles = cards.map(card => Number(card.dataset.angle) || 0);
  let paused = preference.matches;
  let inView = true, focused = true, frame = 0, previous = null, phase = 0;
  let x = 0, y = 0, velocityX = 0, velocityY = 0, targetX = 0, targetY = 0;
  let limitX = 40, limitY = 28, pointer = null;

  function render() {
    cards.forEach((card, index) => {
      const seed = index * 1.71;
      const depth = 0.72 + (index % 3) * 0.13;
      // Subtract each starting phase so Reset exactly restores the CSS layout.
      const orbitX = (Math.sin(phase * 0.24 + seed) - Math.sin(seed)) * 7;
      const orbitY = (Math.cos(phase * 0.2 + seed) - Math.cos(seed)) * 5;
      const tilt = x * 0.025 * depth + Math.sin(phase * 0.18) * (index % 2 ? -1 : 1);
      card.style.transform = `translate3d(${(x * depth + orbitX).toFixed(3)}px, ${(y * depth + orbitY).toFixed(3)}px, 0) rotate(${(angles[index] + tilt).toFixed(3)}deg)`;
    });
  }

  function canAnimate() { return !paused && inView && focused && !document.hidden; }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
  }
  function schedule() {
    if (!canAnimate()) { stop(); return; }
    if (!frame) frame = window.requestAnimationFrame(tick);
  }
  function tick(timestamp) {
    frame = 0;
    if (!canAnimate()) { previous = null; return; }
    const dt = previous === null ? 0 : Math.min(0.032, Math.max(0, (timestamp - previous) / 1000));
    previous = timestamp;
    phase += dt;
    const dragging = pointer?.dragging;
    const stiffness = dragging ? 95 : 20;
    const damping = dragging ? 20 : 8;
    velocityX += ((dragging ? targetX : 0) - x) * stiffness * dt - velocityX * damping * dt;
    velocityY += ((dragging ? targetY : 0) - y) * stiffness * dt - velocityY * damping * dt;
    x = clamp(x + velocityX * dt, limitX);
    y = clamp(y + velocityY * dt, limitY);
    render();
    schedule();
  }

  function announce(message) { if (status) status.textContent = message; }
  function updateControls() {
    root.dataset.orbitPaused = String(paused);
    pauseButton.textContent = paused ? 'Resume motion' : 'Pause motion';
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  function finishPointer(event, cancelled = false) {
    if (!pointer || (event?.pointerId !== undefined && pointer.id !== event.pointerId)) return;
    const id = pointer.id;
    pointer = null;
    delete root.dataset.orbitDragging;
    targetX = x;
    targetY = y;
    if (cancelled || paused) velocityX = velocityY = 0;
    if (stage.hasPointerCapture?.(id)) stage.releasePointerCapture(id);
  }
  function setPaused(value, message = true) {
    finishPointer(null, true);
    paused = value;
    velocityX = velocityY = 0;
    updateControls();
    schedule();
    if (message) announce(paused ? 'Motion paused. You can still drag or use the arrow keys.' : 'Motion resumed.');
  }
  function reset() {
    finishPointer(null, true);
    x = y = targetX = targetY = velocityX = velocityY = phase = 0;
    previous = null;
    render();
    announce('Composition reset.');
    schedule();
  }
  function resize() {
    limitX = Math.min(64, stage.clientWidth * 0.11);
    limitY = Math.min(42, stage.clientHeight * 0.09);
    x = clamp(x, limitX); y = clamp(y, limitY);
    targetX = clamp(targetX, limitX); targetY = clamp(targetY, limitY);
    render();
  }
  function beginDrag(event) {
    pointer.dragging = true;
    root.dataset.orbitDragging = 'true';
    stage.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
  }

  stage.addEventListener('pointerdown', event => {
    if (pointer || event.isPrimary === false || event.button !== 0) return;
    pointer = { id: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY,
      originX: x, originY: y, dragging: false };
    targetX = x; targetY = y; velocityX = velocityY = 0;
    // Let a vertical touch gesture become native page scrolling before capture.
    if (event.pointerType !== 'touch') beginDrag(event);
  });
  stage.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.startX, dy = event.clientY - pointer.startY;
    if (!pointer.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { finishPointer(event, true); return; }
      if (Math.abs(dx) < 8) return;
      beginDrag(event);
    }
    if (event.cancelable) event.preventDefault();
    targetX = clamp(pointer.originX + dx * 0.55, limitX);
    targetY = clamp(pointer.originY + dy * 0.4, limitY);
    if (paused) { x = targetX; y = targetY; render(); }
    else schedule();
  });
  window.addEventListener('pointerup', event => finishPointer(event));
  window.addEventListener('pointercancel', event => finishPointer(event, true));
  stage.addEventListener('lostpointercapture', event => finishPointer(event, true));
  stage.addEventListener('dragstart', event => event.preventDefault());
  stage.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (directions[event.key]) {
      event.preventDefault();
      finishPointer(null, true);
      const [dx, dy] = directions[event.key];
      x = clamp(x + dx * 14, limitX); y = clamp(y + dy * 14, limitY);
      velocityX = velocityY = 0;
      render(); schedule();
    } else if (event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) setPaused(!paused);
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault(); reset();
    }
  });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  resetButton.addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishPointer(null, true);
    schedule();
  });
  window.addEventListener('blur', () => { focused = false; finishPointer(null, true); stop(); });
  window.addEventListener('focus', () => { focused = true; schedule(); });
  window.addEventListener('resize', resize);
  preference.addEventListener('change', event => {
    if (event.matches) setPaused(true);
  });
  if ('IntersectionObserver' in window) {
    const observer = new window.IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) finishPointer(null, true);
      schedule();
    }, { threshold: 0.05 });
    observer.observe(stage);
  }

  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  if (!stage.hasAttribute('aria-label')) stage.setAttribute('aria-label', 'Interactive orbital composition');
  stage.setAttribute('aria-describedby', 'orbit-instructions');
  controls.hidden = false;
  root.dataset.orbitReady = 'true';
  updateControls(); resize(); schedule();
  if (paused) announce('Motion paused for your reduced-motion preference.');
})();
