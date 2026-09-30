# Barnes handheld housing

Generated with the built-in OpenAI Image Gen tool (`image_gen.imagegen`) on 2026-09-30, editing the user-selected **Option 1: Barnes handheld console** concept. Both generation calls used the referenced image as an edit input and requested a transparent background.

## Selected asset

- Generation output: original RGBA image, 1774 × 887; the PNG master is not published.
- Published asset: `assets/barnes-handheld.webp`, optimized quality-88 WebP with lossless alpha preserved.
- Design reference: the selected Option 1 concept, a wide orange Barnes handheld with a navy inset screen and controls on its side rails.
- Interior usable screen bounds (approximate): left 272, top 110, right 1503, bottom 735. Percent: 15.33% left, 12.40% top, 69.39% width, 70.46% height. This excludes most of the bezel.
- Conservative text/content inset: x 296 through 1480, y 129 through 712.
- D-pad centers: up (140, 358), down (140, 479), left (83, 420), right (197, 420).
- Face-button centers: A (1635, 348), B (1635, 523), radius approximately 54 pixels.
- Artwork is decorative; semantic HTML supplies screen content and transparent accessible controls on top.
- A few exterior RGB pixels look bright in raw-alpha tool previews but have alpha 1/255. Compositing verification against cream confirmed no visible flecks. Alpha is unmodified.

## Exact generation prompt

Use case: precise-object-edit / background-extraction.
Asset type: production website handheld-console housing artwork, with real HTML later placed over the blank screen.
Input image 1 is the selected design and exact housing/style/layout reference.
Preserve the orange Barnes handheld console design in the reference: wide landscape molded orange plastic body, subtle realistic texture, direct front orthographic view, symmetrical navy shoulder buttons, dark navy inset screen bezel, navy plus-shaped D-pad on the left rail, blue A button above red B button on the right rail, black labels "Open" and "Back", embossed oval "Barnes" badge at bottom center. Preserve the D-pad and face-button proportions and embossed letters.
Change only the screen contents and background: completely remove every UI element and all text inside the screen; replace screen contents with one completely uniform flat dark navy #0b172b color, no glow, no reflections, no text, no buttons, no graphics. Leave the surrounding bezel intact.
Make all space outside the physical housing genuinely transparent (alpha), not cream, not white, and not a checkerboard drawing. No cast shadow extending outside the object. Keep a small transparent margin around all edges. Crop much closer to the console than the reference, so the orange housing fills about 98% of width and 96% of height. Produce a wide approximately 2:1 asset. The unobstructed screen should occupy roughly x16%-84% and y10%-85% of the tightly framed asset. Keep the whole housing and every control visible.
This is the same device as the reference with its screen cleared and outside background removed, not a redesigned device. No added objects, no game-brand logos, no extra controls, no watermark. Exact visible text outside screen only: "A", "Open", "B", "Back", "Barnes".

## Cleanup experiment (not selected)

A second generation attempted to remove apparent edge flecks. Pixel inspection showed these were alpha 1/255 display artifacts, so the first generation, with better-preserved molded plastic texture, is selected.

Precise transparent edge cleanup only. Use the supplied orange Barnes handheld PNG as the edit target. Preserve its exact dimensions, composition, shape, controls, text, colors, lighting, orange texture, dark blank screen, and true alpha transparency. Remove all stray yellow/orange/red bright flecks, residue, rim halos and artifacts OUTSIDE the physical orange console silhouette, especially above the top flat edge, along the extreme left/right, and below the bottom edge. These areas must be completely clean alpha-transparent. Ensure a smooth clean antialiased silhouette and a small transparent margin. Do not add a shadow, backdrop, reflection, glow, stroke or anything else. The physical orange housing and blue shoulder buttons should remain unmodified. This is only cleanup of transparent exterior edge pixels. Keep all the lettering exactly: A, Open, B, Back, Barnes. Screen remains blank navy.

