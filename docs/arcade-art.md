# Arcade artwork

The arcade uses one bright palette: navy outlines, cream surfaces, turquoise energy and gold rewards. Piccolo adds emerald and violet, Goku orange and blue, and Brick Breaker jewel colours against three distinct skies. Controls and hazards retain labels, shapes and static cues in reduced motion.

| Asset | Creation and use | Size/loading |
| --- | --- | --- |
| `assets/arcade-lookout.webp` | Generated cel-shaded floating-lookout environment, then resized and encoded with Sharp. Decorative arcade chooser banner. | 1200×600, 143,224 bytes; referenced only by optional arcade CSS. |
| `assets/arcade-icons.svg` | Original hand-authored five-panel vector sheet: Piccolo, Goku, bricks, ki and radar. Decorative; each card has a written game name. | 100×500 view box, 3,556 bytes; optional CSS sprite, no external references. |
| Piccolo art | Code-native pixel sprites compiled into horizontal runs, bright temple/pools, wardens, warning lines and linked-beam badge. | In the existing optional JS/CSS; no extra image request. |
| Goku art | Code-native character poses, regional skies, outlined target diamonds, dash/landing feedback and chain ribbon. | In the existing optional JS/CSS; no extra image request. |
| Brick Breaker art | Code-native Orbit/Nova/Zenith arenas, jewel shields, visible powered target bounds and charge pips. | In the existing optional JS/CSS; no extra image request. |
| Ki Control art | Code-native training stance, lookout floor, energy seal, beam and five release markers. | In the existing optional JS; no extra image request. |
| Radar Hunt art | Existing seven Dragon Ball images and Shenron reveal, with exact numeric clues and visited-square rings. | Existing images requested when discovered/revealed. |

The lookout was generated with the built-in image generation tool. Prompt: “Final wide illustration for a small Dragon Ball inspired browser arcade, no text or UI. Joyful cel-shaded landscape: ivory-and-gold floating martial-arts lookout, turquoise domed pavilion, emerald cliffs, cream clouds, distant blue mountain islands, brilliant cyan sky, warm orange edges. Small golden orange star-bearing orbs and curved blue ki streaks. Roughly 2:1 panorama, readable silhouettes, crisp navy outlines, simple confident shapes, restrained texture. Generous sky and depth. No characters, faces, logos, text, mockup, frames, buttons or watermark. Opaque.”

No new runtime service, font, analytics, dependency or mandatory sound was added. The generated master and before/after captures are review evidence, not public build files. All other imagery remains the existing project assets; no third-party sprite pack was imported.
