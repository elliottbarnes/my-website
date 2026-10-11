# Personalized terminal design QA

Verified locally on 11 October 2026 at http://127.0.0.1:4175/.

## Comparison evidence

Source: https://hancore.dev/ and its entered `/site/` view. Saved source captures: `.design/reference-entrance.jpg`, `reference-theme.jpg`, `reference-workspace.jpg` (1280×720 pixels), and `reference-mobile.jpg` (390×844 pixels).

Implementation: `.design/desktop-avatar.jpg`, `desktop-theme.jpg`, `desktop-workspace.jpg` (1280×720); `mobile-avatar.jpg`, `mobile-project.jpg` (390×844). CSS viewports match these pixel dimensions; density normalization was unnecessary. Both use the blackmoney theme. Portrait/typing captures sample different moments in their loops; timing and code text are personalized rather than pixel-diff comparable.

Source and implementation were joined and visually inspected in the same comparison inputs: `.design/comparison-entrance.jpg`, `comparison-workspace.jpg`, and `comparison-mobile.jpg`. `.design/comparison-theme-detail.jpg` compares the picker at native pixel scale; full picker comparison is in `comparison-theme.jpg`.

## Findings and fixes

- Resolved P1: The initial adaptation omitted the reference’s editor sequence and used a substantially different entrance layout. Replaced it with boot, typed source excerpts, NORMAL/INSERT modes, avatar reveal/collapse, procedural graphics, local input visualization, and a full-viewport Enter transition. Header/editor/footer geometry now follows the captured source. Revised evidence: desktop-avatar and comparison-entrance.
- Resolved P1: A three-theme cycle did not match the reference’s picker. Added all 28 named palettes, eight visible options/swatches, search, arrow preview, Enter/click commit, and Escape rollback. Revised evidence: desktop-theme and comparison-theme-detail.
- Resolved P2: The flat main-site navigation differed from the rotating selector. Added screenshot thumbnails, curved wheel arrangement, wheel/drag input, and a personalized EB contour graphic. Revised evidence: desktop-workspace and comparison-workspace.
- Resolved P2: The first phone layout had too little code height and omitted the lower input graphics. Matched the taller editor, 12px/13px code, compact header/footer, and small input diagrams. Revised evidence: mobile-avatar and comparison-mobile.
- Resolved P2: Offscreen wheel buttons were tabbable; switching panels retained scroll position; opening themes from commands nested dialogs; an in-progress entry could overwrite newer navigation. Roving focus, scroll reset, modal handoff, and cancellable entry fix these behaviors.

## Required visual surfaces

- Typography: locally served IBM Plex Mono Regular, matching the reference family. Editor text is 12px with 13px line spacing; UI retains the compact monospace treatment. Personalized filenames wrap differently from the reference’s longer source excerpts.
- Layout: sparse centered entrance, narrow header/footer, 806px desktop editor, full-window glyph transition, left rotating selector, central scrollable terminal, right portrait/readout, and bottom stats. Tall phones retain the lower input visualization; short phones omit it to keep Enter visible.
- Colors: blackmoney default matches the source’s #0c0c0c background and #d8d4b4 foreground. All 28 palette values come from the reference catalog; theme changes recolor the canvas and interface together.
- Imagery: Elliott’s actual GitHub avatar is locally rendered as code characters. The source creator’s video portrait and personal HC artwork are intentionally replaced by Elliott’s avatar and an original animated EB contour study. Project previews are screenshots of Elliott’s real playgrounds. The reference’s visitor counter and camera-like labels are not presented as Elliott’s data; local pointer readouts and dated public GitHub counts are used.
- Copy: approved “ai wizard” and “bicycle for the mind” remain intact. Personal role, links, project descriptions, and code excerpts come from the existing portfolio or verified public GitHub sources.

## Interaction and build verification

- Browser checked desktop 1280×720, phone 390×844, and short phone 320×568; no horizontal page overflow in measured states.
- Verified code/portrait graphics and full-screen transition; Enter opens the site, Escape cancels entry or returns home.
- Verified searchable theme filtering, commit, reload persistence, arrow preview, Escape rollback, and command-to-theme focus restoration.
- Verified arrow-key selection, single visible navigation tab stop, panel scroll reset, and ordinary public demo/source destinations. Wheel/drag thresholds and click suppression also passed focused interaction harnesses.
- Verified pause/resume in the browser; reduced-motion and visibility suspension passed the animation/control harnesses.
- No site-origin warning/error logs in the final desktop check.
- 83 Node tests and 43 Python tests passed. Final asset verification passed for exactly 21 public files. The final HUD/mobile refinement was additionally syntax-checked, exercised by the animation harness, rebuilt, and inspected in-browser.
- JavaScript-free content visibility was reviewed in HTML/CSS; full screen-reader, disabled-JavaScript browser, and cross-browser testing remain unperformed.

## Follow-up polish and limits

The clone reproduces the requested entrance and navigation flow with personalized, original animation code. It is not a byte-for-byte copy of the reference’s animation engine: the source’s recorded face motion and auxiliary worm/eye/ghost effects are not reproduced. Input diagrams are decorative local pointer/typing visuals. Minor timing, artwork, swatch spacing, and line-density differences remain; these do not obstruct the implemented flow. Small terminal-style text follows the chosen reference and is not a claim of an accessibility certification.

Implementation checklist complete: local source changes, source/render comparisons, primary interactions, asset provenance, build verification, and running preview. The initial redesign was published through PR #15 on 11 October 2026 (production commit `ef85a2fa79ad29ea66030e50641e49c20f28343e`), then reviewed in the live browser. Domains have not been purchased.

## Review of the published site

Fresh production captures are saved under `.design/live-review/` (excluded from publication). The review covered arrival and entry, theme selection, reading the profile, browsing projects and opening their demos, and phone/tablet use. The terminal identity, code animation, portrait treatment, and transitions remain intact.

- Fixed: at 1280×720, the About role ended below the terminal viewport (521px versus a 478px panel boundary). Reducing the contour graphic height puts the role within the initial view (456px).
- Fixed: project demo/source links appeared after large previews and code excerpts. Moving them directly below the description makes the Glassbox actions visible at 248px rather than 900px on desktop. All four project panels use the same order.
- Fixed: only eight theme rows existed at a time, with 13px touch targets and no native scrolling to the rest. All 28 options now exist in a scrollable list. Touch layouts use 32px rows, 16px search, a visible Cancel button, and initial focus on Cancel. Desktop keeps its compact eight-row viewport. Phone browser checks reached and selected the last theme by scrolling and verified Cancel rollback.
- Fixed: pointer release outside the selector before drag capture could leave a stale drag. Global release/cancel cleanup and button-state checks prevent later hovering from changing a section.
- Refined: increased phone body text and action targets, exposed pause on coarse pointers, corrected the skip target for non-scripted content, clarified keyboard hints, increased focus-outline contrast, and aligned the manifest with the dark default.
- Refined: at 768×1024, hiding the decorative side portrait expands the main content from 273px to 443px. Phone checks at 390×844 and 320×568 found no horizontal overflow. A final phone pass caught and fixed an overly tall theme dialog.

Validation for these refinements: 91 Node tests pass, including eight new regression tests for theme focus, scrolling, selection, storage failure, and pointer cleanup. Two pointer tests reproduce the bug against the previous implementation. The 21-file build and source-aware artifact verification pass. Final refinement deployment and live evidence are recorded in the task's live-review report; the physical mobile keyboard, full screen-reader behavior, and cross-browser compatibility have not been tested.

final result: passed


## Wheel and reading refinement — 11 October 2026

- Separated moving cards from fixed 44px previous/next controls; added a six-section position counter and polite announcements.
- Confirmed the original wheel drift in the browser: clicking Glassbox scrolled the clipped project tree by 66px. Using non-scrollable clipping keeps both tree and wheel at zero after selection.
- Adapted terminal height to the viewport; added a remaining-content cue and made the details region keyboard-focusable. Arrow keys scroll details normally; arrow keys on the wheel browse, and Home/End jump to its boundaries.
- Corrected native fragment navigation that could hide the first prompt beneath the sticky title. Long status names truncate instead of colliding with GitHub counts.
- Made the command button available at every width, with direct shortcuts for all four projects.
- Browser review: 320×568, 390×844, and 1280×800; no horizontal page overflow at the phone widths. Verified wraparound, wheel Home/End, command selection, native details End scrolling, the scroll cue hiding at the bottom, light/dark themes, pause, and Enter from the entrance. No browser warnings or errors observed.
- Evidence and step-by-step review are in the ignored local `.design/refinement-pass/` folder. This is a focused browser/keyboard check, not a full assistive-technology or physical-device certification.
