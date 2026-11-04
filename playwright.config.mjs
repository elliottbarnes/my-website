import { defineConfig } from '@playwright/test';

// An explicit loopback URL permits comparing a historical artifact without
// letting this test harness accidentally exercise production.
const baseURL = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4178';
const target = new URL(baseURL);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) {
  throw new Error('Browser checks require a local HTTP preview.');
}

export default defineConfig({
  testDir: './browser-checks',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 6 * 60_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: process.env.PORTFOLIO_CHROME_CHANNEL || undefined } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: process.env.PORTFOLIO_TEST_URL ? undefined : {
    command: 'node server.mjs --dir dist',
    env: { PORT: '4178', HOST: '127.0.0.1' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
