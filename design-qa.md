# Barnes handheld homepage — design QA

**final result: passed**

Source visual truth: `.design/handheld/source.png`, the user-selected Option 1 handheld concept (1487 × 1058).
Implementation: local portfolio preview, with real HTML content over `assets/barnes-handheld.webp`.
Primary evidence: `.design/handheld/desktop-final.png`, `.design/handheld/comparison-final.png`, `.design/handheld/comparison-detail.png`, `.design/handheld/mobile-390.png`, `.design/handheld/mobile-320.png`, and `.design/handheld/tablet-768.png`. These local QA captures are intentionally excluded from the public artifact.

## Comparison conditions

- Home state: Batchline selected, light canvas, texture off. Desktop CSS viewport 1487 × 1058; source also 1487 × 1058. Additional CSS widths: 1239, 1152, 768, 390, 320.
- The browser reports a 1.2 device scale. Its screenshot adapter outputs CSS-sized images containing a drawing scaled by 1/1.2 and extra canvas at the right/bottom. Raw captures are retained. Comparisons crop that extra canvas and restore the image to the measured CSS dimensions; they do not change layout or hide controls.
- Both full-view and focused screen-region boards were opened together. Focused crops align the screen content, rather than comparing the external housing padding as typography.
- The dark theme was also opened and captured. The device screen stays navy; surrounding page colors follow the existing preference.

## Findings and iteration history

1. **[P2, fixed] Initial screen overflow near the smaller desktop breakpoint.** The first 1239px check measured a 414px screen with 427px content. Revised header/feature spacing, larger primary typography at wide sizes, shorter project selectors, and an optional keyboard hint at wide sizes. Final checks at 1239px and 1152px show equal client/scroll heights (414/414 and 383/383), including all four project selections at 1239px.
2. **[P2, fixed] Initial feature hierarchy was too small relative to the selected concept.** Increased wide-desktop project heading to 70px, body to 18px and primary action to 16px; centered the housing vertically with more surrounding cream space. `comparison-final.png` and `comparison-detail.png` are the post-fix comparison.
3. **[P2, fixed] Phone project choices appeared after the long feature preview.** Put the choices first in semantic order and show them above the feature on phones, with readable 14px labels (13px at 320px). Removed small secondary labels on phones. All four choices now appear before Try demo. At 320px each choice has 120px width and 64px total height, without overflow.
4. **[P1, fixed] Inline integration could lose focus after terminal launch and numeric navigation could target hidden content.** Suppressed obsolete terminal focus restoration for project commands; numeric shortcuts now activate normal navigation. Browser verification confirmed focus on the demo heading after a terminal project command and return to visible home content using `1`. Added automated regressions.
5. **[P2, fixed] Without JavaScript only the default source was reachable.** Added ordinary source links for all four projects below the housing in a noscript fallback; source fallback regression passes.

No actionable P0/P1/P2 findings remain.

## Required fidelity surfaces

- **Typography:** Native sans-serif matches the reference direction; strong identity and project hierarchy, compact monospace metadata. Intentional smaller type than the image mock allows the real copy and complete 18-slot preview to fit. Project titles, actions, navigation and disclosures were checked for clipping. Mobile primary controls remain readable.
- **Spacing/layout:** Same orange landscape housing, navy screen, left D-pad, right A/B, and molded Barnes badge. A slight desktop height adjustment gives real content room. At tablet/phone widths the housing becomes a shallow orange frame, and open demos grow in document flow. These are deliberate usability adaptations rather than fixed-height inner scrolling.
- **Colors/tokens:** Orange/navy/gold/red/blue palette retained. Cream exterior, navy screen, warm gold selection and primary action. System light/dark and optional texture remain labelled preferences. Browser captures have display-color conversion; the published raster retains its generated orange pixels.
- **Image quality:** Reference-based Image Gen housing, optimized 113,844-byte WebP with exact alpha preservation. No HTML/SVG imitation of the hardware. Screen contents are real semantic HTML. Transparent edges were checked over cream; control bounds match the artwork.
- **Copy/content:** Identity, Nasdaq Verafin role, four projects, sources, toolkit and contact remain. The static Batchline illustration correctly says 2/18, matching the demo capacity rather than the mock's six slots. EvalDeck uses sample outputs; reconciliation uses synthetic records; Prism explicitly labels illustrations, not model output. Favicon and existing social card remain unchanged.

## Interaction and browser evidence

- Direct choice buttons update title, preview and source link. D-pad right wraps from Prism to Batchline; all four directions map to previous/next. Keyboard arrows select, A opens, B/Escape return; native controls keep typing behavior.
- All four demos opened inside the screen. Batchline Step once produced 2 waiting/4 completed/0 rejected; EvalDeck revealed the expected failed timing check; Reconcile Kit reported the exact $0.01 difference; Prism Seed 42 loaded its saved illustration.
- Back restores the prior trigger. Terminal project launch retains heading focus. Numeric `1` closes the demo and reveals project home. Browser checks found no open modal or body scroll lock for inline demos.
- No horizontal overflow at 320, 390, 768, 1152, 1239 or 1487 CSS pixels. Main mobile navigation/actions are at least 44px high; project choices are 64px high.
- No browser warning/error entries during the checked flows.
- Automated validation: 135 JavaScript tests, 43 offline backend tests, exact 32-file build/source verification and clean whitespace check. After the final navigation-target adjustment, the 37 relevant interaction/script/lifecycle tests were rerun and passed.

## Accepted differences and limits

The initial concept is a visual reference, not a literal screenshot clone: complete copy, accurate queue capacity, bounded project buttons and clear sample disclosures take priority. Long demos and small screens use a simpler frame. No live inference/backend is introduced. Physical phone hardware and assistive-technology speech output were not tested; browser accessibility semantics, keyboard behavior and responsive geometry were checked.

## Texture and copy refinement

**final result: passed**

- Compared the same homepage with texture off and on at 1487 × 1058 CSS pixels. The stronger scanline/phosphor pattern, light text glow and illuminated preview accents are visibly distinct while the copy stays readable. The toggle is beside navigation and announces its pressed state.
- Checked 320, 768, 1152 and 1487 CSS widths with no horizontal overflow or clipped screen content. The phone navigation and texture control fit on one row with 44px-high targets.
- The activation sweep lasts one second and runs once. Manual reduced motion removes it while retaining the static texture; the system reduced-motion media rule does the same. Overlay layers have pointer-events disabled. Batchline Step once remained usable with texture on (2 waiting, 4 completed, 0 rejected). Texture persisted after reload.
- Replaced slogan-like headings and asides with quieter copy throughout the homepage, demos, terminal, arcade and error page. The Steve Jobs quote and attribution are unchanged. Social-card artwork is unchanged.
- Review caught and fixed a print cascade conflict: the texture-on screen still prints with a white background, and its toggle is hidden.
- Validation: all 135 JavaScript tests passed; the exact 32-file production build and source verification passed. Browser console reported no warnings or errors during the checked flows.
