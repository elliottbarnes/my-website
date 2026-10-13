# elliott / ai wizard

A dependency-free terminal portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

The animated entrance renders Elliott’s selected Memoji as moving source-code characters. A minimal header links directly to GitHub; “enter” opens the terminal portfolio and its independent systems projects. Each project has a public repository and a full interactive playground hosted on GitHub Pages:

| Project | Playground | Source |
| --- | --- | --- |
| Glassbox — inspectable WebAssembly compiler | [Run the compiler](https://elliottbarnes.github.io/glassbox/) | [Repository](https://github.com/elliottbarnes/glassbox) |
| Pixel Language — typed graphics language | [Write a shader](https://elliottbarnes.github.io/pixel-language/) | [Repository](https://github.com/elliottbarnes/pixel-language) |
| Automata Lab — regex compiler | [Explore automata](https://elliottbarnes.github.io/automata-lab/) | [Repository](https://github.com/elliottbarnes/automata-lab) |
| Architecture Lab — three generations of Mac hardware | [Explore the machines](https://elliottbarnes.github.io/architecture-lab/) | [Repository](https://github.com/elliottbarnes/architecture-lab) |

## Interaction and accessibility

The entrance takes its visual direction from [hancore.dev](https://hancore.dev/): a dark monospace canvas, code backdrop, quiet status line, and compact theme/entry controls. Its implementation is original; the portrait is Elliott’s supplied Memoji, and the code comes from his public GitHub projects. All fonts and image assets are served locally, with no analytics, API calls, or paid services.

The frameless entrance continuously types excerpts from Elliott’s projects. Graphics launch only on a quick tap or click on a source line: Glassbox reveals the Memoji, Architecture Lab shows a framebuffer, and other projects show procedural interference. Typing continues behind the graphic. Pointer movement and hover never launch effects. A miniature keyboard and wireframe input display respond locally to typing and pointer movement. Tapping the graphic or blank space retracts it; touch/pen effects last six seconds and mouse effects last nine. Swipes, long presses, secondary pointers, controls, and open dialogs do not trigger graphics. Enter uses a 420 ms glyph transition (500 ms fallback); paused/reduced motion enters immediately. Pointer movement renders on the next display frame with time-based smoothing; idle drawing is limited to about 30 fps. Wrapped source rows and syntax tokens are cached, and phones use fewer portrait glyphs and entry particles. `:pause` stops animation; `:theme` opens a searchable picker with 28 palettes, including the original Dragon Ball Z-inspired Saiyan palette: saiyan, phosphor, copper, blue hour, paperwhite, and more. The names update everywhere they appear; saved colours retain their stable internal IDs. Arrow keys preview themes, Enter commits, and Escape restores the previous selection. Preferences persist locally when browser storage is available. Reduced motion starts paused, and drawing stops while the page or entrance is hidden. A readable source-code fallback remains if canvas is unavailable, and a procedural EB monogram substitutes for an unavailable avatar.

Use “enter” (or Enter from the page) to open the portfolio. Arrow keys browse when the wheel is focused; Home/End select its first/last item. The details pane keeps native arrow-key scrolling, while j/k browse sections. `/` or `:` opens the command menu, and Escape returns home. The project wheel responds to scrolling and vertical dragging, with an elastic pull, deliberate one-card swipes, a section counter, and polite screen-reader announcements. A Dragon Ball project radar introduces the About panel: a theme-aware sweep, pulsing signals, and seven native project links using the existing Dragon Ball artwork. Selecting a signal gives a brief energy pulse without delaying navigation. Paused/reduced motion keeps the radar still; hidden panels stop drawing. The command menu is available as a button at every width and offers direct access to all seven projects. Commands only select local sections and preferences; no input is evaluated or sent to a server. Project demos and source links remain ordinary links. Without JavaScript, all portfolio sections are visible.

GitHub counts are an explicitly dated public snapshot from 11 October 2026 (42 repositories, 4 stars across public repositories, 15 followers); they do not imply live synchronization.

The layout adapts its reading height to the viewport, keeps wheel controls separate from the cards, shows a “more” cue while content remains below, provides visible focus and a skip link, and respects reduced motion. All 28 themes can be browsed by scrolling; on touch layouts the picker has larger rows and a visible Cancel control, and search takes focus only when requested. Project demo and source links appear before their previews. At tablet widths the decorative portrait gives its space to the main content. See [design QA](design-qa.md) for tested dimensions and limits.

## Preview and verification

Use Node.js 24 or newer; no package installation is needed.

```sh
node scripts/version-assets.mjs
node --test
node build.mjs
node scripts/verify-site.mjs dist --source .
node server.mjs --dir dist
```

Open `http://localhost:4173`. The explicit thirty-four-file publication list is in `scripts/public-files.mjs`. Build checks reject extra artifacts, symlinks, broken local links, stale asset hashes, and incorrect project destinations.

Production still uses the existing GitHub Actions deployment to a private S3 origin and CloudFront, with version-based recovery. See [DEPLOYMENT.md](DEPLOYMENT.md).

The former handheld design is recoverable in Git history. Existing experimental work under `side-projects/live-demo-lab` is preserved and excluded from publication. The old project repositories remain independent and unchanged.

## Icon credit

The unmodified Dragon Ball favicon is by [Musett.com](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html), under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Attribution appears in the footer. See [ASSET_SOURCES.md](ASSET_SOURCES.md) for retained artwork provenance.

The frameless entrance and reading pane use scouter labels and a Saiyan colour scheme (navy, orange, blue, and green). The former Terminal palette keeps its saved internal ID and now uses Saiyan colours; other saved palettes remain available. The styling adapts to their colours too.

The seven-ball radar includes ellmiott (language-model internals), batchline (batching/backpressure), and evaldeck (replay contract checks), each with its public browser demo and repository.

Tap the entrance filename or line-number gutter to unfold real public commit history and its source path. Tap compiler identifiers such as `tokens`, `wasm`, or `compile` for a source-to-token sketch; remaining code taps retain the portrait and procedural effects. All effects are user-triggered and typing continues. The history is a dated embedded public snapshot, not a live API query; token outputs are an explicitly labeled compile sketch, not a compiler execution.

Visible source letters now carry into every effect and return to their live code cells. Drag an open graphic to pull it, then release to let it settle; swipes on idle code do not launch effects. Select a history hash to read that commit’s subject. The code surface supports Up/Down to select a line, Space to open or close its graphic, Left/Right to select history commits, and Escape to return to code. The filename opens history and focuses these controls. Pausing preserves the current typing position and active effect; resuming continues from there. Paused and reduced-motion visitors can also tap or use the keyboard to explore static previews without an animation loop.

The generated Dragon Balls and Memoji use lossless WebP display copies sized for their rendered dimensions at high pixel density. Together they are 237 KB, saving 95.3% against the previous full-resolution WebPs; original PNG masters remain in source. Recreate them with the optional `scripts/optimize-art.mjs` authoring tool described in ASSET_SOURCES.md. Hidden workspace images load lazily, and the training game initializes its sprite images only when opened. Gameplay can begin with fallback balls while those images decode.

## Hidden training chamber

The small seven-star ball in the footer opens a Dragon Ball-themed brick breaker. The secret command `kamehameha` (also `training` or `breaker`) opens it through the command menu. Drag the paddle on touch devices, or use arrows/a/d and Space. The game starts only after a launch, has three lives, pauses when hidden, and returns focus on close. Clearing all seven shield columns collects the balls; power passes 9000 on completion. No scores or inputs leave the browser.

Source effects now carry actual visible code characters into hash labels, connections, and token particles. Closing reverses the motion toward current code cells while typing continues, and preserves the source excerpt through the end of its typing cycle.
