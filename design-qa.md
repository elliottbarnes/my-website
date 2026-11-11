# Reference comparison — circular portfolio

Reference: https://iansilber.com/ (2026-11-11). Scope: faithful independent recreation using Elliott's verified content. Evidence: `docs/replica-review/`; additional interaction captures remain in the sibling, non-public `ian-replica-evidence-2026-11-11` folder.

## Comparison method

Reference and implementation screenshots were inspected together at matching 1440×1000 and 390×844 viewport sizes. Both initial states use a black background and a circular Helvetica biography. The implementation capture is paused immediately after load to make it reviewable; the reference continues moving. This accounts for small positional/rotational differences. The 320px scene, game, results and scrolling content panel were also inspected.

## Findings and corrections

- P2: filled puck cut off the outer half of its text. Expanded its solid fill beyond the glyph centerline.
- P2: the reference's white-on-orange/red treatment is insufficient for small text. Kept those background colours and used dark ink; secondary text opacity strengthened throughout, with a stronger results scrim so the blurred puck cannot reduce contrast behind labels.
- P2: explicit Resume under reduced motion changed the label without moving. Explicit opt-in now enables movement; reset and system preference changes restore the preference behavior.
- P2: assistive activation of the native ring button had no click path. Added a synthesized-click path in addition to pointer and keyboard gestures.
- P2: content behind the open portfolio panel stayed keyboard-accessible. The scene and its controls are now inert while the panel is open.

- P1: WebKit slow frames extended the 15-second game because the countdown shared the physics timestep cap. Countdown now uses actual active elapsed time; movement remains bounded. Uneven-frame unit regressions and real-time WebKit expiry checks pass.

## Intentional differences

Elliott's biography replaces Ian's and naturally changes letter spacing. All seven actual projects and social links are accessible through a compact panel and without JavaScript. Persistent pause/reset/play/sound controls and keyboard support are retained. The results table contains local scores rather than a shared service. Sound is opt-in synthesis, not copied recordings. Motion trajectories are independently implemented approximations. No device-motion permission is requested.

## Final validation

Full browser regression: 122 passed, 6 documented browser-protocol skips, 0 failed. Node: 496 passed; Python: 43 passed. Build, exact artifact verification and performance budgets pass. No unresolved P0/P1/P2 findings remain.

final result: passed
