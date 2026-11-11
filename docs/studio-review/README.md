# Studio alternative — review notes

Prepared 11 November 2026 from freshly fetched `origin/main` at `49439c92b9c3298df3c728a12be56adefa04dc89`. This is a draft alternative for local review, not a production release.

## Design

The reference was [Ian Silber's site](https://iansilber.com/), with its minimal, expressive presentation. This alternative uses its confidence in type, colour and space as inspiration, with an original composition of project screenshots and actual source excerpts. The biography is stationary. There is no circular biography or copied game.

The homepage introduces Elliott Barnes as **Senior Software Developer, Nasdaq Verafin**, using the current repository's biography and social destinations. Architecture Lab, Glassbox and Pixel Language lead an image-led project gallery. Automata Lab, ellmiott, batchline and evaldeck remain directly accessible. All descriptions, screenshots and project URLs come from `data/projects.mjs`; no career claims or contact details were added.

The orbit has damped dragging, keyboard movement, pause and reset. It is optional: project previews, demo/source links, contact links and Playground navigation are ordinary HTML. Reduced motion starts paused; hidden/offscreen motion suspends; touch scrolling and pinch zoom remain available. The homepage produces no audio.

The Playground preserves the previous terminal, source experiments and Capsule Arcade as a separate optional page. Its masthead adds a visible Arcade control and return-to-studio link. No game engines were changed.

## Rendered previews

- [Desktop entry](desktop.jpg)
- [Desktop full page](desktop-full.jpg)
- [Mobile entry, 390px](mobile.jpg)
- [Mobile full page, 390px](mobile-full.jpg)
- [Narrow mobile, 320px](mobile-320.jpg)

Screenshots use paused/reset motion for a stable comparison. These notes and images are excluded from the exact public build allowlist.

## Run locally

From this branch's checkout, using Node.js 24:

```sh
node build.mjs
HOST=127.0.0.1 PORT=4186 node server.mjs --dir dist
```

Open `http://127.0.0.1:4186/`. The Git branch is not a hosted preview. The source README includes the full validation commands.

The preview is bound to loopback only.

## Verification

| Check | Actual result |
| --- | --- |
| Node suite | 483 passed, 0 failed |
| Python live-demo backend | 43 passed |
| Full browser suite | 124 passed, 6 explicit platform-specific skips; Chrome + WebKit |
| Final CSS studio recheck | 25 passed, 1 WebKit protocol-touch skip |
| Build and site verification | 57 public files; exact content, metadata, assets and project links verified |
| Performance budgets | All existing budgets passed without increases |
| Syntax and whitespace | Existing workflow checks, new script checks and `git diff --check` passed |
| Manual browser review | Desktop, 390px and 320px; paused/reset orbit, project imagery, Playground/Arcade entry and return |

The browser suite covers keyboard navigation, visible focus, reduced motion, touch drag/release and scrolling, no JavaScript, image decode, 44px project-link targets, overflow, the 404 route and axe accessibility checks. Skips are protocol-specific WebKit cases: continuous touch injection and Chromium-only performance counters; they run in Chrome. The existing game and terminal checks were preserved.

Local tests used installed Chrome because the pinned bundled headless Chromium stalled on this Mac. The same studio keyboard case passed immediately in installed Chrome. WebKit also passed; on macOS its link-navigation check uses native Option+Tab. The checked-in CI browser configuration is unchanged and uses the pinned browsers on Linux. This is a local runtime limitation, not a claim that the bundled Mac binary passed.

Final artifact measurements:

| Resource | Raw bytes | Local gzip estimate |
| --- | ---: | ---: |
| Homepage HTML | 16,496 | — |
| Homepage JavaScript, one request | 7,766 | 2,512 |
| Homepage stylesheet, one request | 22,852 | 4,946 |
| Entire public artifact, including optional Playground | 1,914,405 | — |

The complete artifact remains below its existing 2,000,000-byte budget. Fonts and images are excluded from the initial code totals above. Latest unthrottled loopback Chrome observation: DOMContentLoaded 40.3 ms, load 41.2 ms, LCP 72 ms and observed CLS 0.01776. WebKit reported DOMContentLoaded 36 ms, load 38 ms and LCP 56 ms; its layout-shift observer is unavailable, so CLS is unknown. These are local diagnostics, not field Core Web Vitals or physical-phone usability evidence.

To reproduce the local browser choice after the standard install/build commands:

```sh
PORTFOLIO_CHROME_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=0 node node_modules/playwright/cli.js test
```

The local review log directory sits beside the checkout at `../portfolio-studio-review-2026-11-11/`; it is not committed or published. It retains the initial diagnostics as well as the passing final runs.

## Production boundary

The only workflow is unchanged: branch pushes do not trigger it; pull requests trigger read-only checks. The production job additionally requires `refs/heads/main` and a `push` or `workflow_dispatch` event. This branch and draft PR cannot run that job. No merge, auto-merge, workflow dispatch, AWS, hosting or DNS action is part of this review.

A future release would require separate review of the new `/playground.html` root route against the existing publication-policy snapshot. No production permission was expanded here.
