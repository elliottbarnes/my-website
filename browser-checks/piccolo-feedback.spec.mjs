import { test, expect } from '@playwright/test';
import { openPiccolo, piccoloDriver } from './helpers/piccolo-driver.mjs';

test('Piccolo: earned linked-beam feedback survives room clear, pauses, then expires', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPiccolo(page); const driver = piccoloDriver(page);
  const game = await driver.charge();
  expect(game.rooms[0].cleared).toBe(true);
  expect(game.beamReward.targets).toBe(2); expect(game.beamReward.bonus).toBe(80);
  await expect(page.locator('#piccolo-status')).toContainText('2 linked! +80 alignment.');
  await expect(page.locator('#piccolo-score')).toHaveText('SCORE 180');
  await page.keyboard.press('p'); await page.clock.runFor(2000);
  expect((await driver.state()).beamReward.life).toBe(game.beamReward.life);
  await page.keyboard.press('p'); await page.clock.runFor(1700);
  expect((await driver.state()).beamReward).toBe(null);
  expect((await driver.state()).alignment).toBe(80);
});
