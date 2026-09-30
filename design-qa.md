# Compact Barnes controller review

final result: passed

Scope: replace the tall three-grip controller with a compact SNES-inspired gamepad chosen for its horizontal silhouette; retain the orange/navy identity and Barnes badge. Adapt visible control labels to the new layout. No project content, favicon, backend, or publication boundary changes.

## Findings and fixes

- Initial review found the inherited 44px circular hit regions overlapped at phone widths. Targets now scale to 10% of the artwork width, bounded at 28–44px. At the 320px viewport every target measured 28.8px, all eight centers hit their intended control, and no circular regions overlapped. The separate Load/Back/Toolkit guide retains 44px height. Physical touch-device usability remains untested.
- Updated the social image description to remove the old three-grip reference.
- No remaining actionable P0/P1/P2 findings. The normalized image comparison after these fixes passed.

## Source and evidence

Source visual truth: `.design/compact-controller/generated-master.png` (1738×905), generated using the earlier Barnes artwork as a material/palette reference. The user delegated the controller design choice. Exact built-in Image Gen prompt: `assets/BARNES_CONTROLLER.md`.

Implementation: local site at `http://127.0.0.1:4187/`, captured and exercised in the Codex in-app browser. Evidence lives in the ignored `.design/compact-controller/` directory.

- `desktop-light.png` and `desktop-dark.png`: 1280×1000 CSS/pixel views, density 1. Full hero, navigation and beginning of project collection inspected.
- `tablet-dark.png`: 768×1000.
- `mobile-320.png` and `mobile-focus.png`: 320×840, light and dark focus states. The focus view is intentionally scrolled to the hero.
- `mobile-390-dark.png`: 390×844, page at top.
- `social.png`: sharing SVG rendered with the new image embedded; no external image dependencies.
- `reference-comparison.png`: source at left, browser controller at right. Source scaled to 440px wide; screenshot cropped from x716/y188 at 422×220 and scaled to 440px. Both preserve aspect ratio on the same navy background. The browser crop is slightly wider than the 420×218.7 CSS image to include fractional bounds. This is the focused comparison; full hero screenshots establish page composition separately.
- `before-desktop.png` and `before-mobile.png`: original device footprint for comparison; not the new asset fidelity target.

## Required fidelity surfaces

- Typography: existing site font, weights and copy remain unchanged. Barnes, SELECT, START and X/Y/A/B are legible raster lettering from the source. Semantic labels match the rendered controls.
- Spacing and layout: complete rounded horizontal silhouette, no cable or handles. Artwork retains its 1738:905 ratio without cropping or stretching. Desktop controller is 420×218.7 versus the previous 460×460; hero height is 560.3 versus 801.6. At 390px, controller height is 186.4 versus 358 and hero height is 836.0 versus 1007.6. Navigation and project cards remain reachable with no horizontal overflow at inspected phone widths.
- Colors/tokens: orange shell, navy D-pad/shoulders, gold X, ivory Y, blue A and red B match the generated source and existing theme. Both page themes inspected.
- Image quality: true alpha preserved in a 257,348-byte WebP. No baked background/checkerboard or visible edge halo. Source/rendered comparison shows the intended silhouette and markings with expected browser downsampling. Site shadow remains intentional.
- Copy/content: role and project content unchanged. The legend uses X for Toolkit; SELECT switches theme; Y changes texture. START is now a second launch action alongside A.

## Verification

- All 126 JavaScript tests and 43 offline backend tests passed. The first sandboxed JS run could not bind localhost; the same suite passed with local-server permission.
- Build/source verification passed for the unchanged 31-file public allowlist; git diff --check passed after removing a documentation EOF blank line.
- Actual browser actions checked D-pad previous/next, START opening selected EvalDeck, A opening selected Prism Studio, keyboard B closing the dialog, X navigating to Toolkit, B returning to the hero, SELECT changing theme and Y changing texture.
- Keyboard focus ring visibly inspected at 320px. Eight hit-target centers and circular separation checked at 320px.
- Final browser console showed no warnings or errors.

## Limits and handoff

No physical phone, screen-reader, or full accessibility audit was performed. This change does not activate the excluded Live Demo Lab. Preview evidence and original image master remain outside the publication allowlist. Production deployment and HTTPS byte verification are tracked separately.
