import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { generateSecurityHeaders } from '../scripts/plan-security-headers.mjs';

const test = base.extend({
  page: async ({ page, context, baseURL }, use, testInfo) => {
    const errors = [];
    const failedResources = [];
    page.on('requestfailed', request => failedResources.push(request.url()));
    page.on('response', response => { if (response.status() >= 400) failedResources.push(response.url()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === new URL(baseURL).origin ? route.continue() : route.abort();
    });
    await use(page);
    const allowed = testInfo.annotations.filter(a => a.type === 'expected-resource-failure').map(a => a.description);
    const unexpectedResources = failedResources.filter(url => !allowed.some(name => new URL(url).pathname.startsWith(`/assets/${name}.`)));
    expect(unexpectedResources, 'unexpected failed network requests').toEqual([]);
    const unexpected = allowed.length ? errors.filter(message => !/Failed to load resource|net::ERR_FAILED|Load failed/i.test(message)) : errors;
    expect(unexpected, 'uncaught exceptions and browser console errors').toEqual([]);
  },
});

async function loaded(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
}

async function runCommand(page, command) {
  // Global shortcuts intentionally leave native buttons/text fields alone.
  const surface = await page.locator('.terminal').isVisible() ? page.locator('.terminal') : page.locator('.scene-body');
  await surface.focus();
  await page.keyboard.press('/');
  await expect(page.locator('#command-dialog')).toBeVisible();
  await page.locator('#command-input').fill(command);
  await page.locator('#command-input').press('Enter');
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal document overflow').toBe(true);
}

async function accessible(page, testInfo, name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await testInfo.attach(`accessibility-${name}`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
  expect(result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}

async function discoverAll(page) {
  const effects = new Set();
  await page.locator('.scene-body').focus();
  for (let step = 0; step < 13; step++) {
    await page.keyboard.press('n');
    await expect.poll(() => page.evaluate(() => window.PortfolioAnimation.state.loadingEffect)).toBeNull();
    await expect.poll(() => page.evaluate(() => window.PortfolioAnimation.state.effect)).not.toBeNull();
    effects.add(await page.evaluate(() => window.PortfolioAnimation.state.effect));
  }
  expect(effects.size).toBeGreaterThanOrEqual(12);
  for (const kind of ['ecdsa', 'fourier', 'pathfinding']) expect(effects.has(kind), `${kind} discovery`).toBe(true);
}

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'narrow-phone', width: 320, height: 568 },
  { name: 'landscape', width: 844, height: 375 },
]) {
  test(`${viewport.name}: navigation and controls fit`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await loaded(page);
    await noOverflow(page);
    await expect(page.locator('[data-enter]')).toBeInViewport();
    const entranceScreenshot = testInfo.outputPath('entrance.png');
    await page.screenshot({ path: entranceScreenshot });
    await testInfo.attach(`${viewport.name}-entrance`, { path: entranceScreenshot, contentType: 'image/png' });
    await page.locator('[data-enter]').click();
    await expect(page).toHaveURL(/#architecture-lab$/);
    await expect(page.locator('#architecture-lab')).toBeVisible();
    await noOverflow(page);
    await expect(page.locator('#architecture-lab [data-demo]')).toBeInViewport();
    const projectScreenshot = testInfo.outputPath('project.png');
    await page.screenshot({ path: projectScreenshot });
    await testInfo.attach(`${viewport.name}-project`, { path: projectScreenshot, contentType: 'image/png' });
    await page.locator('.command-access').scrollIntoViewIfNeeded();
    await expect(page.locator('.command-access')).toBeInViewport();
    await runCommand(page, 'connect');
    await expect(page.locator('#connect a[href*="linkedin"]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#architecture-lab')).toBeVisible();
    await page.reload();
    await expect(page.locator('#architecture-lab')).toBeVisible();
  });
}

test('keyboard commands, Escape, and theme cancellation restore focus', async ({ page }) => {
  await loaded(page, '/#architecture-lab');
  const commandButton = page.locator('.command-access');
  await commandButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(commandButton).toBeFocused();
  const themeButton = page.locator('.workspace-status [data-theme-toggle]');
  const themeBefore = await page.locator('html').getAttribute('data-theme');
  await themeButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#theme-dialog')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', themeBefore);
  await expect(themeButton).toBeFocused();
  // WebKit does not focus a button on pointer click: the actual trigger must
  // still own focus restoration rather than an unrelated previously focused control.
  await commandButton.focus();
  await themeButton.click();
  await expect(page.locator('#theme-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(themeButton).toBeFocused();
  await page.locator('.terminal').focus();
  await page.keyboard.press('/');
  await page.locator('#command-input').fill('regex');
  await page.locator('#command-input').press('ArrowDown');
  await page.locator('#command-input').press('Enter');
  await expect(page.locator('#automata-lab')).toBeVisible();
});

test('reduced motion and unavailable storage keep navigation and preferences usable', async ({ page }) => {
  await page.addInitScript(() => {
    for (const storage of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, storage, { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
    }
  });
  await loaded(page);
  await page.locator('[data-enter]').click();
  await expect(page.locator('#architecture-lab')).toBeVisible();
  await runCommand(page, 'theme paperwhite');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'whitegold');
  await page.reload();
  await expect(page.locator('#architecture-lab')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
});

test('all project destinations remain available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(baseURL);
    await expect(page.locator('[data-demo]')).toHaveCount(7);
    for (const link of await page.locator('[data-demo]').all()) await expect(link).toBeVisible();
    const preview = page.locator('#architecture-lab img');
    await preview.scrollIntoViewIfNeeded();
    await expect.poll(() => preview.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#connect a[href*="linkedin"]')).toBeVisible();
    await noOverflow(page);
  } finally { await context.close(); }
});

test('slow core startup does not fetch hidden project previews', async ({ page }) => {
  const previewRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/assets/projects/')) previewRequests.push(request.url());
  });
  // Simulate slow bootstrap so native lazy-image discovery runs before enhancement.
  // This fixed delay is injected network latency, not a wait for application readiness.
  await page.route(/\/assets\/script\.[a-f0-9]+\.js$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue();
  });
  await loaded(page);
  expect(previewRequests, 'hidden previews downloaded before navigation').toEqual([]);
  await page.locator('[data-enter]').click();
  const preview = page.locator('#architecture-lab img');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(previewRequests.length).toBeGreaterThan(0);
});

test('failed core script preserves project and connection links', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'expected-resource-failure', description: 'script' });
  await page.route(/\/assets\/script\.[a-f0-9]+\.js$/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-demo]')).toHaveCount(7);
  for (const link of await page.locator('[data-demo]').all()) await expect(link).toBeVisible();
  await expect(page.locator('#connect a[href*="linkedin"]')).toBeVisible();
  await noOverflow(page);
});

test('failed lazy game loads can retry without trapping focus', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'expected-resource-failure', description: 'hidden-games' });
  await loaded(page, '/#about');
  let failed = false;
  await page.route(/\/assets\/hidden-games\.[a-f0-9]+\.js$/, async route => {
    if (!failed) { failed = true; await route.abort(); } else await route.continue();
  });
  const trigger = page.locator('[data-game-trigger]');
  await trigger.click();
  await expect(page.locator('#game-loading-dialog')).toBeVisible();
  await expect(page.locator('[data-game-retry]')).toBeFocused();
  await page.locator('[data-game-retry]').click();
  await expect(page.locator('#arcade-picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('closing a pending game load cannot reopen its dialog', async ({ page }) => {
  await loaded(page, '/#about');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(/\/assets\/hidden-games\.[a-f0-9]+\.js$/, async route => { await gate; await route.continue(); });
  await page.locator('[data-game-trigger]').click();
  await expect(page.locator('#game-loading-dialog')).toBeVisible();
  await page.locator('[data-game-dismiss]').click();
  release();
  await expect.poll(() => page.evaluate(() => Boolean(window.PortfolioArcade && !window.PortfolioArcade.lazy))).toBe(true);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-game-trigger]')).toBeFocused();
});

test('source effects load only on request and a failed module can retry', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'expected-resource-failure', description: 'ecdsa-math' });
  const effectRequests = [];
  page.on('request', request => { if (/\/(?:ecdsa-math|ecdsa-effect|entrance-effects|source-signal-effects|source-structure-effects)\./.test(request.url())) effectRequests.push(request.url()); });
  await loaded(page);
  expect(effectRequests).toEqual([]);
  let failed = false;
  await page.route(/\/assets\/ecdsa-math\.[a-f0-9]+\.js$/, async route => {
    if (!failed) { failed = true; await route.abort(); } else await route.continue();
  });
  await runCommand(page, 'ecdsa');
  await expect(page.locator('[data-source-load-retry]')).toBeVisible();
  await page.locator('[data-source-load-retry]').click();
  await expect(page.locator('[data-ecdsa-controls]')).toBeVisible();
  await expect(page.locator('[data-source-load]')).not.toBeVisible();
  expect(effectRequests.length).toBeGreaterThan(0);
  await page.locator('[data-ecdsa-tamper]').click();
  await expect.poll(() => page.evaluate(() => window.PortfolioAnimation.state.ecdsaTampered)).toBe(true);
});

test('leaving a pending source effect prevents a late opening', async ({ page }) => {
  await loaded(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(/\/assets\/ecdsa-math\.[a-f0-9]+\.js$/, async route => { await gate; await route.continue(); });
  await runCommand(page, 'ecdsa');
  await expect(page.locator('[data-source-load]')).toBeVisible();
  await page.locator('[data-enter]').click();
  await expect(page.locator('#architecture-lab')).toBeVisible();
  release();
  await expect.poll(() => page.evaluate(() => Boolean(window.PortfolioECDSAEffect))).toBe(true);
  await expect(page.locator('[data-ecdsa-controls]')).not.toBeVisible();
  expect(await page.evaluate(() => window.PortfolioAnimation.state.effect)).toBeNull();
});

test('all source discovery families render with reduced motion', async ({ page }) => {
  await loaded(page);
  await discoverAll(page);
});

test.describe('touch input', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('project navigation, theme selection and game controls respond to taps', async ({ page }, testInfo) => {
    await loaded(page);
    await page.locator('[data-enter]').tap();
    await expect(page.locator('#architecture-lab')).toBeVisible();
    await page.locator('[data-select="glassbox"]').tap();
    await expect(page.locator('#glassbox')).toBeVisible();
    await page.locator('.workspace-status [data-theme-toggle]').tap();
    await expect(page.locator('[aria-label="Cancel theme selection"]')).toBeFocused();
    await page.locator('[data-theme-option="whitegold"]').tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'whitegold');
    await expect(page.locator('#theme-dialog')).not.toBeVisible();
    await page.locator('[data-game-trigger]').tap();
    await expect(page.locator('#arcade-picker')).toBeVisible();
    await page.locator('#game-pick-breaker').tap();
    await expect(page.locator('#training-dialog')).toBeVisible();
    await page.locator('[data-training-close]').tap();
    await expect(page.locator('#training-dialog')).not.toBeVisible();
    await noOverflow(page);
    await testInfo.attach('touch-project', { body: await page.screenshot(), contentType: 'image/png' });
  });
});

test('entrance, project, and dialogs pass representative accessibility checks', async ({ page }, testInfo) => {
  await loaded(page);
  await accessible(page, testInfo, 'entrance');
  await page.locator('[data-enter]').click();
  await accessible(page, testInfo, 'project');
  await page.locator('.command-access').click();
  await accessible(page, testInfo, 'command');
  await page.keyboard.press('Escape');
  await page.locator('.workspace-status [data-theme-toggle]').click();
  await accessible(page, testInfo, 'theme-picker');
});

test('representative dark and light palettes keep content readable', async ({ page }, testInfo) => {
  await loaded(page, '/#architecture-lab');
  for (const name of ['blackmoney', 'batou', 'harbor', 'whitegold']) {
    await page.evaluate(name => window.PortfolioThemes.apply(name), name);
    await accessible(page, testInfo, name);
  }
});

test('candidate security headers allow themes, source effects, and every game', async ({ page }) => {
  const { headers } = await generateSecurityHeaders('dist');
  await page.addInitScript(() => {
    window.__policyViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.__policyViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
  await page.route('**/*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await loaded(page);
  await page.locator('[data-theme-toggle]').first().click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await runCommand(page, 'ecdsa');
  await expect(page.locator('[data-ecdsa-controls]')).toBeVisible();
  await page.locator('[data-ecdsa-tamper]').click();
  await page.keyboard.press('Escape');
  await discoverAll(page);
  await page.keyboard.press('Escape');
  for (const [command, dialog] of [['arcade', '#arcade-dialog'], ['piccolo', '#piccolo-dialog'], ['platformer', '#platformer-dialog'], ['breaker', '#training-dialog'], ['ki', '#arcade-dialog'], ['radar', '#arcade-dialog'], ['goku', '#goku-dialog']]) {
    await runCommand(page, command);
    await expect(page.locator(dialog)).toBeVisible();
    await page.keyboard.press('Escape');
    // Some games deliberately return to the shelf instead of exiting the arcade.
    if (command === 'ki' || command === 'radar') await expect(page.locator('#arcade-picker')).toBeVisible();
    else await expect(page.locator(dialog)).not.toBeVisible();
    if (await page.locator('#arcade-dialog').isVisible()) await page.locator('#arcade-close').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.__policyViolations)).toEqual([]);
});

test('records a local loading baseline without treating it as field performance', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__layoutShifts = [];
    window.__layoutShiftSupported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
    if (window.__layoutShiftSupported) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__layoutShifts.push({ value: entry.value, sources: entry.sources.map(source => ({ node: source.node?.className || source.node?.nodeName, previousRect: source.previousRect.toJSON(), currentRect: source.currentRect.toJSON() })) });
      }).observe({ type: 'layout-shift', buffered: true });
    }
  });
  await loaded(page);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => ({
    environment: 'loopback, reduced motion, unthrottled; not field Web Vitals',
    navigation: performance.getEntriesByType('navigation').map(e => ({ domContentLoaded: e.domContentLoadedEventEnd, load: e.loadEventEnd, responseStart: e.responseStart })),
    resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, bytes: e.encodedBodySize, duration: e.duration, type: e.initiatorType })),
    layoutShiftEntries: window.__layoutShifts,
    layoutShiftSupported: window.__layoutShiftSupported,
    observedLayoutShift: window.__layoutShiftSupported ? window.__layoutShifts.reduce((sum, entry) => sum + entry.value, 0) : null,
  }));
  const observationPath = testInfo.outputPath('local-loading.json');
  await writeFile(observationPath, JSON.stringify(metrics, null, 2));
  await testInfo.attach('local-loading-observation', { path: observationPath, contentType: 'application/json' });
  if (metrics.layoutShiftSupported) expect(metrics.observedLayoutShift).toBeLessThanOrEqual(0.1);
});

test('records animation CPU and heap before and after pause', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Chrome DevTools performance counters are Chromium-specific.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.__animationMetrics = { longTasks: [], largestContentfulPaint: null };
    for (const type of ['longtask', 'largest-contentful-paint']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (type === 'longtask') window.__animationMetrics.longTasks.push(entry.duration);
          else window.__animationMetrics.largestContentfulPaint = entry.startTime;
        }
      }).observe({ type, buffered: true });
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'running');
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  async function sample() {
    const before = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
    // A fixed sample window measures task time; it is not a readiness wait.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    const after = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
    return {
      elapsedMs: (after.Timestamp - before.Timestamp) * 1000,
      taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
      scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
      heapBeforeBytes: before.JSHeapUsedSize,
      heapAfterBytes: after.JSHeapUsedSize,
    };
  }
  const running = await sample();
  await page.locator('#entrance [data-motion-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  const paused = await sample();
  const result = { environment: 'unthrottled loopback Chromium, one-second samples; not field data or a memory-leak test', running, paused, ...(await page.evaluate(() => window.__animationMetrics)) };
  const observationPath = testInfo.outputPath('animation-diagnostic.json');
  await writeFile(observationPath, JSON.stringify(result, null, 2));
  await testInfo.attach('animation-diagnostic', { path: observationPath, contentType: 'application/json' });
  await session.detach();
});
