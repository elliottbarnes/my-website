# elliott / ai wizard

A dependency-free terminal portfolio for [elliottbarnes.ca](https://elliottbarnes.ca).

The animated entrance renders Elliott’s GitHub avatar as moving source-code characters. A minimal header links directly to GitHub; “enter” opens the terminal portfolio and its independent systems projects. Each project has a public repository and a full interactive playground hosted on GitHub Pages:

| Project | Playground | Source |
| --- | --- | --- |
| Glassbox — inspectable WebAssembly compiler | [Run the compiler](https://elliottbarnes.github.io/glassbox/) | [Repository](https://github.com/elliottbarnes/glassbox) |
| Pixel Language — typed graphics language | [Write a shader](https://elliottbarnes.github.io/pixel-language/) | [Repository](https://github.com/elliottbarnes/pixel-language) |
| Automata Lab — regex compiler | [Explore automata](https://elliottbarnes.github.io/automata-lab/) | [Repository](https://github.com/elliottbarnes/automata-lab) |
| Architecture Lab — three generations of Mac hardware | [Explore the machines](https://elliottbarnes.github.io/architecture-lab/) | [Repository](https://github.com/elliottbarnes/architecture-lab) |

## Interaction and accessibility

The entrance takes its visual direction from [hancore.dev](https://hancore.dev/): a dark monospace canvas, code backdrop, quiet status line, and compact theme/entry controls. Its implementation is original; the portrait and code come from Elliott’s public GitHub projects. All fonts and image assets are served locally, with no analytics, API calls, or paid services.

The entrance boots an editor, types and edits excerpts from Elliott’s projects, reveals the GitHub avatar through code, and plays procedural wave and framebuffer sequences. A miniature keyboard and wireframe input display respond locally to typing and pointer movement. Enter zooms through a full-window glyph field into the main site. `:pause` stops animation; `:theme` opens a searchable picker with 28 palettes matching the reference, renamed for this site: terminal, phosphor, copper, blue hour, paperwhite, and more. The names update everywhere they appear; saved colours retain their stable internal IDs. Arrow keys preview themes, Enter commits, and Escape restores the previous selection. Preferences persist locally when browser storage is available. Reduced motion starts paused, and drawing stops while the page or entrance is hidden. A readable source-code fallback remains if canvas is unavailable, and a procedural EB monogram substitutes for an unavailable avatar.

Use “enter” (or Enter from the page) to open the portfolio. Arrow keys browse when the wheel is focused; Home/End select its first/last item. The details pane keeps native arrow-key scrolling, while j/k browse sections. `/` or `:` opens the command menu, and Escape returns home. The project wheel responds to scrolling and vertical dragging, with previous/next buttons, a section counter, and polite screen-reader announcements. A Dragon Ball project radar introduces the About panel: a theme-aware sweep, pulsing signals, and four native project links using the existing Dragon Ball artwork. Selecting a signal gives a brief energy pulse without delaying navigation. Paused/reduced motion keeps the radar still; hidden panels stop drawing. The command menu is available as a button at every width and offers direct access to all four projects. Commands only select local sections and preferences; no input is evaluated or sent to a server. Project demos and source links remain ordinary links. Without JavaScript, all portfolio sections are visible.

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

Open `http://localhost:4173`. The explicit twenty-one-file publication list is in `scripts/public-files.mjs`. Build checks reject extra artifacts, symlinks, broken local links, stale asset hashes, and incorrect project destinations.

Production still uses the existing GitHub Actions deployment to a private S3 origin and CloudFront, with version-based recovery. See [DEPLOYMENT.md](DEPLOYMENT.md).

The former handheld design is recoverable in Git history. Existing experimental work under `side-projects/live-demo-lab` is preserved and excluded from publication. The old project repositories remain independent and unchanged.

## Icon credit

The unmodified Dragon Ball favicon is by [Musett.com](https://www.iconarchive.com/show/dragon-ballz-icons-by-musett/Dragon-Ball-icon.html), under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Attribution appears in the footer. See [ASSET_SOURCES.md](ASSET_SOURCES.md) for retained artwork provenance.
