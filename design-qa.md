# Compact portfolio verification

Verified 2026-10-07 in Chrome using the built static artifact, with the system dark palette.

- No horizontal overflow at 280×653, 320×568, 360×640, 375×667, 390×664, 390×844, 768×1024, and 1280×900.
- The page fits without vertical scrolling at 375×667, 390×664, 390×844, 768×1024, and 1280×900. Shorter/narrower phones scroll naturally: document heights were 689 pixels at 320×568, 692 at 360×640, and 778 at 280×653.
- Role text is 14 pixels on desktop and 12 on phones; project descriptions are 14 and 13 respectively. Small phones retain these sizes rather than shrinking text to force the footer into view.
- All six project links remain available. Their clickable areas were at least 44 CSS pixels high in the five breakpoint measurements at 280, 360, 375, 390, and 768 pixels wide.
- The keyboard skip link moves focus to the project section; the next Tab focuses the Glassbox demo link with a visible outline.
- Desktop, 390-pixel and 320-pixel screenshots were visually inspected. No site-origin errors appeared in the browser log; unrelated browser-extension warnings were excluded.
- Layout uses `min-height: 100svh` and normal document flow without clipping or scroll locking. Light mode, enlarged text, disabled JavaScript, assistive technology, and other browsers were not re-tested in this pass.

The project playgrounds are independent GitHub Pages sites. They allow scrolling to accommodate editors, diagnostics, graphs, and documentation. The landing page favors a compact layout while preserving readable text and access to every link.
