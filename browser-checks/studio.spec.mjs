import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { PROJECTS } from '../data/projects.mjs';
import { generateSecurityHeaders } from '../scripts/plan-security-headers.mjs';

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
    await use(page);
    expect(errors, 'studio exceptions and console errors').toEqual([]);
    expect(failures, 'studio HTTP failures').toEqual([]);
  },
});

const transforms = page => page.locator('[data-orbit-item]').evaluateAll(cards => cards.map(card => card.style.transform));
async function load(page) {
  await page.goto('/');
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-ready', 'true');
}
async function stableFrame(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 320, height: 568 },
  { name: 'landscape', width: 844, height: 375 },
]) {
  test(`studio ${viewport.name}: content, targets, contrast and layout`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await load(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Elliott');
    await expect(page.locator('[data-demo]')).toHaveCount(PROJECTS.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow').toBe(true);
    for (const project of PROJECTS) {
      const card = page.locator(`#${project.id}`);
      await expect(card).toContainText(project.description);
      await expect(card.locator('.project-image-wrap')).toHaveAttribute('href', project.demo.url);
      const preview = card.locator('img');
      await preview.scrollIntoViewIfNeeded();
      await expect.poll(() => preview.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      for (const name of ['demo', 'source']) {
        const link = card.locator(`[data-${name}]`);
        await expect(link).toHaveAttribute('href', name === 'demo' ? project.demo.url : project.source);
        await link.scrollIntoViewIfNeeded();
        const hit = await link.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return { clear: top === element || element.contains(top), height: rect.height };
        });
        expect(hit.clear, `${project.id} ${name} link is unobstructed`).toBe(true);
        expect(hit.height, `${project.id} ${name} touch target`).toBeGreaterThanOrEqual(44);
      }
    }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    await testInfo.attach('studio-accessibility', { body: JSON.stringify(audit.violations, null, 2), contentType: 'application/json' });
    expect(audit.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`studio-${viewport.name}.png`), fullPage: true });
  });
}

test('studio works without JavaScript, including every project and contact destination', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.locator('[data-demo]')).toHaveCount(PROJECTS.length);
    for (const project of PROJECTS) {
      await expect(page.locator(`[data-demo="${project.id}"]`)).toBeVisible();
      await expect(page.locator(`[data-source="${project.id}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-orbit-controls]')).toBeHidden();
    await expect(page.locator('a[href="https://github.com/elliottbarnes"]').first()).toBeVisible();
    await expect(page.locator('a[href="https://www.linkedin.com/in/elliottbarnes1/"]').first()).toBeVisible();
    await expect(page.locator('a[href="/playground.html"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test('studio 404 stays readable at 320px and returns to the working homepage', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nothing at');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(report.violations).toEqual([]);
  await page.getByRole('link', { name: 'Back to the studio' }).click();
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-ready', 'true');
});

test('studio keyboard has a visible focus path, static orbit controls and escape through Tab', async ({ page, browserName }) => {
  await load(page);
  // macOS WebKit uses Option+Tab to include links when native full keyboard access is off.
  await page.keyboard.press(process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeInViewport();
  await page.keyboard.press('Enter');
  const stage = page.locator('[data-orbit-stage]');
  await stage.focus();
  const focus = await stage.evaluate(element => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle }));
  expect(focus.width).not.toBe('0px');
  expect(focus.style).not.toBe('none');
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-paused', 'true');
  const initial = await transforms(page);
  await stage.press('ArrowRight');
  expect(await transforms(page)).not.toEqual(initial);
  await stage.press('r');
  expect(await transforms(page)).toEqual(initial);
  await stage.press('Space');
  await expect(page.locator('[data-orbit-pause]')).toHaveAttribute('aria-pressed', 'false');
  await stage.press('Space');
  await expect(page.locator('[data-orbit-pause]')).toHaveAttribute('aria-pressed', 'true');
  const paused = await transforms(page);
  await stableFrame(page);
  expect(await transforms(page)).toEqual(paused);
  await stage.press('Tab');
  await expect(stage).not.toBeFocused();
});

test('studio drag leaves introduction and project navigation stationary and Reset restores composition', async ({ page }) => {
  await load(page);
  const title = page.getByRole('heading', { level: 1 });
  const beforeTitle = await title.boundingBox();
  const initial = await transforms(page);
  const stage = page.locator('[data-orbit-stage]');
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2 + 15, { steps: 6 });
  await page.mouse.up();
  expect(await transforms(page)).not.toEqual(initial);
  expect(await title.boundingBox()).toEqual(beforeTitle);
  await expect(page.locator('[data-orbit]')).not.toHaveAttribute('data-orbit-dragging');
  await page.locator('[data-orbit-reset]').click();
  expect(await transforms(page)).toEqual(initial);
});

test('studio motion can pause and reduced-motion changes stop an active composition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await load(page);
  const initial = await transforms(page);
  await expect.poll(() => transforms(page)).not.toEqual(initial);
  await page.locator('[data-orbit-pause]').click();
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-paused', 'true');
  const paused = await transforms(page);
  await stableFrame(page);
  expect(await transforms(page)).toEqual(paused);
  await page.locator('[data-orbit-pause]').click();
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-paused', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-orbit]')).toHaveAttribute('data-orbit-paused', 'true');
});

test('studio maximum dragging at 320px never creates horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await load(page);
  const stage = page.locator('[data-orbit-stage]');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  for (const target of [900, -600]) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-orbit]')).not.toHaveAttribute('data-orbit-dragging');
  }
  await page.locator('[data-orbit-reset]').click();
  await expect(page.locator('[data-orbit-status]')).toHaveText('Composition reset.');
});

test('studio touch drag releases and vertical gestures retain page scrolling', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Real multi-event touch input uses Chromium DevTools; keyboard and pointer parity run in both browsers.');
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await load(page);
    const stage = page.locator('[data-orbit-stage]');
    await stage.scrollIntoViewIfNeeded();
    const rect = await stage.boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const session = await context.newCDPSession(page);
    const touch = (type, px = x, py = y) => session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: px, y: py, id: 1 }] });
    const initial = await transforms(page);
    await touch('touchStart');
    await touch('touchMove', x + 20, y);
    await touch('touchMove', x + 65, y);
    await touch('touchEnd');
    expect(await transforms(page)).not.toEqual(initial);
    await expect(page.locator('[data-orbit]')).not.toHaveAttribute('data-orbit-dragging');
    const scroll = await page.evaluate(() => scrollY);
    await touch('touchStart');
    await touch('touchMove', x, y - 30);
    await touch('touchMove', x, y - 110);
    await touch('touchEnd');
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
    await session.detach();
  } finally { await context.close(); }
});

test('studio uses candidate security headers with no blocked resources', async ({ page, baseURL }) => {
  const candidate = await generateSecurityHeaders('dist');
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== new URL(baseURL).origin) return route.abort();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...candidate.headers } });
  });
  await load(page);
  await expect(page.locator('[data-demo]')).toHaveCount(PROJECTS.length);
  await page.locator('[data-orbit-reset]').click();
  await expect(page.locator('[data-orbit-status]')).toHaveText('Composition reset.');
});

test('studio records local loading and layout stability observations', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__studioPerformance = { layoutShiftSupported: PerformanceObserver.supportedEntryTypes.includes('layout-shift'), shifts: [], lcp: null };
    if (window.__studioPerformance.layoutShiftSupported) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__studioPerformance.shifts.push(entry.value);
      }).observe({ type: 'layout-shift', buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__studioPerformance.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
  });
  await load(page);
  await page.evaluate(() => document.fonts.ready);
  // A bounded measurement window, not a readiness delay or field-performance claim.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  const metrics = await page.evaluate(() => ({
    environment: 'Unthrottled loopback browser, one-second observation; not field data or Core Web Vitals.',
    navigation: performance.getEntriesByType('navigation').map(entry => ({ domContentLoadedMs: entry.domContentLoadedEventEnd, loadMs: entry.loadEventEnd })),
    resources: performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname, encodedBytes: entry.encodedBodySize, durationMs: entry.duration, type: entry.initiatorType })),
    ...window.__studioPerformance,
  }));
  const path = testInfo.outputPath('studio-loading.json');
  await writeFile(path, JSON.stringify(metrics, null, 2));
  await testInfo.attach('studio-local-loading', { path, contentType: 'application/json' });
  if (metrics.layoutShiftSupported) expect(metrics.shifts.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(0.1);
});
