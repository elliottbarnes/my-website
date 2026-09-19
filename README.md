# Elliott / EB.EXE Portfolio

A dependency-free, retro-terminal portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

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
```

The build copies an explicit list of public files into `dist/` and refuses unexpected artifacts. Hosting uses HTTPS through CloudFront and a private S3 origin.

## Structure

- `index.html`: page content, metadata, and structured data
- `styles.css`: responsive visual system and CRT treatment
- `script.js`: current year, CRT preference, and keyboard shortcuts
- `build.mjs`: creates the public deployment artifact
- `404.html`: custom not-found page
- `assets/`: favicon and social sharing artwork
- Hosting, deployment, and rollback notes are kept in the local deployment workspace.

The deployable artifact is generated in `dist/`; project notes and infrastructure snapshots are intentionally excluded.
