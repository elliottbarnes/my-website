import { test, expect } from '@playwright/test';
import { runCallbacks } from './helpers/clock.mjs';

// This observer returns a serialized copy. Navigation uses real browser key or
// touch events; it never alters a life, actor, collectible, or game phase.
async function openGame(page) {
  await page.route(/\/assets\/goku-platformer(?:\.[a-f0-9]+)?\.js/, async route => {
    const response = await route.fetch(), source = await response.text();
    const anchor = '  const keys = new Set()';
    expect(source).toContain(anchor);
    const body = source.replace(anchor, `  Object.defineProperty(window, '__gokuSnapshot', { get() { return JSON.parse(JSON.stringify({game, lock: targetForDash(game), solids, paused})); } });\n${anchor}`);
    await route.fulfill({ response, body });
  });
  await page.goto('/playground.html');
  await page.locator('.scene-body').focus(); await page.keyboard.press('/');
  await page.locator('#command-input').fill('platformer'); await page.locator('#command-input').press('Enter');
  await expect(page.locator('#platformer-dialog')).toBeVisible();
}
const snapshot = page => page.evaluate(() => window.__gokuSnapshot);
async function clearHit(control) {
  await control.scrollIntoViewIfNeeded();
  expect(await control.evaluate(element => {
    const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
}

for (const controls of ['keyboard', 'touch']) test(`Goku: normal ${controls} play completes the course and an immediate retry starts fresh`, async ({ page, browserName }, testInfo) => {
  test.skip(controls === 'touch' && browserName !== 'chromium', 'Full multitouch input needs CDP; native touch reachability is covered on both engines.');
  if (controls === 'touch') await page.setViewportSize({ width: 390, height: 844 });
  test.setTimeout(90_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openGame(page);
  // Run every browser animation/physics callback in small clock batches. IPC
  // and runner CPU speed must not turn a requested jump into a late air rush.
  // The separate real-time play evidence verifies the unmodified live clock.
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.locator('#platform-action').click(); await page.clock.runFor(32);
  const held = new Set(), events = [], bankedChains = new Map(); let lastEvent = -1, decisionBatches = 0, touchGeometry;
  const cdp = controls === 'touch' ? await page.context().newCDPSession(page) : null, contacts = new Map();
  const touchControls = { ArrowRight: ['right', 1], ArrowLeft: ['left', 2], Space: ['jump', 3], x: ['attack', 4] };
  const observe = () => page.evaluate(touch => {
    const state = window.__gokuSnapshot;
    if (touch && state.game.phase === 'playing') {
      // Read current geometry with the existing observation, rather than making
      // a separate protocol call for every press. Status wrapping/scrolling can
      // still move a button: its center and actual hit target are refreshed.
      state.touchGeometry = Object.fromEntries([...document.querySelectorAll('[data-platform-hold]')].map(button => {
        const r = button.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return [button.dataset.platformHold, { x, y, receivesTouch: hit === button || button.contains(hit) }];
      }));
    }
    return state;
  }, Boolean(cdp));
  const key = async (name, on) => {
    if (on === held.has(name)) return;
    if (cdp) {
      if (on) {
        const [control, id] = touchControls[name], point = touchGeometry[control];
        expect(point.receivesTouch, `${control} must receive the real touch`).toBe(true);
        contacts.set(name, { id, x: point.x, y: point.y, radiusX: 2, radiusY: 2 }); held.add(name);
      } else held.delete(name);
      // CDP touchEnd identifies the ended contacts, not those still held.
      await cdp.send('Input.dispatchTouchEvent', { type: on ? 'touchStart' : 'touchEnd', touchPoints: on ? [...held].map(key => contacts.get(key)) : [contacts.get(name)] });
    } else if (on) { await page.keyboard.down(name); held.add(name); }
    else { await page.keyboard.up(name); held.delete(name); }
  };
  const start = Date.now();
  while (Date.now() - start < 75_000) {
    const observed = await observe(), { game, lock, solids, paused } = observed, p = game.player;
    touchGeometry = observed.touchGeometry;
    if (game.eventId !== lastEvent) { lastEvent = game.eventId; events.push({ event: game.event, time: game.time, lives: game.lives, chain: game.chain }); }
    // Banking persists after its short-lived event/announcement; a slow runner
    // need not observe the exact landing frame to verify the earned result.
    if (game.bankedChain) bankedChains.set(game.bankedChain.at, game.bankedChain);
    if (game.phase !== 'playing') break;
    // Focus can change during a browser run. Resume only through the same P key
    // a player uses; inputs cleared by pause must receive fresh physical edges.
    if (paused) { for (const name of [...held]) await key(name, false); held.clear(); await page.locator('#platform-canvas').focus(); await page.keyboard.press('p'); continue; }
    const ball = game.orbs.find(orb => !orb.collected), guardian = game.enemies.find(enemy => enemy.kind === 'guardian');
    const goal = ball ? ball.x : guardian.alive ? 5480 : 5890;
    let direction = Math.abs(goal - p.x) > (!ball && guardian.alive ? 12 : 4) ? Math.sign(goal - p.x) : 0;
    if (!ball && guardian.alive && Math.abs(goal - p.x) < 18 && p.facing < 0) direction = 1;
    let jump = false;
    if (direction > 0) {
      jump = solids.some(tile => tile.y < 306 && tile.y < p.y + p.h && tile.y > p.y + p.h - 105 && tile.x - p.x > 15 && tile.x - p.x < 80);
      jump ||= game.enemies.some(enemy => enemy.alive && enemy.x - p.x > 5 && enemy.x - p.x < 90 && Math.abs(p.y + p.h - 306) < 6);
      jump ||= solids.some(tile => tile.y === 306 && p.x >= tile.x && p.x < tile.x + tile.w && tile.x + tile.w - p.x < 75 && tile.x + tile.w < 6000);
    }
    jump ||= game.hazards.some(shot => Math.abs(shot.x - p.x) < 100 && (shot.x - p.x) * shot.vx < 0);
    if (ball && Math.abs(goal - p.x) < 25 && ball.y + ball.h < p.y + p.h - 15) jump = true;
    const rush = lock && ball && direction > 0 && lock.point.x <= goal + 25;
    await key('ArrowRight', direction > 0); await key('ArrowLeft', direction < 0);
    await key('Space', p.grounded ? !p.jumpHeld && jump : p.jumpHeld);
    await key('x', !p.attackHeld && (p.grounded ? p.cooldown === 0 : Boolean(rush)));
    await page.clock.runFor(32); decisionBatches++;
  }
  for (const name of [...held]) await key(name, false);
  const { game } = await snapshot(page);
  await testInfo.attach('normal-input-run', { body: JSON.stringify({ events, bankedChains: [...bankedChains.values()], phase: game.phase, score: game.score, longestChain: game.longestChain, time: game.time, decisionBatches }), contentType: 'application/json' });
  expect(game.phase).toBe('won'); expect(game.orbs.filter(orb => orb.collected)).toHaveLength(7);
  expect(game.enemies.find(enemy => enemy.kind === 'guardian').alive).toBe(false);
  expect(game.longestChain).toBeGreaterThanOrEqual(3); expect(game.checkpoint).toBe(5170);
  expect([...bankedChains.values()].some(chain => chain.count >= 2 && chain.points > 0)).toBe(true);
  await expect(page.locator('#platform-result-total')).toContainText('CLEAR');
  await page.screenshot({ path: testInfo.outputPath('goku-clear.png') });
  await page.locator('#platform-action').click();
  const fresh = await snapshot(page); expect(fresh.game.lives).toBe(3); expect(fresh.game.score).toBe(0);
  expect(fresh.game.orbs.every(orb => !orb.collected)).toBe(true);
  await page.keyboard.press('p'); await expect(page.locator('#platform-pause')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape'); await expect(page.locator('#arcade-picker')).toBeVisible();
  expect(errors).toEqual([]);
  if (cdp) await cdp.detach();
});

test('Goku: collision failure, retry and cleared held inputs are visible to the player', async ({ page }) => {
  test.setTimeout(35_000);
  await openGame(page); await page.locator('#platform-action').click();
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#platformer-dialog')).toHaveAttribute('data-phase', 'lost', { timeout: 25_000 });
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#platform-status')).toContainText('Run ended');
  await page.locator('#platform-action').click();
  await expect(page.locator('#platform-lives')).toHaveText('3');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(120);
  await page.keyboard.press('p'); await page.keyboard.up('ArrowRight');
  const paused = await snapshot(page); await page.waitForTimeout(120);
  expect((await snapshot(page)).game.time).toBe(paused.game.time);
  await page.keyboard.press('p');
  await expect.poll(async () => (await snapshot(page)).game.player.vx).toBe(0);
  const settled = await snapshot(page); await page.waitForTimeout(150);
  expect((await snapshot(page)).game.player.x).toBe(settled.game.player.x);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#platform-pause')).toHaveAttribute('aria-pressed', 'true');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 375 }]) {
  test(`Goku: ${viewport.width}×${viewport.height} touch controls remain reachable`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ baseURL, viewport, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await openGame(page);
      for (const control of await page.locator('#platformer-dialog button:not(:disabled), #platformer-dialog summary').all()) await clearHit(control);
      await page.locator('#platform-action').tap();
      const jump = page.locator('[data-platform-hold="jump"]'); await clearHit(jump); await jump.tap();
      await expect.poll(async () => (await snapshot(page)).game.player.y).toBeLessThan(275);
      await page.screenshot({ path: testInfo.outputPath(`goku-${viewport.width}.png`) });
      await page.locator('#platform-pause').tap();
      await expect(page.locator('#platform-pause')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await context.close(); }
  });
}

test('Goku: a cancelled real multitouch hold releases movement and jump', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Continuous multitouch injection requires Chromium CDP; native taps are covered on both engines.');
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await openGame(page); await page.locator('#platform-action').tap();
    const center = async selector => { const r = await page.locator(selector).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, radiusX: 2, radiusY: 2 }; };
    const right = await center('[data-platform-hold="right"]'), jump = await center('[data-platform-hold="jump"]');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...right, id: 1 }, { ...jump, id: 2 }] });
    await page.waitForTimeout(220);
    const moving = await snapshot(page); expect(moving.game.player.x).toBeGreaterThan(100); expect(moving.game.player.y).toBeLessThan(250);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator('[data-platform-hold][data-held]')).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page)).game.player.vx).toBe(0); const released = await snapshot(page);
    await page.waitForTimeout(200); expect((await snapshot(page)).game.player.x).toBe(released.game.player.x);
    await cdp.detach();
  } finally { await context.close(); }
});


// Queue a real second input just before the first connection. The observer is
// read-only; the character starts on the same ground as every new player.
async function approachFirstConnection(page) {
  await openGame(page); await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.locator('#platform-action').click();
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
  for (let i = 0; i < 60 && !(await snapshot(page)).lock; i++) await page.clock.runFor(8);
  expect((await snapshot(page)).lock).toBeTruthy();
  await page.keyboard.press('x');
  for (let i = 0; i < 8 && !(await snapshot(page)).game.rushes; i++) await page.clock.runFor(8);
  for (let i = 0; i < 60; i++) {
    const { game } = await snapshot(page), p = game.player;
    expect(p.dash).toBeTruthy();
    const ring = game.rings.find(target => target.id === p.dash.target);
    const distance = Math.hypot(ring.x + 7 - p.x - p.w / 2, ring.y + 7 - p.y - p.h / 2);
    if (distance < 34) return;
    await page.clock.runFor(8);
  }
  throw new Error('The starting ring was not reached through ordinary input.');
}

test('Goku: an early second rush connects once and a held key never chains itself', async ({ page }, testInfo) => {
  await approachFirstConnection(page);
  await page.keyboard.down('x'); await runCallbacks(page, 240);
  const { game } = await snapshot(page);
  expect(game.connections).toBe(2); expect(game.rushes).toBe(2);
  expect(game.player.rushBuffer).toBe(0); expect(game.orbs[0].collected).toBe(true);
  await expect(page.locator('#platform-record')).toHaveText('◇ goal: chain 3');
  await page.screenshot({ path: testInfo.outputPath('goku-chain.png') });
  await page.keyboard.up('x'); await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
});

test('Goku: pausing a queued rush cancels it before resuming', async ({ page }) => {
  await approachFirstConnection(page);
  await page.keyboard.press('x'); await page.clock.runFor(16);
  expect((await snapshot(page)).game.player.rushBuffer).toBeGreaterThan(0);
  await page.keyboard.press('p');
  expect((await snapshot(page)).game.player.rushBuffer).toBe(0);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
  await runCallbacks(page, 150); await page.keyboard.press('p'); await runCallbacks(page, 240);
  const { game } = await snapshot(page);
  expect(game.connections).toBe(1); expect(game.rushes).toBe(1);
});

// A first-session success should matter even if the full course is still hard.
// Earn the chain, lose through ordinary controls, and retry through a real tap.
test('Goku: a short earned chain survives failure, touch retry and reload', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await openGame(page); await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.locator('#platform-action').tap();
    await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
    for (let i = 0; i < 500; i++) {
      const { game, lock } = await snapshot(page);
      if (game.longestChain >= 3) break;
      if (lock && !game.player.attackHeld) await page.keyboard.down('x'); else await page.keyboard.up('x');
      await page.clock.runFor(16);
    }
    expect((await snapshot(page)).game.longestChain).toBe(3);
    await page.keyboard.up('Space'); await page.keyboard.up('x');
    for (let i = 0; i < 200 && (await snapshot(page)).game.phase !== 'lost'; i++) await page.clock.runFor(96);
    await page.keyboard.up('ArrowRight');
    await expect(page.locator('#platformer-dialog')).toHaveAttribute('data-phase', 'lost');
    await expect(page.locator('#platform-status')).toContainText('BOT COLLISION. Jump over it or tap X / B on the ground.');
    await expect(page.locator('#platform-result-compare')).toContainText('Chain goal 3 reached! Next goal: chain 4.');
    await expect(page.locator('#platform-result-records')).toContainText('Best chain 3 · saved here');
    expect(await page.evaluate(() => localStorage.getItem('portfolio:goku-ki-rush:v1'))).toBeNull();
    await page.screenshot({ path: testInfo.outputPath('short-run-mastery.png') });
    const retry = page.locator('#platform-action'); await clearHit(retry); await retry.tap();
    await expect(page.locator('#platform-record')).toHaveText('◇ goal: chain 4');
    await expect(page.locator('#platform-chain-best')).toHaveText('3');
    await expect(page.locator('#platform-score')).toHaveText('0');
    await page.keyboard.press('Escape'); await page.reload();
    await page.locator('.scene-body').focus(); await page.keyboard.press('/');
    await page.locator('#command-input').fill('platformer'); await page.locator('#command-input').press('Enter');
    await expect(page.locator('#platform-record')).toHaveText('◇ goal: chain 4');
    await expect(page.locator('#platform-chain-best')).toHaveText('3');
  } finally { await context.close(); }
});
