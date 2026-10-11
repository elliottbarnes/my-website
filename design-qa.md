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

Implementation checklist complete: local source changes, source/render comparisons, primary interactions, asset provenance, build verification, and running preview. Production has not been changed; domains have not been purchased.

final result: passed
