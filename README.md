# Elliott / ellitendo Portfolio

A dependency-free, retro-console portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

## Playable portfolio

Tap a cartridge to open an accessible project preview. Each preview has a small browser-only demonstration and a separate GitHub source link. With JavaScript disabled the cartridges link directly to GitHub.

- **Batchline:** step through or run a bounded queue simulation and change traffic and batch size.
- **EvalDeck:** compare hand-authored sample outputs and reveal regression checks.
- **Reconcile Kit:** inspect synthetic records and find reconciliation mismatches using integer cents.
- **Prism Studio:** explore three illustrative images. The sample IDs are navigation labels, not recorded generation seeds, and these are not outputs from the Prism app.

The controller’s up/down buttons select a project; A loads it and B returns. Arrow keys work when focus is in the controller or collection. START changes the theme; the stick toggles texture. Number keys 1–3 navigate to Projects, Toolkit, and Contact. Normal links and touch controls remain available.

The terminal opens with `/` or its visible button. Commands: `projects`, `about`, `contact`, `toolkit`, `theme`, `help`, `clear`, `arcade`, and each project slug. Escape closes a panel. The footer’s fifth cartridge opens Signal Match, a turn-based memory game with an optional device-local best score.

Sound starts off on every visit. Motion follows reduced-motion system settings and can be reduced manually. Theme and texture preferences are stored locally when available; blocked storage does not prevent use. There are no analytics, remote model calls, or new server dependencies.

## Local preview

```bash
node server.mjs
```

Open `http://localhost:4173`.

## Featured projects

- [Batchline](https://github.com/elliottbarnes/batchline): inference-serving lab
- [EvalDeck](https://github.com/elliottbarnes/evaldeck): repeatable AI response evaluations
- [Reconcile Kit](https://github.com/elliottbarnes/reconcile-kit): Java/Gradle transaction reconciliation
- [Prism Studio](https://github.com/elliottbarnes/prism-studio): local image-generation workbench

## Build

```bash
node scripts/version-assets.mjs
node build.mjs
node --test
node scripts/verify-site.mjs dist --source .
```

The build copies an explicit list of public files into `dist/` and refuses unexpected artifacts. Hosting uses HTTPS through CloudFront and a private S3 origin. [Deployment and recovery](DEPLOYMENT.md) explains the verified GitHub Actions workflow and temporary AWS access.

## Favicon

The transparent one-star Dragon Ball PNG is used for browser tabs, Apple touch icons, and the web manifest. It is served locally as `image/png`; no checkerboard is baked into the asset. The original social-card metadata is unchanged, and sharing apps choose their own preview layout and may cache older previews.

Artwork by Musett.com, provided under CC BY-NC-ND 4.0 (non-commercial, attribution required, no derivatives). Source and license links appear in the site footer; see [asset sources](ASSET_SOURCES.md).

## Structure

- `index.html`: page content, metadata, and structured data
- `styles.css`: responsive console-inspired layout and cartridge cards
- `script.js`: current year, color/texture preferences, and section shortcuts
- `assets/interactive/`: project demos, controller/terminal/toolkit interactions, and arcade
- `assets/prism/`: generated illustrative samples and provenance (only JPEG samples are published)
- `build.mjs`: creates the public deployment artifact
- `404.html`: custom not-found page
- `assets/`: favicon and social sharing artwork
- `assets/toolkit/`: local, consistently styled technology icons
- `ASSET_SOURCES.md`: icon provenance and licensing
- `scripts/` and `tests/`: artifact verification, deployment, and behavior checks
- `.github/`: read-only PR checks and main-only production deployment
- `DEPLOYMENT.md`: hosting, deployment, and version-based recovery

The deployable artifact is generated in `dist/`; project notes and infrastructure snapshots are intentionally excluded.
