# Browser checks

The site still has no runtime dependencies. Playwright and axe are pinned development-only tools, excluded from the publication allowlist. Node 24 and npm are used for these checks.

```sh
npm ci --ignore-scripts --no-fund --no-audit
npm run browser:install
node --test
npm run build
npm run verify
npm run check:performance
npm run test:browser
```

On Linux, `npm run browser:install -- --with-deps` also installs Playwright's required system libraries. The workflow uses this command on its disposable runner. Browser binaries normally stay under `node_modules`; `PLAYWRIGHT_BROWSERS_PATH` can select another local cache when needed. Updating Playwright requires reinstalling its matching browsers.

The browser suite starts the existing allowlisted preview server for `dist/` on loopback. It does not rebuild or modify the artifact. It runs Chromium and WebKit with isolated browser contexts and blocks external requests. A historical local artifact can be compared by setting `PORTFOLIO_TEST_URL` to another loopback HTTP preview; nonlocal URLs are refused. `PORTFOLIO_CHROME_CHANNEL=chrome` optionally uses an already-installed Chrome for additional diagnostics; CI uses the pinned bundled Chromium.

## Coverage

- Desktop, 390px and 320px portrait, and short landscape layouts; ordinary demo/source links, project navigation, reloads, and browser history.
- Keyboard command search, dialog Escape, restored focus, and cancellation of a theme preview.
- Emulated mobile touch contexts and tap input for navigation, themes, and arcade controls; these checks do not substitute for a physical device.
- Reduced motion, denied local/session storage, useful no-JavaScript content, and project/connection links after the core script fails.
- Delayed core-script startup leaves hidden project previews unloaded; navigation loads the selected preview. No-JavaScript visitors still receive preview images.
- Optional game network failure/retry and dismissal while loading.
- Source effects remain absent from initial requests; failed modules can retry, navigation cancels late opens, and the discovery rotation renders all families with reduced motion.
- Rendered axe checks of the entrance, project, command and theme dialogs, plus representative dark/light themes.
- Candidate enforced security headers from the exact built HTML, exercised with theme changes, ECDSA tampering, the complete source-effect discovery rotation, and every optional game's entry/exit path.
- Local navigation/resource timings and layout-shift observations saved as diagnostics, with explicit support flags and null values when a browser lacks the relevant observer.
- A bounded Chromium CDP diagnostic compares task/script execution and heap samples during normal animation and after pausing. WebKit intentionally skips this test because it does not expose Chromium CDP counters. Noisy CPU, heap, and timing samples are recorded without numeric pass/fail budgets or claims of memory-leak detection.

Timing observations are unthrottled loopback measurements, not real-user Web Vitals or a claim about slower devices. The artifact budget separately caps initial code, HTML, CSS, and total public bytes.

Screenshots, axe findings, and diagnostic JSON attach to test results. Failures retain traces and screenshots. CI keeps these artifacts for seven days and blocks deployment if the browser suite fails; the deployment job still receives the same artifact that passed the checks. No screenshots are published to the website.

The suite deliberately has no automatic retries that could hide flaky behavior. It is a smoke suite, not proof of WCAG conformance, screen-reader usability, physical touch behavior, gameplay quality, or field performance. Manual testing with assistive technology and representative devices remains valuable. Scheduled or production monitoring is separate from these PR checks.

Tool guidance: [Playwright configuration](https://playwright.dev/docs/test-configuration), [browser installation](https://playwright.dev/docs/browsers), and [automated accessibility testing and its limits](https://playwright.dev/docs/accessibility-testing).
