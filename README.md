# Elliott Barnes — studio alternative

A complete, local-review alternative to [elliottbarnes.ca](https://elliottbarnes.ca/), built from `origin/main` at `49439c92b9c3298df3c728a12be56adefa04dc89`. This branch is a draft design proposal. It has not been deployed.

The studio pairs rich violet and warm paper with a gently draggable composition of real project previews and source fragments. Identity, introduction, project navigation and contact links remain stationary. Architecture Lab, Glassbox and Pixel Language lead the page; all seven current projects have ordinary demo and source links, including with JavaScript disabled. Copy and project imagery come from the current repository; `data/projects.mjs` remains the shared project catalog.

## Local preview

Use Node.js 24 from this Git checkout:

```sh
node build.mjs
HOST=127.0.0.1 PORT=4186 node server.mjs --dir dist
```

Open **http://127.0.0.1:4186/**. The server listens only on this computer and serves the explicit public allowlist. A Git branch is not a hosted preview.

## Interaction

- Drag the orbital composition, or focus it and use the arrow keys. Space pauses/resumes; R resets. The visible buttons offer the same pause and reset actions.
- On touch screens, horizontal drags move the composition; vertical gestures scroll the page. Pinch zoom remains native.
- Reduced motion starts still, with optional explicit resume. Hidden tabs, unfocused windows and offscreen compositions stop rendering. There is no sound or network-dependent interaction.
- The optional **Playground** opens the previous terminal experience at `/playground.html`. Its visible Arcade button opens the existing Capsule Arcade. A studio link returns to the new homepage. Existing games, source experiments and their controls are preserved.

## Source and build

- `index.html`: studio identity, static content, orbital fragments and generated project regions.
- `assets/studio.css`: responsive studio and not-found layouts.
- `assets/studio-orbit.js`: optional, dependency-free motion and input handling.
- `scripts/generate-studio.mjs`: renders the three featured projects and remaining catalog entries into ordinary HTML.
- `playground.html`, `styles.css`, `script.js`, existing `assets/`: retained terminal and arcade.
- `scripts/generate-projects.mjs`: maintains the Playground catalog regions.
- `scripts/public-files.mjs`: exact 57-file publication boundary. `build.mjs` generates immutable asset URLs and a private manifest.

After catalog changes, run both generators to refresh checked-in HTML. The build also renders both from the same catalog, preventing stale project copy.

```sh
node scripts/generate-studio.mjs
node scripts/generate-projects.mjs
```

The site requires no production package dependencies, external fonts, services, credentials or analytics. Development-only browser tooling remains locked in `package-lock.json`.

## Verification

```sh
node --test
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s side-projects/live-demo-lab/tests -p 'test_live_backend.py'
node build.mjs
node scripts/verify-site.mjs dist --source .
node scripts/check-performance.mjs dist
npm ci --ignore-scripts --no-fund --no-audit
npm run browser:install
npm run test:browser
```

Chromium and WebKit checks cover the studio and retained Playground. Studio checks include 1440px, 390px, 320px and short landscape layouts, keyboard and touch input, reduced motion, no JavaScript, project links, accessibility and candidate security headers. Performance budgets measure artifact bytes; they are not Core Web Vitals or field measurements. Reports, traces and review screenshots stay outside `dist/` and are not published.

## Review boundary

The unchanged workflow accepts pushes only on `main`, plus pull requests and manual dispatch. Its production job separately requires `main` and a push/manual event. This feature branch and its draft PR can run checks but cannot run that production job. Do not merge or dispatch deployment as part of this review.

No AWS, hosting, DNS, workflow or IAM configuration is changed. The new stable `/playground.html` route would need a separate publication-permission review before a future production release, because the existing deployment-policy snapshot explicitly lists permitted root files. Existing [deployment documentation](DEPLOYMENT.md) describes the current production setup, not authorization to release this alternative.

The unmodified Dragon Ball favicon is by [Musett](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html), licensed [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Existing artwork provenance remains in [ASSET_SOURCES.md](ASSET_SOURCES.md).
