# Elliott / ellitendo Portfolio

A dependency-free, retro-console portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

## Controller

The original N64-inspired controller is functional: A opens projects, B opens contact, and the yellow C buttons open the toolkit. START toggles dark mode, and the analog stick toggles the optional plastic texture. Keyboard shortcuts 1–3 navigate to the same sections.

The color theme follows the system until a visitor makes a choice. That choice is remembered locally when storage is available, with no account or tracking required. Controls remain keyboard-accessible, and reduced-motion preferences are respected.

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
node build.mjs
node --test
node scripts/verify-site.mjs dist --source .
```

The build copies an explicit list of public files into `dist/` and refuses unexpected artifacts. Hosting uses HTTPS through CloudFront and a private S3 origin. [Deployment and recovery](DEPLOYMENT.md) explains the verified GitHub Actions workflow and temporary AWS access.

## Structure

- `index.html`: page content, metadata, and structured data
- `styles.css`: responsive console-inspired layout and cartridge cards
- `script.js`: current year, color/texture preferences, and keyboard shortcuts
- `build.mjs`: creates the public deployment artifact
- `404.html`: custom not-found page
- `assets/`: favicon and social sharing artwork
- `assets/toolkit/`: local, consistently styled technology icons
- `ASSET_SOURCES.md`: icon provenance and licensing
- `scripts/` and `tests/`: artifact verification, deployment, and behavior checks
- `.github/`: read-only PR checks and main-only production deployment
- `DEPLOYMENT.md`: hosting, deployment, and version-based recovery

The deployable artifact is generated in `dist/`; project notes and infrastructure snapshots are intentionally excluded.
