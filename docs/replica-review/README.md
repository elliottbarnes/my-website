# Circular portfolio replica — review notes

Review-only alternative, based on fresh `origin/main` at `49439c92b9c3298df3c728a12be56adefa04dc89`. The earlier studio alternative is preserved on its own branch. This implementation starts over with the full-screen circular composition requested in the correction.

## Open locally

Preview: <http://127.0.0.1:4187/>

Checkout: `/Users/elliott/Documents/Personal Portfolio/.project-work/portfolio-ian-replica-2026-11-11`

Exact restart command on this Mac (stop a previous process on this port before restarting):

```sh
cd '/Users/elliott/Documents/Personal Portfolio/.project-work/portfolio-ian-replica-2026-11-11'
REPLICA_NODE='/Users/elliott/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
"$REPLICA_NODE" build.mjs
PORT=4187 HOST=127.0.0.1 "$REPLICA_NODE" server.mjs --dir dist
```

The server binds to loopback. A Git branch is not a hosted preview.

## Review the interaction

- Drag and throw the biography ring; it falls, bounces, changes colour and deforms at the edges.
- Pinch with two fingers to stretch it. Hold deep pressure against an edge to burst it into words; tap the background to reassemble it.
- Double-tap the ring, press Enter with it focused, or choose **play**. Move the outline ring to strike the filled puck through the top goal during a 15-second round.
- With the ring focused, arrows move it, Space pauses, R resets, and Escape leaves the game. Pause/reset are also visible controls.
- **about & projects** contains the accurate role, full introduction, all seven project screenshots/descriptions/demo/source links, GitHub, LinkedIn, and the preserved original Playground / Arcade.
- Reduced motion starts still. Choosing Resume explicitly enables movement for the current visit. Sound starts off and uses small original synthesized tones only after opt-in.

## Reference and deliberate adaptations

Reference: <https://iansilber.com/>, inspected on 2026-11-11 at desktop, 390px and 320px widths. Matching elements include the empty full-viewport scene, lowercase Helvetica circular biography, measured per-letter spacing, gravity/throw/bounce, elastic wall pressure, colour cycling, pinch, word burst/reassembly, the half-size paddle/puck, top goal and timer, and results/replay layout.

All application code here is an independent implementation. No original application code or sound assets were copied. Physics is an approximation of the observed behavior, not a claim of identical frame-by-frame trajectories. The original remote leaderboard is replaced by explicitly labelled on-device records; no calls go to Ian's services. Small persistent controls, keyboard access, a static content fallback, and the project panel preserve portfolio usefulness. Dark ink on red/orange and stronger secondary text contrast are accessibility adaptations.

## Screenshots

| State | Capture |
| --- | --- |
| Desktop, 1440 × 1000 | [desktop.jpg](desktop.jpg) |
| Mobile, 390 × 844 | [mobile.jpg](mobile.jpg) |
| Narrow, 320 × 700 | [narrow-320.jpg](narrow-320.jpg) |
| Air hockey | [game-desktop.jpg](game-desktop.jpg) |
| Mobile results | [results-mobile.jpg](results-mobile.jpg) |
| Desktop project panel | [projects-desktop.jpg](projects-desktop.jpg) |
| Mobile project panel | [projects-mobile.jpg](projects-mobile.jpg) |
| Reference desktop | [reference-desktop.jpg](reference-desktop.jpg) |
| Reference mobile | [reference-mobile.jpg](reference-mobile.jpg) |

Captures and notes are outside the public allowlist and `dist/`.

## Verification

- Node: 496 passed, no skips.
- Python backend regressions: 43 passed.
- Build and exact source/artifact verification: 58 public files passed.
- Performance budgets: passed. Eager JavaScript 34,144 bytes across two modules (10,328 gzip estimate); CSS 7,541 bytes; HTML 11,291 bytes; full public artifact 1,921,664 bytes. These are artifact measurements, not a Lighthouse score.
- Palette contrast: all eight colours pass 4.5:1 for secondary text (minimum 4.88:1); results scrim worst-case minimum 4.58:1.
- Browser regressions: **122 passed, 6 skipped, 0 failed** across Chromium and WebKit in 4.4 minutes. Replica coverage: 23 passed, one intentional WebKit skip for trusted CDP touch/pinch (a Chromium-only protocol). The other five skips are existing Chromium-specific checks. Checks include axe accessibility, desktop/320px layout, all project content, keyboard and assistive activation, drag momentum, pinch/cancellation, burst/reassembly, reduced motion and explicit Resume, sound opt-in, real 15-second WebKit expiry, local scores, modal focus, and no-JavaScript fallback.

## Production boundary

The only workflow remains `.github/workflows/site.yml`. Branch pushes do not match its `push: branches: [main]` trigger. Pull requests run checks with read-only repository permissions; production requires `refs/heads/main` and a push/manual event. No workflow, AWS policy, deployment script, hosting or DNS changes were made. No merge, auto-merge, workflow dispatch or production deployment is part of this review.
