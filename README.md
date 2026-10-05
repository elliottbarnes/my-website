# elliott / Software, opened up

A compact, dependency-free portfolio at [elliottbarnes.ca](https://elliottbarnes.ca).

The homepage introduces Elliott and links to three independent systems projects. Each project has a public repository and a full interactive playground hosted on GitHub Pages:

| Project | Playground | Source |
| --- | --- | --- |
| Glassbox — inspectable WebAssembly compiler | [Run the compiler](https://elliottbarnes.github.io/glassbox/) | [Repository](https://github.com/elliottbarnes/glassbox) |
| Pixel Language — typed graphics language | [Write a shader](https://elliottbarnes.github.io/pixel-language/) | [Repository](https://github.com/elliottbarnes/pixel-language) |
| Automata Lab — regex compiler and state machines | [Explore the machines](https://elliottbarnes.github.io/automata-lab/) | [Repository](https://github.com/elliottbarnes/automata-lab) |

## Layout and accessibility

The landing page is designed to fit common portrait phone viewports without scrolling at default text settings. It uses the small viewport height (`svh`) so expanded mobile browser controls do not cover the footer. There is no fixed-height clipping or scroll lock: enlarged text and unusually short windows can flow naturally. All project and contact navigation uses ordinary links and works without JavaScript. The only script updates the copyright year.

The palette follows the system light/dark preference. Keyboard focus remains visible, a skip link leads to the projects, and hover transitions respect reduced-motion settings. Demos open as separate pages in the same tab and have their own layouts; the homepage does not embed them.

## Preview and verification

Use Node.js 24 or newer; no package installation is needed.

```sh
node scripts/version-assets.mjs
node --test
node build.mjs
node scripts/verify-site.mjs dist --source .
node server.mjs --dir dist
```

Open `http://localhost:4173`. The explicit ten-file publication list is in `scripts/public-files.mjs`. Build checks reject extra artifacts, symlinks, broken local links, stale asset hashes, and incorrect project destinations.

Production still uses the existing GitHub Actions deployment to a private S3 origin and CloudFront, with version-based recovery. See [DEPLOYMENT.md](DEPLOYMENT.md).

The former handheld design is recoverable in Git history. Existing experimental work under `side-projects/live-demo-lab` is preserved and excluded from publication. The old project repositories remain independent and unchanged.

## Icon credit

The unmodified Dragon Ball favicon is by [Musett.com](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html), under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Attribution appears in the footer. See [ASSET_SOURCES.md](ASSET_SOURCES.md) for retained artwork provenance.
