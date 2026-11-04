import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin
    ? route.continue() : route.abort());
  await page.addInitScript(() => {
    window.__radarFrames = { draws: 0, display: 0, armed: false };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.id === 'profile-plot' && window.__radarFrames.armed) window.__radarFrames.draws++;
      return clear.apply(this, args);
    };
    const monitor = () => {
      if (window.__radarFrames.armed) window.__radarFrames.display++;
      requestAnimationFrame(monitor);
    };
    requestAnimationFrame(monitor);
  });
});

async function sample(page, milliseconds = 300) {
  await page.evaluate(() => Object.assign(window.__radarFrames, { draws: 0, display: 0, armed: true }));
  await page.waitForTimeout(milliseconds);
  return page.evaluate(() => { window.__radarFrames.armed = false; return window.__radarFrames; });
}

test('radar follows display callbacks and stops while paused or outside the reading pane', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#about');
  await page.locator('.dragon-radar').scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'running');
  await page.waitForTimeout(100);
  const running = await sample(page, 500);
  // Compare to this browser's own display callbacks, not an absolute fps target
  // that would confuse a busy CI runner with a deliberate application throttle.
  expect(running.display).toBeGreaterThan(0);
  expect(running.draws).toBeGreaterThanOrEqual(running.display * .8);
  await page.locator('#workspace [data-motion-toggle]').click();
  expect((await sample(page)).draws).toBe(0);
  await page.locator('#workspace [data-motion-toggle]').click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('.terminal').evaluate(element => element.scrollTo(0, element.scrollHeight));
  await page.waitForTimeout(150);
  const offscreen = await page.locator('#profile-plot').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect(), pane = canvas.closest('.terminal').getBoundingClientRect();
    return rect.bottom <= Math.max(0, pane.top) || rect.top >= Math.min(innerHeight, pane.bottom);
  });
  expect(offscreen, 'the radar must actually be outside its scroll container for this check').toBe(true);
  expect((await sample(page)).draws).toBe(0);
  await page.locator('.dragon-radar').scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const resumed = await sample(page);
  expect(resumed.draws).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await testInfo.attach('radar-frame-lifecycle', { body: JSON.stringify({ running, resumed }), contentType: 'application/json' });
});

for (const viewport of [{ width:1280, height:800 }, { width:320, height:568 }]) {
  test(`radar ${viewport.width}px: ordinary project links unlock a bounded summon and return`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/#about');
    await page.locator('.dragon-radar').scrollIntoViewIfNeeded();
    for (let index = 0; index < 7; index++) {
      const signal = page.locator('[data-radar-route]').nth(index);
      await signal.scrollIntoViewIfNeeded();
      const route = await signal.getAttribute('data-radar-route');
      // A real click also proves the control is not covered by another ball.
      await signal.click();
      await expect(page.locator(`[data-panel="${route}"]`)).toBeVisible();
      await page.goBack();
      await expect(page.locator('[data-panel="about"]')).toBeVisible();
    }
    const summon = page.locator('[data-radar-summon]');
    await expect(summon).toBeVisible();
    await summon.click();
    await expect(page.locator('.dragon-radar')).toHaveAttribute('data-summoned', 'true');
    await page.waitForTimeout(2400);
    expect((await sample(page)).draws, 'a completed summon no longer redraws continuously').toBe(0);
    await testInfo.attach('summon', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('.dragon-radar')).toHaveAttribute('data-summoned', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-view', 'workspace');
    expect((await sample(page)).draws).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('reduced-motion radar remains a useful static project navigator', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#about');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  await page.locator('.dragon-radar').scrollIntoViewIfNeeded();
  expect((await sample(page)).draws).toBe(0);
  const signal = page.locator('[data-radar-route]').first();
  const route = await signal.getAttribute('data-radar-route');
  await signal.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-panel="${route}"]`)).toBeVisible();
});
