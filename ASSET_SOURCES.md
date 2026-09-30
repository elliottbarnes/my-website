# Asset sources

## Portfolio artwork

The interactive controller in `index.html`, cartridge shapes in `styles.css`, share artwork in `assets/social-card.svg`, and `e`/`64` favicon in `assets/favicon.svg` are original vector/CSS illustrations for this portfolio. The three-grip controller silhouette is adapted from Elliott's own [GitHub profile header](https://github.com/elliottbarnes/elliottbarnes/blob/main/assets/profile-header.svg), with matching gray hardware and blue, green, yellow, and red controls.

These illustrations take inspiration from Nintendo 64-era hardware; they do not use official Nintendo logos, game artwork, or product photography. The playful `ellitendo` and `ellitendo 64` markings identify this personal portfolio using original typography, not an official product or Nintendo wordmark. Nintendo names remain the property of their respective owners; no affiliation or endorsement is implied. The social card is self-contained SVG artwork and requires no external fonts or image assets.

## Dragon Ball favicon

`assets/dragon-ball.png` is the unmodified 256×256 transparent **Dragon Ball** icon by **Musett.com**, downloaded from [IconArchive](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html). [Original PNG](https://www.iconarchive.com/download/i45735/musett/dragon-ballz/Dragon-Ball.256.png).

The source lists [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): attribution required, non-commercial use only, no distribution of modified artwork. The depicted products or characters are © their respective copyright owners. No affiliation or endorsement is implied. The homepage footer publishes the author, source, and license links. The original PNG is used for browser, Apple touch, and web manifest icons without image edits; its transparent background contains no checkerboard. Do not reuse this asset for commercial purposes without appropriate permission.

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
