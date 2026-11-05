import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('bright arcade artwork stays optional and each game has readable accessible controls', async ({ page }, testInfo) => {
  const artwork = [];
  page.on('request', request => { if (/arcade-(?:lookout|icons)[./]/.test(request.url())) artwork.push(request.url()); });
  await page.goto('/');
  expect(artwork).toEqual([]);
  await page.locator('.scene-body').focus(); await page.keyboard.press('/');
  await page.locator('#command-input').fill('arcade'); await page.locator('#command-input').press('Enter');
  await expect(page.locator('#arcade-picker .game-choice')).toHaveCount(5);
  await expect.poll(() => artwork.some(url => /arcade-lookout/.test(url))).toBe(true);
  await expect.poll(() => artwork.some(url => /arcade-icons/.test(url))).toBe(true);
  for (const [game, dialog] of [['piccolo', '#piccolo-dialog'], ['platformer', '#platformer-dialog'], ['breaker', '#training-dialog'], ['ki', '#arcade-dialog'], ['radar', '#arcade-dialog']]) {
    await page.locator(`#game-pick-${game}`).click();
    await expect(page.locator(dialog)).toBeVisible();
    const report = await new AxeBuilder({ page }).include(dialog).analyze();
    await testInfo.attach(`${game}-accessibility`, { body: JSON.stringify(report.violations), contentType: 'application/json' });
    expect(report.violations, `${game} control accessibility`).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#arcade-picker')).toBeVisible();
  }
});
