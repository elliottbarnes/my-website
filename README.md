# elliott / ai wizard

A dependency-free terminal portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

The animated entrance renders Elliott’s selected Memoji as moving source-code characters. The entrance shows the existing role and project-focus copy before any interaction. A minimal header links directly to GitHub; “explore projects” opens the featured Architecture Lab project directly. The `whoami` panel remains available in the wheel and command menu. Pause and theme controls remain visible with 44px minimum targets. Each project has a public repository and a full interactive playground hosted on GitHub Pages:

| Project | Playground | Source |
| --- | --- | --- |
| Glassbox — inspectable WebAssembly compiler | [Run the compiler](https://elliottbarnes.github.io/glassbox/) | [Repository](https://github.com/elliottbarnes/glassbox) |
| Pixel Language — typed graphics language | [Write a shader](https://elliottbarnes.github.io/pixel-language/) | [Repository](https://github.com/elliottbarnes/pixel-language) |
| Automata Lab — regex compiler | [Explore automata](https://elliottbarnes.github.io/automata-lab/) | [Repository](https://github.com/elliottbarnes/automata-lab) |
| Architecture Lab — three generations of Mac hardware | [Explore the machines](https://elliottbarnes.github.io/architecture-lab/) | [Repository](https://github.com/elliottbarnes/architecture-lab) |
| ellmiott — language-model internals | [Inspect attention](https://elliottbarnes.github.io/ellmiott/) | [Repository](https://github.com/elliottbarnes/ellmiott) |
| batchline — batching and backpressure | [Shape the traffic](https://elliottbarnes.github.io/batchline/) | [Repository](https://github.com/elliottbarnes/batchline) |
| evaldeck — output contracts | [Inspect the checks](https://elliottbarnes.github.io/evaldeck/) | [Repository](https://github.com/elliottbarnes/evaldeck) |

## Interaction and accessibility

The entrance takes its visual direction from [hancore.dev](https://hancore.dev/): a dark monospace canvas, code backdrop, quiet status line, and compact theme/entry controls. Its implementation is original; the portrait is Elliott’s supplied Memoji, and the code comes from his public GitHub projects. All fonts and image assets are served locally, with no analytics, API calls, or paid services.

The frameless entrance continuously types excerpts from Elliott’s projects. Graphics launch only on an explicit source-line tap, click, or keyboard activation. Project-specific rotations interleave twelve mathematical and algorithmic experiments; the Memoji is a rare discovery. Typing continues behind the graphic. Pointer movement and hover never launch effects. A miniature keyboard and wireframe input display respond locally to typing and pointer movement. Tapping the graphic or blank space retracts it; touch/pen effects last six seconds and mouse effects last nine, while the staged ECDSA explanation stays open for inspection. Swipes, long presses, secondary pointers, controls, and open dialogs do not trigger graphics. Enter uses a 420 ms glyph transition (500 ms fallback); paused/reduced motion enters immediately. Pointer movement renders on the next display frame with time-based smoothing; idle drawing is limited to about 30 fps. Wrapped source rows and syntax tokens are cached, and phones use fewer portrait glyphs and entry particles. `:pause` stops animation; `:theme` opens a searchable picker with 28 palettes, including the original Dragon Ball Z-inspired Saiyan palette: saiyan, phosphor, copper, blue hour, paperwhite, and more. The names update everywhere they appear; saved colours retain their stable internal IDs. Arrow keys preview themes, Enter commits, and Escape restores the previous selection. Preferences persist locally when browser storage is available. Reduced motion starts paused, and drawing stops while the page or entrance is hidden. A readable source-code fallback remains if canvas is unavailable, and a procedural EB monogram substitutes for an unavailable avatar.

Use “explore projects” (or Enter from the page) to open the portfolio. Arrow keys browse when the wheel is focused; Home/End select its first/last item. The details pane keeps native arrow-key scrolling, while j/k browse sections. `/` or `:` opens the command menu, and Escape returns home. The project wheel responds to scrolling and vertical dragging, with an elastic pull, deliberate one-card swipes, a section counter, and polite screen-reader announcements. A Dragon Ball project radar introduces the About panel: a theme-aware sweep, pulsing signals, and seven native project links using the existing Dragon Ball artwork. Selecting a signal gives a brief energy pulse without delaying navigation. Paused/reduced motion keeps the radar still; hidden panels stop drawing. The command menu is available as a button at every width and offers direct access to all seven projects. Commands only select local sections and preferences; no input is evaluated or sent to a server. Project demos and source links remain ordinary links. Without JavaScript, all portfolio sections are visible.

Project copy, links, previews, aliases, and search terms live in `data/projects.mjs`. The build generates the wheel, radar, project panels, and command entries from that list while retaining readable static HTML. Run `node scripts/generate-projects.mjs` to refresh the source preview after editing the list. The entrance’s source, related sketch, and playground controls follow the displayed project. The sketch is an illustration; the linked playground runs the full project.

The layout adapts its reading height to the viewport, keeps wheel controls separate from the cards, shows a “more” cue while content remains below, provides visible focus and a skip link, and respects reduced motion. All 28 themes can be browsed by scrolling; on touch layouts the picker has larger rows and a visible Cancel control, and search takes focus only when requested. Project demo and source links appear before their previews. At tablet widths the decorative portrait gives its space to the main content. See [design QA](design-qa.md) for tested dimensions and limits.

## Preview and verification

Use Node.js 24 or newer; no package installation is needed.

```sh
node --test
node build.mjs
node scripts/verify-site.mjs dist --source .
node server.mjs --dir dist
```

Open `http://localhost:4173`. The explicit publication list is in `scripts/public-files.mjs`. Build checks reject extra artifacts, symlinks, broken local links, stale asset hashes, and incorrect project destinations.

Production still uses the existing GitHub Actions deployment to a private S3 origin and CloudFront, with version-based recovery. See [DEPLOYMENT.md](DEPLOYMENT.md).

The former handheld design is recoverable in Git history. Existing experimental work under `side-projects/live-demo-lab` is preserved and excluded from publication. The old project repositories remain independent and unchanged.

## Icon credit

The unmodified Dragon Ball favicon is by [Musett.com](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html), under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Attribution appears in the footer. See [ASSET_SOURCES.md](ASSET_SOURCES.md) for retained artwork provenance.

The frameless entrance and reading pane use scouter labels and a Saiyan colour scheme (navy, orange, blue, and green). The former Terminal palette keeps its saved internal ID and now uses Saiyan colours; other saved palettes remain available. The styling adapts to their colours too.

The seven-ball radar includes ellmiott (language-model internals), batchline (batching/backpressure), and evaldeck (replay contract checks), each with its public browser demo and repository.

Tap the entrance filename or line-number gutter to unfold real public commit history and its source path. Tap source text to discover the next experiment; Glassbox begins with a source-to-token sketch, while other projects begin with a related field or algorithm. All effects are user-triggered and typing continues. The history is a dated embedded public snapshot, not a live API query; token outputs are an explicitly labeled compile sketch, not a compiler execution.

Visible source letters now carry into every effect and return to their live code cells. Drag an open graphic to pull it, then release to let it settle; swipes on idle code do not launch effects. Select a history hash to read that commit’s subject. The code surface supports Up/Down to select a line, Space to open or close its graphic, Left/Right to select history commits, and Escape to return to code. The filename opens history and focuses these controls. Pausing preserves the current typing position and active effect; resuming continues from there. Paused and reduced-motion visitors can also tap or use the keyboard to explore static previews without an animation loop.

The generated Dragon Balls and Memoji use lossless WebP display copies sized for their rendered dimensions at high pixel density. Together they are 237 KB, saving 95.3% against the previous full-resolution WebPs; original PNG masters remain in source. Recreate them with the optional `scripts/optimize-art.mjs` authoring tool described in ASSET_SOURCES.md. Hidden workspace images load lazily, and the training game initializes its sprite images only when opened. Gameplay can begin with fallback balls while those images decode.

## Capsule Arcade

The small seven-star ball in the footer opens a cartridge picker spanning three game generations. **Piccolo’s Lookout** is a top-down action adventure inspired by 1990s monochrome handhelds and *Link’s Awakening*, with original rooms, sprites, and a four-shade olive screen. **Goku Cloud Trail** uses a colourful 16-bit console aesthetic, layered scenery, and animated pixel sprites. **Brick Breaker** retains its modern celestial arena and effects. Game scripts and their stylesheets load only when requested. A loading failure offers a retry, and closing a pending load prevents it from opening later.

Guide Piccolo through three rooms, use ki to activate switches and face its wardens, and restore the bell. In the platformer, run and jump through three landscape regions, fire ki at patrol bots, gather seven Dragon Balls, and reach the finish. A checkpoint keeps collected balls safe after a fall, and a direction guide helps locate missed balls. Keyboard controls and native buttons provide the same actions as touch. Pause, restart, and return-to-picker controls remain available. Closing restores focus to the original trigger; hidden pages suspend play. Scores and input stay in the browser.

Use `arcade`, `piccolo`, or `platformer` from the command menu. `kamehameha` (also `training` or `breaker`) still opens Brick Breaker: drag the paddle on touch devices, or use arrows/a/d and Space. It starts only after a launch, has three lives, and collects the seven balls as its shield columns fall. The earlier Ki Control and Radar Hunt remain available through their `ki` and `radar` commands; `goku` opens the terminal story below.

An original illustrated celestial arena gives the chamber depth; the game loads its 145 KB WebP only when opened, with a drawn fallback if it is unavailable. The dark court keeps the energy ball and shield health readable across site themes. Canvas effects add a tapered ki trail, impact rings, shield fragments and collection feedback without changing the physics. Reduced motion keeps the artwork and damage cues while suppressing decorative movement. [Arena provenance and generation prompt](assets/TRAINING_ARENA.md).

## Follow the signals

Opening a project marks its Dragon Ball as explored. Visit all seven to reveal a small `summon` action in the radar: particles gather into a theme-colored wish dragon. It starts only when selected; `return` or Escape restores the signals. The hidden `wish` and `shenron` commands also work after all seven projects have been visited. Progress stays in session storage in the current tab and tolerates denied storage. Paused and reduced-motion visitors get a static reveal, while hidden panels and the training chamber suspend animation. The 124 KB dragon artwork loads on the first summon only; the source PNG stays outside the public artifact.

The command menu also searches project names, descriptions, and a small factual vocabulary. Try `compiler`, `regex`, `mac`, `attention`, `batching`, or `checks`. Arrow keys select a result and Enter opens it; native buttons remain clickable and their Tab order follows ranking. Exact commands and theme names keep their previous behavior. Search runs entirely in the browser and does not execute or transmit input.

Source effects now carry actual visible code characters into hash labels, connections, and token particles. Closing reverses the motion toward current code cells while typing continues, and preserves the source excerpt through the end of its typing cycle.


## ECDSA source animation

Open the command menu with `/`, type `ecdsa`, and press Enter. ECDSA also appears in the source-tap experiment rotation. Source characters form a finite-field point grid and walk through a base point, public-key derivation, nonce point, signature, and public verification. Use the arrow buttons or Left/Right on the source surface to inspect six stages, play/pause to control playback, and **tamper hash** to see the same signature fail for a changed message hash. Escape returns the characters to code. The animation stays open until dismissed and supports static manual steps with reduced motion or the site paused.

This is a computed educational example on `y² = x³ + 2x + 2 (mod 17)`, base point `(5,1)` of order `19`. Point coordinates use modulus 17; signature scalars use modulus 19. Public demo values `d=7`, `k=3`, and an already-derived hash representative `z=11` produce public key `(0,6)` and signature `(10,8)`. Changing `z` to 12 rejects that signature. No message hashing or production key generation is performed. The tiny curve and exposed fixed nonce are unsuitable for real signatures; real ECDSA uses approved parameters and a secret, correctly generated per-message nonce. The arithmetic follows [SEC 1 v2, sections 4.1.3–4.1.4](https://www.secg.org/sec1-v2.pdf). Finite-field points are discrete; the display does not imply a continuous real curve.


## More source discoveries

Source taps now interleave twelve experiments per project, with six new forms: Fourier synthesis, a Lorenz attractor, a golden-angle seed spiral, shortest-path search, quadtree subdivision, and image convolution. The source portrait appears once every 36 discoveries (previously every nine), and the last six experiments are excluded even when the displayed source changes. Git-history inspection does not consume the rotation. Focus the source and press **N** to discover the next experiment; Space still toggles the current graphic and Escape returns to code.

The settled diagrams use solid geometry: a corridor search wave and traced route, adaptive spatial partitions, a sliding image kernel, an oscilloscope with harmonic vectors, a depth-shaded Lorenz trajectory, seed spirals, connected graph nodes, moving sort bars, and a shaded interference surface. Architecture Lab opens with a packed-byte framebuffer scan that decodes each byte into eight pixels. Source characters still travel into and out of each instrument. Active scenes have a 350px drawing area, larger labels, and no competing decorative input display.

The existing sorting and graph-search sketches complete within their display window, show their actual algorithm progress, and hold the result before restarting. The cellular automaton grows from its initial seed. All effects use the same source-character transitions and theme colours, preserve pause/reduced-motion behavior, and stop rendering when hidden. Reduced-motion discoveries use meaningful frozen diagrams; pausing a running effect preserves its exact current frame. Larger active drawing areas keep labels readable on short screens; those screens can scroll while exploring an effect. Expensive model traces are cached and rendering uses bounded sample counts.

## Goku adventure

Run `goku` from `:cmd` (also searchable as `adventure`) for **the quiet current**, one original Dragon Ball fan episode. The interface is an amber-on-black terminal: ASCII scenery, echoed commands, scrollback and one live prompt. Three decisions determine how Goku releases a blocked spillway, with earlier preparations reflected in the ending.

Use plain verbs such as `brace gate`, `clear channel`, `wait`, `probe rock`, `lift gate` and `ki pulse`. `look` or `look gate` inspects the scene, `talk bulma` asks for advice, `map` shows the valley and `status` reviews preparations; inspection never advances the story. Compact native buttons offer the same commands on touchscreens. `help` reveals the available verbs, Up/Down recalls commands and Tab completes an unambiguous prefix. `read` displays the original full scene prose when wanted; the concise default transcript changes reading pace, so no measured playtime is claimed.

`clear` clears the screen while retaining story progress. `restart` requires confirmation. `exit` or Escape returns focus to the portfolio, and reopening keeps progress and scrollback within the current page. Output appears immediately without a typewriter delay, flicker or animated scan lines. Background scene/radar animation suspends while the terminal is open. No inputs leave the browser; transcript and command recall are bounded in memory. The existing three-game chooser and other commands remain intact.

`assets/goku-story.js` contains the original immutable state and full prose. `assets/goku-terminal.js` supplies concise scenes, ASCII and the command parser; `assets/goku-adventure.js` handles the terminal interface. Tests enumerate all 22 reachable states and eight decision routes, read commands, aliases, invalid/stale input, command history/completion and modal lifecycle. Automated checks do not establish enjoyment or physical-phone keyboard behavior.

Characterization drew on manga panels published by the official Dragon Ball site: [Goku learning and adapting techniques (Tales 15 and 48)](https://en.dragon-ball-official.com/news/01_140.html) and [Upa's reunion with Bora (Tale 112)](https://en.dragon-ball-official.com/news/01_420.html). These childhood-era examples inform curiosity and helping others; the episode and English dialogue are original, not a translation or a canonical event. No source panels are included in the site.
