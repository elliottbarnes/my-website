# elliott / Handheld Portfolio

A dependency-free, retro-console portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

## Playable portfolio

The homepage is an elliott handheld console. Select one of four projects on its screen, then choose **Try demo** to open a browser-only demonstration inside the screen. **Back to projects** returns to the selected project and restores focus. Each project has a separate GitHub source link; with JavaScript disabled, links below the device keep all four sources available.

On smaller screens the housing becomes a compact orange frame around ordinary page content. Demos grow with their content and use normal page scrolling.

- **Batchline:** step through or run a bounded queue simulation and change incoming traffic and the service rate in an 18-slot queue.
- **EvalDeck:** compare hand-authored sample outputs and reveal regression checks.
- **Reconcile Kit:** inspect synthetic records and find reconciliation mismatches using integer cents.
- **Prism Studio:** explore three illustrative images. The sample IDs are navigation labels, not recorded generation seeds, and these are not outputs from the Prism app.

The optional D-pad controls select a project; **A** opens its demo and **B** returns to projects. With focus in the console or project choices, arrow keys select a project and the A key opens it. B or Escape closes an inline demo. Number keys **1**, **2**, and **3** activate **Projects**, **Toolkit**, and **Contact**, respectively. Normal links, project buttons, and touch controls provide the same navigation.

The terminal opens with `/` or the button below the controller. Commands: `projects`, `toolkit`, `contact`, `theme`, `help`, `clear`, `arcade`, and each project slug. Escape closes a panel. The footer’s fifth cartridge opens Signal Match, a turn-based memory game with an optional device-local best score.

The screen’s texture toggle adds scanlines, a phosphor glow, and a single gentle sweep when enabled. It sits beside the screen navigation and works inside project demos. The sweep is disabled with reduced motion. Labelled preferences below the main content control dark mode, sound, and motion. Sound starts off on every visit. Motion follows reduced-motion system settings and can be reduced manually. Theme and texture preferences are stored locally when available; blocked storage does not prevent use. There are no analytics, remote model calls, or new server dependencies.

## Local preview

### Side project: Live Demo Lab

An isolated prototype lives in [side-projects/live-demo-lab](side-projects/live-demo-lab/README.md). It explores custom text/CSV inputs and a future prompt-and-seed image workflow. It is excluded from the public website build; its local preview blocks outbound API calls, and no AWS resources have been deployed for it.

```bash
node side-projects/live-demo-lab/server.mjs
```

Open `http://127.0.0.1:4190` for the lab. Use the command below for the portfolio itself.

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

The transparent one-star Dragon Ball PNG is used for browser tabs, Apple touch icons, and the web manifest. It is served locally as `image/png`; no checkerboard is baked into the asset. Link previews also request the Dragon Ball icon. The legacy SVG icon and sharing-image paths embed the same original PNG for older references. Sharing apps choose their own preview layout and may cache older previews.

Artwork by Musett.com, provided under CC BY-NC-ND 4.0 (non-commercial, attribution required, no derivatives). Source and license links appear inside the site footer’s Icon credits disclosure; see [asset sources](ASSET_SOURCES.md).

## Structure

- `index.html`: page content, metadata, and structured data
- `styles.css`: base layout, typography, and color themes
- `script.js`: current year, color/texture preferences, and section shortcuts
- `assets/interactive/`: responsive handheld screen layout, inline demos, controller/terminal/toolkit interactions, and arcade
- `assets/barnes-handheld.webp`: current homepage housing; generation provenance is in `assets/BARNES_HANDHELD.md`
- `assets/barnes-controller.webp`: archived compact controller artwork
- `assets/prism/`: generated illustrative samples and provenance (only JPEG samples are published)
- `build.mjs`: creates the public deployment artifact
- `404.html`: custom not-found page
- `assets/`: favicon and social sharing artwork
- `assets/toolkit/`: local, consistently styled technology icons
- `ASSET_SOURCES.md`: artwork and icon provenance and licensing
- `scripts/` and `tests/`: artifact verification, deployment, and behavior checks
- `.github/`: read-only PR checks and main-only production deployment
- `DEPLOYMENT.md`: hosting, deployment, and version-based recovery

The deployable artifact is generated in `dist/`; project notes and infrastructure snapshots are intentionally excluded.
