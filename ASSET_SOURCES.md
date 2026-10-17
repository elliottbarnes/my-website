# Asset sources

## Celestial training arena

`assets/training-arena.webp` is original scenery generated with the built-in Image Generation tool on 16 October 2026. The dark, open composition leaves room for the game's independently drawn shields and energy ball. It is 1086×1448 and 144,808 bytes, encoded as WebP at quality 80 without cropping or resizing. It loads only when the training chamber opens; it adds one file to the publication allowlist. Existing Dragon Ball artwork and credits are unchanged. [Exact prompt and preparation](assets/TRAINING_ARENA.md).

## Terminal redesign typography

`assets/fonts/IBMPlexMono-Regular.ttf` is the unmodified IBM Plex Mono Regular font by IBM, downloaded on 2026-10-11 from the [official Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/ibmplexmono) ([font source](https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf)). Copyright © 2017 IBM Corp., with Reserved Font Name “Plex”. It is licensed under the SIL Open Font License 1.1; the complete notice is retained and published at [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt). The font is served locally, without a runtime request to Google Fonts.

The browser copy is `assets/fonts/IBMPlexMono-Regular.woff2`, converted from that TTF with fontTools 4.67.0 and Brotli 1.2.0 using `TTFont(..., recalcTimestamp=False)` and `font.flavor = 'woff2'`. The original TTF remains in source. The WOFF2 is 39,176 bytes versus the 135,580-byte TTF; all 930 Unicode mappings were verified unchanged after decoding. No glyphs were subsetted and no external font request is made. Conversion is an optional authoring step, not a build dependency.

The terminal styling is inspired by the user-selected reference, [hancore.dev](https://hancore.dev). The animation and interface implementation is original to this repository. Its creator’s face, personal information, and branding are not used. The EB contour graphic is generated locally. The 28 palette values follow the reference’s public colorscheme catalog, with provenance described in `assets/themes.js`. Their display names are personalized for Elliott’s site; stable internal source IDs preserve saved preferences.

## Code animation references

The code used to personalize the terminal animation comes from Elliott's public, MIT-licensed projects. Exact snippets, commit-pinned source URLs, line ranges, and complete license notices are recorded in `.design/code-references.json`. They were checked against public GitHub sources on 2026-10-11: Glassbox (`c7ae7bd3eb374580b0c28e0b554108b5504a1c00`), Pixel Language (`bf7abf01bd02a9a3f40216a81f6a6b8809009ea2`), Architecture Lab (`db570f2adea137f8a362ee171ca4230f5f7b76fc`), and Automata Lab (`5f6754580cfb0ffcf393d9e3d944ce1753cc1554`). Display-only excerpts do not execute or connect to external services. Any excerpts included in the published animation script retain their MIT license notice in that script.

## Portfolio artwork

The archived homepage housing is `assets/barnes-handheld.webp`, generated with the built-in Image Gen tool from the user-selected **Option 1: Barnes handheld console** concept. It preserves the orange molded shell, navy D-pad and screen bezel, blue A button, red B button, and embossed “Barnes” badge. The dark screen is blank in the artwork: its text, project choices, demos, and navigation are semantic HTML. WebP encoding preserves the generated transparency. [Handheld provenance](assets/BARNES_HANDHELD.md) records the exact prompts, encoding, and screen/control bounds.

The earlier compact SNES-style gamepad remains at `assets/barnes-controller.webp` as archived artwork and is no longer displayed by the site or its sharing metadata. [Compact-controller provenance](assets/BARNES_CONTROLLER.md) describes that earlier design.

The housing takes inspiration from classic game hardware with original branding. It does not include official Nintendo logos, game artwork, or product photography. No affiliation or endorsement is implied.

## Dragon Ball favicon

`assets/dragon-ball.png` is the unmodified 256×256 transparent **Dragon Ball** icon by **Musett.com**, downloaded from [IconArchive](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html). [Original PNG](https://www.iconarchive.com/download/i45735/musett/dragon-ballz/Dragon-Ball.256.png).

The source lists [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): attribution required, non-commercial use only, no distribution of modified artwork. The depicted products or characters are © their respective copyright owners. No affiliation or endorsement is implied. The homepage footer’s Icon credits disclosure publishes the author, source, and license links. The original PNG is used for browser, Apple touch, and web manifest icons and link previews without image edits; its transparent background contains no checkerboard. The legacy `assets/favicon.svg` and `assets/social-card.svg` paths embed the same unmodified PNG bytes so old references also receive the current icon. Do not reuse this asset for commercial purposes without appropriate permission.

## Toolkit icons

Eight local SVGs use recognizable [Devicon](https://github.com/devicons/devicon) marks, pinned to commit `7330accdbc47e2dc0c19789a48533c4a3c50fe58`. The original logo geometry is preserved; source fills are unified to pale cyan (`#bde8ef`), and unused SVG IDs and metadata are removed. The console theme applies a monochrome dark CSS filter and consistent optical sizing. No icon library, external CDN, font, script, or runtime dependency is required.

| Local asset | Upstream SVG |
| --- | --- |
| `assets/toolkit/java.svg` | [Java plain](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/java/java-plain.svg) |
| `assets/toolkit/python.svg` | [Python plain](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/python/python-plain.svg) |
| `assets/toolkit/gradle.svg` | [Gradle original](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/gradle/gradle-original.svg) |
| `assets/toolkit/cplusplus.svg` | [C++ plain](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/cplusplus/cplusplus-plain.svg) |
| `assets/toolkit/pytorch.svg` | [PyTorch original](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/pytorch/pytorch-original.svg) |
| `assets/toolkit/streamlit.svg` | [Streamlit plain](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/streamlit/streamlit-plain.svg) |
| `assets/toolkit/docker.svg` | [Docker plain](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/docker/docker-plain.svg) |
| `assets/toolkit/aws.svg` | [AWS plain wordmark](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg) |

`assets/toolkit/awk.svg` and `assets/toolkit/diffusers.svg` are original, generic line symbols for text processing and image generation. They are **not** presented as official awk or Diffusers brand logos. All icons are decorative beside visible, accessible tool names; screen readers receive each label once.

Devicon's [license](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/LICENSE) is MIT, reproduced below, included at `assets/toolkit/LICENSE.txt`, and embedded in each derived SVG so the notice travels with the deployed asset. Product names and logos belong to their respective owners and identify tools; their inclusion does not imply affiliation or endorsement. See Devicon's [usage statement](https://github.com/devicons/devicon/blob/7330accdbc47e2dc0c19789a48533c4a3c50fe58/README.md).

### Devicon license

```text
The MIT License (MIT)

Copyright (c) 2015 konpa

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Prism illustrative gallery

Three original illustrations were generated for the browser demo using OpenAI image generation, then exported as 512×512 JPEGs. See `assets/prism/SOURCES.md` for prompts and descriptions. They are illustrative samples, not recorded outputs of Prism Studio; their numeric IDs are not reproducible generation seeds. PNG masters and provenance are excluded from the publication allowlist.

## GitHub avatar

`assets/github-avatar.jpg` is the unmodified public avatar returned by the GitHub API for `elliottbarnes` on 2026-10-11: https://avatars.githubusercontent.com/u/54964377?v=4. The owner explicitly selected this image for their site. It has since been replaced in the published site by the supplied Memoji below. The original remains in source history.

## Project preview images

The four JPEGs under `assets/projects/` are browser screenshots of Elliott’s own public Glassbox, Pixel Language, Architecture Lab, and Automata Lab playgrounds, captured on 2026-10-11. They are local previews linking to those independent projects, not remotely loaded embeds.

## Selected Memoji

`assets/memoji.png` is the winking Memoji supplied and selected by Elliott on 2026-10-11, decoded from his RTFD attachment into a transparent PNG. It supplies both profile images and the local source-code portrait animation. The animation samples the full silhouette without cropping the hair or chin.

## Multi-star radar balls

`assets/dragon-ball-2.png`, `assets/dragon-ball-3.png`, and `assets/dragon-ball-4.png` are original transparent images generated with the built-in imagegen tool on 11 October 2026. The existing Musett one-star icon remains unmodified. Each prompt requested one glossy amber-orange sphere, an upper-left yellow highlight, an amber shadow, and exactly two stars side by side, three stars in a triangle, or four stars in a square. No labels or numbers.

## Saiyan Memoji

`assets/memoji-saiyan.png` was generated with the built-in imagegen edit tool on 11 October 2026 from Elliott's supplied Memoji. Prompt: change only the hairstyle to golden Super Saiyan spikes, preserving face identity, wink, brown eye, tongue-out expression, Memoji material, and transparency. The original `assets/memoji.png` remains in source for recovery and is no longer published. The new image supplies profile cards and the code portrait animation.

`assets/dragon-ball-1.png` completes the generated radar set. Built-in imagegen edit prompt: replace only the two stars in `dragon-ball-2.png` with one centered red five-point star, preserving sphere, glossy material, highlights, shadow, framing, and transparency. The original Musett one-star artwork remains used for the favicon.

Five-, six-, and seven-star icons (`assets/dragon-ball-5.png` through `dragon-ball-7.png`) were made with built-in imagegen edits of the four-star ball. Prompts replace only the stars with five (square plus center), six (two rows of three), or seven (center plus surrounding hexagon), preserving material, highlights, shadow, framing, and transparency. New project screenshots capture the public ellmiott, batchline, and evaldeck demos.

The generated seven-ball set and Saiyan Memoji are published as lossless `.webp` display copies. The balls are 128×128, enough for their 31px radar icons at three device pixels per CSS pixel, including the hover enlargement. The Memoji is 512×512, enough for the 150px desktop avatar at the same density; the entrance samples it into a 120×120 glyph map. Artwork, framing, and transparency remain unchanged. The original 1254×1254 PNG masters stay in source for recovery and provenance, and the licensed Musett favicon remains unmodified PNG.

Recreate these display copies with `node scripts/optimize-art.mjs`. The script uses an existing Sharp installation, either resolved normally or beside the Node runtime's `bin` directory. An explicit installation can be selected with `--sharp-module /path/to/sharp`; no packages are installed automatically. It resizes with the Lanczos3 kernel, then encodes with `lossless: true`, `exact: true`, and `effort: 6`. Before writing, it checks dimensions, retained alpha, and that every decoded RGBA byte—including fully transparent pixels—matches the resized reference. These checks compare against the resized reference, not the larger master.

With Sharp 0.35.5 and WebP 1.6.0, the eight display copies total 237,408 bytes, down from 5,017,998 bytes for the earlier full-resolution lossless WebPs (95.3% smaller), or 8,392,638 bytes for the PNG masters (97.2% smaller). Repeating the script reproduces the same bytes with those encoder versions. Display copies retain the existing published filenames and the 34-file publication boundary.

## Coiling wish dragon

`assets/shenron.png` is a new transparent 1254×1254 master generated with the built-in imagegen tool for the hidden Dragon Ball-inspired wish animation. The selected output is copied into source without modification. It depicts one emerald and gold serpentine dragon with branching horns, whiskers, and an upright S-shaped coil; no text, frame, orb, or background is present.

The display copy `assets/shenron.webp` is 512×512 and 123,884 bytes. Standard asset preparation uses Sharp 0.35.5 to resize the master into 410×410 with Lanczos3, then add 51 transparent pixels on all four sides. This preserves the full silhouette and supplies approximately 10% padding. Encoding uses `lossless: true`, `exact: true`, and `effort: 6`. The alpha channel is retained, and every decoded RGBA byte matches the resized, padded reference. The PNG master is retained outside the publication allowlist; only the WebP is intended for the browser.

The nine generated display copies now total 361,292 bytes. The new WebP increases the publication allowlist from 34 to 35 files and loads only after an explicit summon. `scripts/optimize-art.mjs` reproduces all nine display copies, including the dragon's transparent padding.

Final built-in generation prompt:

> Use case: stylized-concept. Asset type: transparent website sprite and silhouette source for a compact radar particle animation. Create one elegant iconic Shenron-inspired Dragon Ball Z wish dragon: a very long emerald-green Chinese dragon coiled upright into a broad circular S-shaped winding loop. Its prominent dragon head sits near the upper third, facing the viewer in a three-quarter angle, with recognisable branching antler horns, long whiskers, a strong angular muzzle, alert red eyes, and a gold segmented belly down the underside of its long serpentine body. The body forms an unmistakable continuous coiling dragon silhouette, ending in a tapering tail. Style: clean polished anime illustration with bold well-defined shapes, crisp edges and restrained scale detail, green upper body and golden belly. Composition: square canvas, full body completely contained, centered, with at least 10% genuinely transparent padding on every edge. This will be sampled into sparse theme-colored particles inside a small radar, so the unmistakable head, horns, strong coil silhouette, and clean alpha are more important than fine detail. No extra characters or objects. Avoid prominent legs or claws that clutter the silhouette. No orb, no Dragon Balls, no background, no floor, no text, no labels, no watermark, no border, no frame, no cast shadow, no external glow. Output a true transparent cutout with alpha.
