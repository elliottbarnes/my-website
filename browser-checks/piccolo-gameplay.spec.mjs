import { test, expect } from '@playwright/test';
import { openPiccolo, piccoloDriver } from './helpers/piccolo-driver.mjs';
import { runCallbacks } from './helpers/clock.mjs';

test('Piccolo: six rooms and the bell are reachable through ordinary keyboard input', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPiccolo(page);
  const driver = piccoloDriver(page), rooms = [];
  const game = await driver.complete(async state => {
    expect(state.rooms[state.room].cleared).toBe(true);
    rooms.push({ room: state.room + 1, hearts: state.hearts, time: state.time });
  });
  expect(game.rooms.every(room => room.cleared)).toBe(true);
  expect(game.attempts).toBe(1);
  await expect(page.locator('#piccolo-start')).toHaveText('play again ↵');
  await expect(page.locator('#piccolo-record')).toContainText('Personal best:');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('portfolio:piccolo:beam-v1')).attempts)).toBe(1);
  await testInfo.attach('piccolo-normal-input-run', { body: JSON.stringify({ rooms, hits: game.hits, beams: game.beamsFired, alignment: game.alignment, seconds: game.time }), contentType: 'application/json' });
  await page.locator('#piccolo-start').click(); await runCallbacks(page, 32);
  const reset = await driver.state();
  expect(reset.room).toBe(0); expect(reset.hearts).toBe(4); expect(reset.phase).toBe('playing');
  expect(reset.player.actionHeld).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#arcade-picker')).toBeVisible();
  await page.locator('#arcade-close').click();
  expect(errors).toEqual([]);
});

test('Piccolo: a real defeat continues at the earned checkpoint with no stale held input', async ({ page }) => {
  test.setTimeout(60_000);
  await openPiccolo(page); const driver = piccoloDriver(page);
  await driver.charge(); await driver.next(1); await driver.walkTo(152, 96);
  let game = await driver.state();
  for (let i = 0; i < 18 && game.phase !== 'lost'; i++) game = await driver.input({}, 2000);
  expect(game.phase).toBe('lost'); expect(game.checkpoint).toBe(1);
  expect(game.rooms[0].cleared).toBe(true);
  await expect(page.locator('#piccolo-start')).toHaveText('continue ↵');
  await page.keyboard.down('ArrowRight');
  await page.locator('#piccolo-start').click(); await runCallbacks(page, 256);
  const continued = await driver.state();
  expect(continued.room).toBe(1); expect(continued.attempts).toBe(2); expect(continued.hearts).toBe(4);
  expect(continued.rooms[0].cleared).toBe(true); expect(continued.player.x).toBe(28);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('z'); await runCallbacks(page, 900);
  await page.keyboard.press('p'); await page.keyboard.up('z');
  await expect(page.locator('#piccolo-pause')).toHaveText('resume');
  expect((await driver.state()).player.charge).toBe(0);
  await page.keyboard.press('p'); await runCallbacks(page, 32);
  expect((await driver.state()).beamsFired).toBe(game.beamsFired);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 375 }]) {
  test(`Piccolo: ${viewport.width}×${viewport.height} controls are reachable and a cancelled charge is safe`, async ({ page, browserName }, testInfo) => {
    await page.setViewportSize(viewport); await openPiccolo(page);
    const driver = piccoloDriver(page);
    for (const button of await page.locator('#piccolo-dialog button').all()) {
      await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(element => {
        const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return element === hit || element.contains(hit);
      })).toBe(true);
    }
    const action = page.locator('[data-piccolo-hold="action"]');
    await action.scrollIntoViewIfNeeded();
    if (browserName !== 'chromium') {
      // WebKit exposes no CDP touch-hold API. Exercise the native hold-free
      // control and its hit targets here; do not call this a physical touch test.
      testInfo.annotations.push({ type: 'input-path', description: 'WebKit keyboard activation of onscreen A; Chromium tests real protocol touch holds.' });
      await action.focus(); await page.keyboard.press('Enter'); await runCallbacks(page, 900);
      await expect(page.locator('#piccolo-objective')).toContainText('2 rings lined up');
      await page.keyboard.press('p'); await page.keyboard.press('p'); await runCallbacks(page, 32);
      expect((await driver.state()).beamsFired).toBe(0); expect((await driver.state()).player.charge).toBe(0);
      await action.focus(); await page.keyboard.press('Enter'); await runCallbacks(page, 900);
      await page.keyboard.press('Enter'); await runCallbacks(page, 32);
      await expect(page.locator('#piccolo-objective')).toHaveText('Eastern gate →');
      expect((await driver.state()).beamsFired).toBe(1);
      return;
    }
    const box = await action.boundingBox();
    const session = await page.context().newCDPSession(page);
    const start = () => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 7, x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await start(); await runCallbacks(page, 900);
    await expect(page.locator('#piccolo-objective')).toContainText('2 rings lined up');
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await runCallbacks(page, 32);
    expect((await driver.state()).beamsFired).toBe(0);
    expect((await driver.state()).player.charge).toBe(0);
    await start(); await runCallbacks(page, 900);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await runCallbacks(page, 32);
    await expect(page.locator('#piccolo-objective')).toHaveText('Eastern gate →');
    expect((await driver.state()).beamsFired).toBe(1);
    await session.detach();
  });
}
