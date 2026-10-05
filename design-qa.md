# Compact portfolio verification

Verified 2026-10-05 in Chrome using the built static artifact.

- No horizontal or vertical document overflow at 320×568, 360×640, 375×667, 390×664, 390×844, 412×915, 768×1024, and 1280×720, in both light and dark mode.
- All three demo links and all three source links are visible and inside the viewport; their clickable areas are at least 44 CSS pixels high.
- The footer remains inside each tested viewport. Layout uses `min-height: 100svh` and normal document flow, without clipping overflow or locking scrolling.
- At enlarged content sizes, the page can grow and scroll. The default-size no-scroll guarantee is limited to tested viewports; it is not a guarantee for arbitrary text settings or short landscape screens.
- With JavaScript disabled, all six project links remain available. The keyboard skip link moves focus to the project section.
- No browser page errors were reported. Light and dark screenshots were visually inspected at desktop and small-phone sizes.
- System reduced-motion preference disables decorative hover transitions. The homepage has no running animations, embedded demos, dialogs, or controller shortcuts.

The project playgrounds are independent GitHub Pages sites. They intentionally allow scrolling to accommodate editors, diagnostics, graphs, and documentation. The single-screen constraint applies to this portfolio landing page.
