import { test, expect } from '@playwright/test';
import { runCallbacks } from './helpers/clock.mjs';

test('Brick teaches an aimed safe catch before asking for a perfect return', async ({ page }) => {
  // Read-only observation chooses a normal pointer input; it never changes play.
  await page.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'PortfolioBreakerEngine', {
      configurable: true, get: () => engine,
      set(value) { engine = { ...value, create(...args) {
        const state = value.create(...args); window.__breakerAim = state; return state;
      } }; },
    });
  });
  await page.goto('/'); await page.locator('.scene-body').focus();
  await page.keyboard.press('/'); await page.locator('#command-input').fill('breaker');
  await page.locator('#command-input').press('Enter');
  const canvas = page.locator('#training-canvas'); await canvas.waitFor();
  await expect(page.locator('#training-action')).toHaveText('launch · space');
  await expect(page.locator('#training-status')).toContainText('Catch off-centre to aim');
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await canvas.focus(); await page.keyboard.press('Space');
  const snapshot = () => page.evaluate(() => {
    const g = window.__breakerAim;
    return { phase: g.phase, time: g.time, perfects: g.perfects, paddle: { ...g.paddle }, ball: { ...g.ball } };
  });
  let game;
  for (let i = 0; i < 40; i++) {
    game = await snapshot();
    if (game.ball.vy > 0 && game.ball.y > 300) break;
    await runCallbacks(page, 80);
  }
  expect(game.ball.vy).toBeGreaterThan(0);
  const until = (game.paddle.y - game.ball.radius - game.ball.y) / game.ball.vy;
  const span = 360 - 2 * game.ball.radius;
  const travel = game.ball.x - game.ball.radius + game.ball.vx * until;
  const folded = ((travel % (2 * span)) + 2 * span) % (2 * span);
  const landing = game.ball.radius + (folded <= span ? folded : 2 * span - folded);
  // Catch on the left side of the paddle to send the next shot left.
  const target = Math.max(34, Math.min(326, landing + 22));
  const box = await canvas.boundingBox(), x = box.x + game.paddle.x * box.width / 360;
  await page.mouse.move(x, box.y + box.height * .75); await page.mouse.down();
  await page.mouse.move(x + (target - game.paddle.x) * box.width / 360, box.y + box.height * .75);
  await page.mouse.up(); await runCallbacks(page, Math.ceil((until + .04) * 1000));
  game = await snapshot();
  expect(game.ball.vx).toBeLessThan(0); expect(game.ball.vy).toBeLessThan(0);
  expect(game.perfects).toBe(0);
  await expect(page.locator('#training-status')).toContainText('Safe return. Catch off-centre to steer');
  await page.keyboard.press('p'); const paused = await snapshot(); await runCallbacks(page, 500);
  expect(await snapshot()).toEqual(paused);
  await page.keyboard.press('Escape'); await expect(page.locator('#arcade-picker')).toBeVisible();
});
