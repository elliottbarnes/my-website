import { test, expect } from '@playwright/test';

test('Brick Breaker touch drag earns a perfect return and cancellation releases the paddle', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Trusted touch cancellation uses the Chromium input protocol.');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    // Observe the normal engine; never write game state or replace its rules.
    await page.addInitScript(() => {
      let engine;
      Object.defineProperty(window, 'PortfolioBreakerEngine', { configurable: true,
        get: () => engine, set(value) { engine = { ...value, create(...args) {
          const state = value.create(...args); window.__touchBreaker = state; return state;
        } }; },
      });
    });
    await page.goto(baseURL); await page.locator('.scene-body').focus(); await page.keyboard.press('/');
    await page.locator('#command-input').fill('breaker'); await page.keyboard.press('Enter');
    const canvas = page.locator('#training-canvas'); await canvas.waitFor();
    await page.clock.install(); await page.clock.pauseAt(new Date());
    const state = () => page.evaluate(() => {
      const g = window.__touchBreaker;
      return { phase: g.phase, perfects: g.perfects, time: g.time, paddle: { ...g.paddle }, ball: { ...g.ball } };
    });
    const box = await canvas.boundingBox(), client = await context.newCDPSession(page);
    const touch = (type, x = 0) => client.send('Input.dispatchTouchEvent', {
      type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y: box.y + box.height * .7, id: 7 }],
    });
    await canvas.tap();
    let game = await state();
    for (let step = 0; step < 48 && !game.perfects; step++) {
      expect(game.phase).toBe('playing');
      if (game.ball.vy > 0 && game.ball.y > 180) {
        const seconds = (game.paddle.y - game.ball.radius - game.ball.y) / game.ball.vy;
        const span = 360 - 2 * game.ball.radius;
        const travel = game.ball.x - game.ball.radius + game.ball.vx * seconds;
        const folded = ((travel % (2 * span)) + 2 * span) % (2 * span);
        const target = Math.max(34, Math.min(326, game.ball.radius + (folded <= span ? folded : 2 * span - folded)));
        await touch('touchStart', box.x + game.paddle.x / 360 * box.width);
        await touch('touchMove', box.x + target / 360 * box.width);
        await touch('touchEnd');
        if (seconds <= .15) {
          expect(seconds).toBeGreaterThan(0);
          await page.locator('#training-action').tap();
          await page.clock.runFor(Math.ceil((seconds + .04) * 1000));
        } else await page.clock.runFor(Math.min(200, Math.floor((seconds - .1) * 1000)));
      } else await page.clock.runFor(200);
      game = await state();
    }
    expect(game.perfects).toBeGreaterThan(0);
    await expect(page.locator('#training-status')).toContainText('Perfect return');
    // A real touch cancellation ends the drag; a later new finger owns only
    // its own movement, with no jump from the cancelled finger's origin.
    await touch('touchStart', box.x + box.width / 2);
    await touch('touchMove', box.x + box.width / 2 - 20);
    await touch('touchCancel');
    const before = (await state()).paddle.x;
    await touch('touchStart', box.x + box.width * .3);
    expect((await state()).paddle.x).toBeCloseTo(before, 4);
    await touch('touchMove', box.x + box.width * .3 + 12);
    expect((await state()).paddle.x).toBeCloseTo(Math.min(326, before + 12 / box.width * 360), 2);
    await touch('touchEnd');
    await page.locator('#training-pause').tap(); const paused = await state();
    await page.clock.runFor(1000); expect(await state()).toEqual(paused);
    await page.locator('#training-dialog [data-arcade-open]').tap();
    await expect(page.locator('#arcade-picker')).toBeVisible();
  } finally { await context.close(); }
});
