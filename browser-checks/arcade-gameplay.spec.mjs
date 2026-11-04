import { test, expect } from '@playwright/test';

async function command(page, name) {
  await page.locator('.scene-body').focus();
  await page.keyboard.press('/');
  await page.locator('#command-input').fill(name);
  await page.locator('#command-input').press('Enter');
}

async function hitTarget(locator) {
  await locator.scrollIntoViewIfNeeded();
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return element === hit || element.contains(hit);
  })).toBe(true);
}

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 375 }]) {
  test(`small arcade games complete and replay with touch at ${viewport.width}×${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(test.info().project.use.baseURL || 'http://127.0.0.1:4178');
      await command(page, 'ki');
      const charge = page.locator('#ki-charge'); await charge.waitFor(); await hitTarget(charge);
      await page.clock.install();
      const times = [1474, 500, 1672, 1232, 1738];
      for (let round = 0; round < times.length; round++) {
        await charge.press('Enter'); await page.clock.runFor(times[round]); await charge.press('Enter');
        if (round === 0) {
          await expect(page.locator('#ki-band')).toHaveText('56–78%');
          await expect(page.locator('#arcade-status')).toContainText('Perfect control!');
        }
        if (round === 1) await expect(page.locator('#arcade-status')).toContainText('Hold a little longer');
      }
      await expect(page.locator('#arcade-status')).toContainText('Training complete: 4 of 5 hits');
      await charge.tap(); await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits');
      // A trusted short tap begins a charge; a second tap releases it.
      await charge.tap(); await page.clock.runFor(1474); await charge.tap();
      await expect(page.locator('#arcade-status')).toContainText('Perfect control!');
      await page.locator('#arcade-close').tap();
      await command(page, 'radar');
      const cells = page.locator('#hunt-grid button'); let reread = false;
      // Complete a real random board using visible grid controls. No targets or state are injected/read.
      for (let index = 0; index < 36; index++) {
        const cell = cells.nth(index); await hitTarget(cell); await cell.tap();
        if (!reread && await cell.getAttribute('data-signal') !== 'found') {
          const before = await page.locator('#arcade-score').textContent(); await cell.tap();
          await expect(page.locator('#arcade-score')).toHaveText(before); reread = true;
        }
        if ((await page.locator('#arcade-status').textContent()).startsWith('All seven')) break;
      }
      await expect(page.locator('#arcade-status')).toContainText('All seven found');
      await expect(page.locator('#hunt-dragon')).toBeVisible();
      await page.locator('#arcade-reset').tap(); await expect(page.locator('#arcade-score')).toHaveText('0 / 7 · 0 scans');
      await cells.first().focus(); await page.keyboard.press('ArrowLeft'); await expect(cells.first()).toBeFocused();
      await page.keyboard.press('ArrowDown'); await expect(cells.nth(6)).toBeFocused();
      await page.keyboard.press('End'); await expect(cells.nth(11)).toBeFocused();
      await expect(page.locator('#hunt-grid button[tabindex="0"]')).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('Ki capture loss cancels cleanly and keyboard repeat cannot spend extra rounds', async ({ page }) => {
  await page.goto('/'); await command(page, 'ki'); const charge = page.locator('#ki-charge');
  await charge.waitFor(); await page.clock.install();
  const bounds = await charge.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.clock.runFor(500);
  // Exercise a browser cancellation boundary; this is not a claim of a physical touch test.
  await charge.dispatchEvent('lostpointercapture', { pointerId: 1 }); await page.mouse.up();
  await expect(charge).toHaveText('charge ki');
  await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits');
  await charge.press('Enter'); await page.clock.runFor(500);
  await charge.dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await expect(charge).toHaveText('release ki');
  await page.locator('#arcade-reset').focus(); await expect(charge).toHaveText('charge ki');
  await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits');
  for (const interruption of ['window', 'focus']) {
    await charge.scrollIntoViewIfNeeded(); const rect = await charge.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.clock.runFor(500);
    if (interruption === 'window') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else await page.locator('#arcade-reset').focus();
    await page.mouse.up(); await page.clock.runFor(2500);
    await expect(charge).toHaveText('charge ki');
    await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits');
  }
});

test('Brick Breaker normal controls produce a perfect return, fair loss, and immediate retry', async ({ page }) => {
  test.setTimeout(60_000);
  // Wrap creation only to observe the unmodified live state. All play uses trusted browser input.
  await page.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'PortfolioBreakerEngine', { configurable: true,
      get: () => engine, set(value) { engine = { ...value, create(...args) {
        const state = value.create(...args); window.__observedBreaker = state; return state;
      } }; },
    });
  });
  await page.goto('/'); await command(page, 'breaker');
  const canvas = page.locator('#training-canvas'); await canvas.waitFor(); await page.clock.install();
  const snapshot = () => page.evaluate(() => {
    const g = window.__observedBreaker;
    return { phase: g.phase, time: g.time, lives: g.lives, perfects: g.perfects, score: g.score,
      paddle: { ...g.paddle }, ball: { ...g.ball }, pulseReadyAt: g.pulseReadyAt };
  });
  let box = await canvas.boundingBox();
  const move = async (x, current) => {
    const from = box.x + box.width / 2, y = box.y + box.height * .75;
    await page.mouse.move(from, y); await page.mouse.down();
    await page.mouse.move(from + (x - current) * box.width / 360, y); await page.mouse.up();
  };
  await canvas.focus(); await page.keyboard.down('ArrowLeft'); await page.clock.runFor(100); await page.keyboard.up('ArrowLeft');
  expect((await snapshot()).paddle.x).toBeLessThan(150);
  await page.keyboard.press('Space');
  for (let i = 0; i < 180 && !(await snapshot()).perfects; i++) {
    const g = await snapshot();
    await move(Math.max(34, Math.min(326, g.ball.x)), g.paddle.x);
    const until = (g.paddle.y - g.ball.radius - g.ball.y) / g.ball.vy;
    if (g.ball.vy > 0 && until > 0 && until < .13 && g.time >= g.pulseReadyAt) await page.keyboard.press('Space');
    await page.clock.runFor(50);
  }
  expect((await snapshot()).perfects).toBeGreaterThan(0);
  expect((await snapshot()).score).toBeGreaterThan(0);
  await page.keyboard.press('p'); const paused = await snapshot(); await page.clock.runFor(1000);
  expect(await snapshot()).toEqual(paused); await page.keyboard.press('p');
  // Deliberately miss each return to verify the complete loss path without changing lives or ball position.
  for (let i = 0; i < 100 && (await snapshot()).phase !== 'lost'; i++) {
    const g = await snapshot();
    if (g.phase === 'ready') await page.keyboard.press('Space');
    await move(g.ball.x > 180 ? 34 : 326, g.paddle.x); await page.clock.runFor(300);
  }
  expect((await snapshot()).phase).toBe('lost'); await expect(page.locator('#training-status')).toContainText('Run complete');
  await page.locator('#training-action').click();
  const retry = await snapshot(); expect(retry.phase).toBe('playing'); expect(retry.lives).toBe(3); expect(retry.score).toBe(0);
  await page.keyboard.press('Escape'); await expect(page.locator('#arcade-picker')).toBeVisible();
});

test('Brick Breaker touch launch, pause, and controls remain reachable on short screens', async ({ browser, baseURL }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 375 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(); await page.goto(baseURL); await command(page, 'breaker');
      const canvas = page.locator('#training-canvas'), pause = page.locator('#training-pause');
      await canvas.waitFor(); await page.clock.install(); await hitTarget(canvas); await canvas.tap();
      await expect(page.locator('#training-action')).toHaveText('pulse · space');
      await page.clock.runFor(1800); expect(Number(await page.locator('#training-score').textContent())).toBeGreaterThan(0);
      await hitTarget(pause); await pause.tap(); await expect(page.locator('#training-status')).toHaveText('training paused');
      await page.clock.runFor(1000); await expect(page.locator('#training-status')).toHaveText('training paused');
      await pause.tap(); await expect(pause).toHaveAttribute('aria-pressed', 'false');
      for (const selector of ['#training-action', '[data-training-close]', '#training-dialog [data-arcade-open]']) {
        await hitTarget(page.locator(selector));
      }
      await page.locator('#training-dialog [data-arcade-open]').tap(); await expect(page.locator('#arcade-picker')).toBeVisible();
    } finally { await context.close(); }
  }
});
