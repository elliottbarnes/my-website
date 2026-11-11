import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROJECTS } from '../data/projects.mjs';

const test = base.extend({
  page: async ({ page, context, baseURL }, use) => {
    const errors = [], failures = [], remote = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    page.on('requestfailed', request => failures.push(request.url()));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      remote.push(route.request().url());
      return route.abort();
    });
    await use(page);
    expect(remote, 'replica must not contact an external score service or another site').toEqual([]);
    expect(failures, 'all requested local resources load').toEqual([]);
    expect(errors, 'no browser exceptions or console errors').toEqual([]);
  },
});

async function loaded(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/enhanced/);
  await expect(page.locator('#ring-control')).toHaveAttribute('data-mode', 'home');
  await expect(page.locator('#information')).not.toHaveAttribute('open', '');
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow').toBe(true);
}

async function accessible(page, testInfo, name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await testInfo.attach(`replica-accessibility-${name}`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
  expect(result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}

async function openInformation(page) {
  await page.locator('#information > summary').click();
  await expect(page.locator('#information')).toHaveAttribute('open', '');
  await expect(page.locator('#close-information')).toBeFocused();
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function finishRound(page, browserName) {
  // Run every animation frame: fastForward would skip the physics clock's
  // bounded integration steps and would not represent 15 seconds of play.
  if (browserName === 'chromium') await page.clock.runFor(15_250);
  await expect(page.locator('#results')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#timer')).toHaveText(':00');
  await expect(page.locator('#play-again')).toBeFocused();
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: '320px phone', width: 320, height: 568 },
]) {
  test(`replica ${viewport.name}: readable controls and project panel fit`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await loaded(page);
    await noOverflow(page);
    for (const control of await page.locator('#information > summary, .scene-tools button').all()) {
      await expect(control).toBeInViewport();
      expect(await control.evaluate(element => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit === element || element.contains(hit);
      }), 'each visible control can be hit without another control covering it').toBe(true);
    }
    await page.locator('#ring-control').focus();
    expect(await page.locator('#ring-control').evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
    await testInfo.attach('home', { body: await page.screenshot(), contentType: 'image/png' });
    await openInformation(page);
    await expect(page.getByRole('heading', { name: 'Elliott Barnes', exact: true })).toBeVisible();
    await expect(page.locator('[data-demo="architecture-lab"]')).toBeVisible();
    await page.locator('[data-demo="evaldeck"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-demo="evaldeck"]')).toBeInViewport();
    await noOverflow(page);
    await testInfo.attach('projects', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#information > summary')).toBeFocused();
  });
}

test('replica projects preserve all seven real descriptions, images, demo and source destinations', async ({ page }) => {
  await loaded(page);
  await openInformation(page);
  await expect(page.locator('.replica-project')).toHaveCount(PROJECTS.length);
  for (const project of PROJECTS) {
    const article = page.locator(`#project-${project.id}`);
    await expect(article.getByRole('heading')).toHaveText(project.displayName);
    await expect(article.locator('p')).toHaveText(project.description);
    await expect(article.locator('[data-demo]')).toHaveAttribute('href', project.demo.url);
    await expect(article.locator('[data-source]')).toHaveAttribute('href', project.source);
    await article.locator('img').scrollIntoViewIfNeeded();
    await expect.poll(() => article.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(article.locator('[data-demo]')).toBeVisible();
    await expect(article.locator('[data-source]')).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'GitHub ↗', exact: true })).toHaveAttribute('href', 'https://github.com/elliottbarnes');
  await expect(page.getByRole('link', { name: 'LinkedIn ↗', exact: true })).toHaveAttribute('href', 'https://www.linkedin.com/in/elliottbarnes1/');
  await expect(page.getByRole('link', { name: /original Playground/ })).toHaveAttribute('href', '/playground.html');
});

test('replica home, information and round results pass accessibility checks', async ({ page, browserName }, testInfo) => {
  test.setTimeout(60_000);
  await loaded(page);
  await accessible(page, testInfo, 'home');
  await openInformation(page);
  await accessible(page, testInfo, 'information');
  await page.locator('#close-information').click();
  if (browserName === 'chromium') {
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  }
  await page.locator('#play').click();
  await finishRound(page, browserName);
  if (browserName === 'chromium') await page.clock.resume();
  await accessible(page, testInfo, 'results');
  await page.keyboard.press('Escape');
  await expect(page.locator('#results')).not.toBeVisible();
  await expect(page.locator('#ring-control')).toBeFocused();
});

test('replica reduced motion starts paused and remains still while content stays usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loaded(page);
  await expect(page.locator('#pause')).toHaveText('resume');
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const pose = await page.locator('#ring-control').getAttribute('style');
  const drawing = await page.locator('#ring-canvas').evaluate(canvas => canvas.toDataURL());
  await page.clock.runFor(2000);
  expect(await page.locator('#ring-control').getAttribute('style')).toBe(pose);
  expect(await page.locator('#ring-canvas').evaluate(canvas => canvas.toDataURL())).toBe(drawing);
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'false');
  const beforeResume = await center(page.locator('#ring-control'));
  await page.clock.runFor(600);
  expect((await center(page.locator('#ring-control'))).y).toBeGreaterThan(beforeResume.y + 10);
  await page.locator('#pause').click();
  await page.clock.resume();
  await openInformation(page);
  await expect(page.locator('.role')).toHaveText(/Senior Software Developer\s*Nasdaq Verafin/);
});

test('replica keyboard supports movement, Enter, Space, Escape and reset with focus return', async ({ page }) => {
  await loaded(page);
  const ring = page.locator('#ring-control');
  await ring.focus();
  const initial = await center(ring);
  await ring.press('ArrowRight');
  await expect.poll(async () => (await center(ring)).x).toBeGreaterThan(initial.x + 5);
  await ring.press('r');
  await expect.poll(async () => Math.abs((await center(ring)).x - initial.x)).toBeLessThan(1);
  await expect(ring).toBeFocused();
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await ring.press('Enter');
  await page.clock.runFor(32);
  await expect(ring).toHaveAttribute('data-mode', 'game');
  await page.clock.runFor(1100);
  await ring.press('Space');
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  const remaining = await page.locator('#timer').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('#timer')).toHaveText(remaining);
  await ring.press('Space');
  await page.clock.runFor(1100);
  expect(await page.locator('#timer').textContent()).not.toBe(remaining);
  await ring.press('Escape');
  await page.clock.runFor(32);
  await expect(ring).toHaveAttribute('data-mode', 'home');
  await expect(ring).toBeFocused();
  await ring.press('ArrowLeft');
  await page.clock.runFor(32);
  await page.locator('#reset').click();
  await page.clock.runFor(32);
  expect((await center(ring)).x).toBeCloseTo(initial.x, 0);
  await expect(ring).toBeFocused();
  await ring.dispatchEvent('click', { detail: 0 });
  await page.clock.runFor(32);
  await expect(ring).toHaveAttribute('data-mode', 'game');
  await ring.press('Escape');
  await page.clock.runFor(32);
  await expect(ring).toHaveAttribute('data-mode', 'home');
});

test('replica pointer drag follows the hand and release continues with bounded momentum', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await loaded(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const ring = page.locator('#ring-control'), start = await center(ring);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y - 45, { steps: 5 });
  await page.clock.runFor(16);
  const held = await center(ring);
  expect(held.x - start.x).toBeGreaterThan(55);
  expect(start.y - held.y).toBeGreaterThan(30);
  await page.mouse.up();
  await page.clock.runFor(140);
  const released = await center(ring);
  expect(Math.hypot(released.x - held.x, released.y - held.y)).toBeGreaterThan(5);
  await page.clock.runFor(1500);
  const box = await ring.boundingBox(), viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
});

test('replica wall pressure bursts the words and a tap reassembles the biography', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await loaded(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const ring = page.locator('#ring-control'), start = await center(ring);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(page.viewportSize().width - 2, start.y, { steps: 8 });
  await page.clock.runFor(1100);
  await expect(ring).toBeHidden();
  await expect(page.locator('#interaction-hint')).toContainText('tap to put it back together');
  await expect(page.locator('#announcements')).toContainText('ring burst');
  await page.mouse.up();
  await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2);
  await page.clock.runFor(800);
  await expect(ring).toBeVisible();
  await expect(ring).toHaveAttribute('data-mode', 'home');
  const restored = await center(ring);
  expect(Math.abs(restored.x - page.viewportSize().width / 2)).toBeLessThan(2);
  expect(Math.abs(restored.y - page.viewportSize().height / 2)).toBeLessThan(10);
});

test('replica trusted touch cancellation releases the ring for the next finger', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Trusted touch cancellation uses the Chromium input protocol, as in the existing touch suite.');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const remote = [], errors = [];
  try {
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
      remote.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    const ring = page.locator('#ring-control');
    await expect(ring).toHaveAttribute('data-mode', 'home');
    const client = await context.newCDPSession(page);
    const touch = (type, x = 0, y = 0) => client.send('Input.dispatchTouchEvent', {
      type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y, id: 7 }],
    });
    const start = await center(ring);
    await touch('touchStart', start.x, start.y);
    await touch('touchMove', start.x + 35, start.y - 40);
    await expect.poll(async () => (await center(ring)).x).toBeGreaterThan(start.x + 25);
    await touch('touchCancel');
    const cancelled = await center(ring);
    await touch('touchStart', cancelled.x, cancelled.y);
    expect((await center(ring)).x).toBeCloseTo(cancelled.x, 0);
    await touch('touchMove', cancelled.x + 12, cancelled.y);
    await expect.poll(async () => Math.abs((await center(ring)).x - cancelled.x - 12)).toBeLessThan(2);
    await touch('touchEnd');
    await expect(ring).toHaveAttribute('data-mode', 'home');
    // Two actual touch contacts resize the ring; no synthetic state writes.
    const beforePinch = await ring.boundingBox(), middle = await center(ring);
    const contacts = spread => [{ x: middle.x - spread, y: middle.y, id: 7 }, { x: middle.x + spread, y: middle.y, id: 8 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: contacts(24) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: contacts(33) });
    await expect.poll(async () => (await ring.boundingBox()).width).toBeGreaterThan(beforePinch.width * 1.15);
    await touch('touchCancel');
    await page.locator('#reset').tap();
    await expect.poll(async () => Math.abs((await ring.boundingBox()).width - beforePinch.width)).toBeLessThan(2);
    expect(remote).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('replica sound creates no audio context before explicit opt-in', async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioContextsCreated = 0;
    for (const key of ['AudioContext', 'webkitAudioContext']) {
      if (typeof window[key] !== 'function') continue;
      window[key] = new Proxy(window[key], { construct(Target, args) {
        window.__audioContextsCreated += 1;
        return Reflect.construct(Target, args);
      } });
    }
  });
  await loaded(page);
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#play').click();
  await page.locator('#ring-control').press('ArrowUp');
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(0);
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('sound on');
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(1);
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('sound off');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
});

test('replica 15-second expiry, local initials, replay and modal focus work without a backend', async ({ page, browserName }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 320, height: 568 });
  if (browserName === 'chromium') await page.clock.install();
  await loaded(page);
  if (browserName === 'chromium') await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('#ring-control').press('Enter');
  if (browserName === 'chromium') await page.clock.runFor(14_750);
  else await expect(page.locator('#timer')).toHaveText(':01', { timeout: 16_000 });
  await expect(page.locator('#results')).not.toBeVisible();
  if (browserName === 'chromium') await page.clock.runFor(500);
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText(':00');
  await expect(page.locator('#play-again')).toBeFocused();
  if (browserName === 'chromium') await page.clock.resume();
  await page.locator('#result-score').scrollIntoViewIfNeeded();
  await expect(page.locator('#result-score')).toBeInViewport();
  await page.locator('#done').scrollIntoViewIfNeeded();
  await expect(page.locator('#done')).toBeInViewport();
  await noOverflow(page);
  for (const [label, value] of [['First initial', 'e'], ['Second initial', 'b'], ['Third initial', 'x']]) {
    await page.getByRole('textbox', { name: label }).fill(value);
  }
  await page.getByRole('button', { name: 'save', exact: true }).click();
  await expect(page.locator('#record-status')).toHaveText('Saved on this device.');
  await expect(page.locator('#scores-list .initials').first()).toHaveText('EBX');
  await expect(page.locator('#play-again')).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('elliott-ring-scores-v1')));
  expect(saved).toHaveLength(1);
  expect(saved[0].initials).toBe('EBX');
  expect(Number.isInteger(saved[0].score)).toBe(true);
  await page.locator('#play-again').click();
  await expect(page.locator('#results')).not.toBeVisible();
  await expect(page.locator('#ring-control')).toHaveAttribute('data-mode', 'game');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#ring-control')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ring-control')).toHaveAttribute('data-mode', 'home');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elliott-ring-scores-v1')))).toEqual(saved);
});

test('replica essential biography and every project work without JavaScript at 320px', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 }, serviceWorkers: 'block' });
  const remote = [], errors = [];
  try {
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
      remote.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseURL);
    await expect(page.getByRole('heading', { name: 'Elliott Barnes', exact: true })).toBeVisible();
    await expect(page.locator('.role')).toHaveText(/Senior Software Developer\s*Nasdaq Verafin/);
    await expect(page.locator('.stage')).not.toBeVisible();
    await expect(page.locator('.scene-tools')).not.toBeVisible();
    await expect(page.locator('[data-demo]')).toHaveCount(PROJECTS.length);
    for (const project of PROJECTS) {
      const article = page.locator(`#project-${project.id}`);
      await article.locator('[data-demo]').scrollIntoViewIfNeeded();
      await expect(article.locator('[data-demo]')).toBeInViewport();
      await expect(article.locator('[data-source]')).toHaveAttribute('href', project.source);
      await expect(article.locator('p')).toHaveText(project.description);
    }
    await expect(page.locator('.contact-links a')).toHaveCount(2);
    await noOverflow(page);
    expect(remote, 'static fallback must not contact another service').toEqual([]);
    expect(errors, 'static fallback has no console errors').toEqual([]);
  } finally { await context.close(); }
});
