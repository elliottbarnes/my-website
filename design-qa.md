# Playable portfolio review

final result: passed

Scope: mobile-first interactive additions to the existing portfolio. This is a scoped design and functional review, not a full accessibility certification or a physical-phone certification. The production site has not been deployed.

## Design evidence

Source visual truth: current production homepage and project collection, captured before the changes. Local captures are in `.design/playable-review/` (ignored by Git and excluded from the public artifact).

- `reference-desktop.jpg` and `implementation-desktop.jpg`: matching 1265×712 content captures from the 1280×720 browser viewport at default density; dark theme, textured controller, home at scroll position zero. Both were opened and inspected. The final implementation retains a visible focus ring from keyboard testing.
- `mobile-batchline.jpg`, `mobile-prism.jpg`: 390×844 captures of functional project panels.
- `320-terminal.jpg`, `320-reconcile.jpg`: 320×740 captures. All four project panels measured 287px client width with equal scroll width: no horizontal panel overflow.
- `safari-desktop.jpg`: native macOS Safari, 1324×1320 window capture including browser chrome; compatibility evidence, not used for pixel comparison.
- `tablet-light.jpg`: light-theme and reduced-motion review at a 768px CSS viewport. The browser panel scaled the capture to 725px; this capture was not used for pixel comparison.

A few captures during viewport/zoom changes had mismatched states or scaling and were discarded as comparison evidence. The final desktop pair was recaptured at equal dimensions. No density normalization was applied to that pair.

### Fidelity surfaces

- **Typography:** existing system sans and monospace retained. Professional role now appears above the main action. Controller instructions, cartridge action labels, and technology labels are larger. Dialog body text and 16px terminal input remain legible at phone widths.
- **Spacing/layout:** console artwork and two-column desktop composition retained. Phone pages stack vertically; new dialogs use bounded viewport height, internal scrolling, and accessible close controls. Additional optional controls extend the hero intentionally. At 320px terminal suggestions wrap and the input retains its Run button.
- **Colors/tokens:** additions inherit the original light/dark palette and focus colors. Project accents match their cartridge. Checks and game outcomes use text as well as color.
- **Images:** existing controller/cartridge art retained. Three original 512×512 JPEG illustrations total about 232KB, load on demand with the Prism dialog, and include descriptive alternatives. Provenance is in `assets/prism/SOURCES.md`; samples and numeric labels are explicitly illustrative.
- **Content:** four browser-only demos explain project ideas; none claims to run the actual model or production backend. Toolkit mappings were checked against the local project READMEs. Contact now explicitly says Message on LinkedIn.

Focused inspection used the 320px terminal, project close bar/sliders, gallery, game grid, and keyboard focus states; no unreadable full-page thumbnail was used to assess those details.

## Findings and fixes

1. **P2, terminal focus:** asynchronous dialog close could steal focus from the destination heading. Fixed with intentional focus restoration; browser confirmed Projects heading focus after a terminal command. Regression test added.
2. **P2, toolkit focus:** Clear selection hid the focused control. Fixed by returning focus to the previously selected tool; verified in the browser and tests.
3. **P2, reduced motion:** Try it scrolling originally honored only system settings. It now honors manual reduced motion too. Manual control verified to set CSS scroll behavior to auto; system preference changes covered by tests.
4. **P2, modal coordination:** closing one panel could focus behind another. Close handlers now preserve the active dialog; covered by regression tests.
5. **P2, content accuracy:** removed an unsupported Batchline/PyTorch association after checking the project README.
6. **P2, touch and exit controls:** expanded navigation/attribution targets and made the arcade header sticky so Close remains reachable during panel scrolling.
7. **P2, no-JavaScript fallback:** toolkit buttons now start disabled and enhanced instructions stay hidden until initialization; project cards retain ordinary GitHub links.

No remaining actionable P0/P1/P2 findings in the reviewed scope. Existing keyboard-first focus visuals and larger hero are intentional refinements, not drift.

## Functional checks

- Automated: 78 tests passed, covering queue conservation/overload, exact integer-cent reconciliation, sample evaluations, diff reconstruction, game turns/reset/score persistence, storage failures, terminal commands and focus, keyboard isolation, reduced motion, publication boundaries, cache versions, and HTTP preview behavior.
- Build: 30 exact public files verified against source bytes; all 8 JS/CSS files require their content hash and scripts require defer. Source notes and PNG masters are excluded. New public files stay under the already-permitted assets prefix; no IAM changes.
- In-app browser on macOS: all four project previews, queue step/run/pause/reset, failing/passing evaluation examples, cent mismatch/clean reconciliation, three gallery samples, game flip/mismatch/next-pair and B return, terminal unknown command and navigation, toolkit filtering/reset, native dialog focus containment, and controller keyboard opening.
- Responsive checks: phone 390×844, narrow phone 320×740, tablet 768px, and desktop 1280px. No measured horizontal page or project-panel overflow at tested widths.
- Themes/motion: dark and light inspected, manual reduced motion confirmed in browser; system preference and blocked storage paths tested with DOM/unit fixtures.
- Native Safari smoke check: homepage and controller render; project modal opens; `/` opens terminal and a typed project command opens its demo. Safari mouse/keyboard coverage is narrower than the in-app browser suite.
- Browser console: no warnings or errors in the final QA tab at inspection.

## Limits and remaining device check

Mobile checks used browser viewport sizes on the Mac, not a physical iPhone or Android device. Mobile Safari virtual-keyboard behavior, real touch gestures, VoiceOver/TalkBack, and an exhaustive contrast audit were not verified. Native Safari smoke checks do not represent a complete cross-browser test matrix. Live AWS publication and post-deployment checks remain separate from this local review.
