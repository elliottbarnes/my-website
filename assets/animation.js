/*
Display-only excerpts from Elliott Barnes / elliottbarnes projects.
MIT License

Copyright (c) 2026 elliottbarnes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Architecture Lab copyright (c) 2026 Elliott Barnes.
https://github.com/elliottbarnes/glassbox/blob/c7ae7bd3eb374580b0c28e0b554108b5504a1c00/docs/core.js#L237-L242
https://github.com/elliottbarnes/pixel-language/blob/bf7abf01bd02a9a3f40216a81f6a6b8809009ea2/docs/presets.js#L5-L15
https://github.com/elliottbarnes/architecture-lab/blob/db570f2adea137f8a362ee171ca4230f5f7b76fc/src/framebuffer.js#L33-L40
https://github.com/elliottbarnes/automata-lab/blob/5f6754580cfb0ffcf393d9e3d944ce1753cc1554/docs/engine.js#L122-L131
*/
const snippets = [{"repo": "glassbox", "title": "source → WebAssembly", "path": "docs/core.js", "language": "javascript", "commit": "c7ae7bd3eb374580b0c28e0b554108b5504a1c00", "sourceUrl": "https://github.com/elliottbarnes/glassbox/blob/c7ae7bd3eb374580b0c28e0b554108b5504a1c00/docs/core.js#L237-L242", "sourceLineStart": 237, "sourceLineEnd": 242, "license": "MIT", "licenseUrl": "https://github.com/elliottbarnes/glassbox/blob/c7ae7bd3eb374580b0c28e0b554108b5504a1c00/LICENSE", "licenseText": "MIT License\n\nCopyright (c) 2026 elliottbarnes\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n", "code": "export function compile(source, { optimized = true } = {}) {\n  const tokens = tokenize(source); const ast = parse(tokens); const ir = lower(ast); const optimization = optimize(ir);\n  const selectedIR = optimized ? optimization.ir : ir; const wasm = emitWasm(selectedIR);\n  if (!WebAssembly.validate(wasm)) throw new Error('Internal compiler error: emitted invalid WebAssembly.');\n  return { ast, ir, optimizedIr: optimization.ir, changes: optimization.changes, wasm, tokens: tokens.length - 1, resultType: ir.functions[ir.entry].result };\n}"}, {"repo": "pixel-language", "title": "interference.pixel", "path": "docs/presets.js", "language": "pixel-language", "commit": "bf7abf01bd02a9a3f40216a81f6a6b8809009ea2", "sourceUrl": "https://github.com/elliottbarnes/pixel-language/blob/bf7abf01bd02a9a3f40216a81f6a6b8809009ea2/docs/presets.js#L5-L15", "sourceLineStart": 5, "sourceLineEnd": 15, "license": "MIT", "licenseUrl": "https://github.com/elliottbarnes/pixel-language/blob/bf7abf01bd02a9a3f40216a81f6a6b8809009ea2/LICENSE", "licenseText": "MIT License\n\nCopyright (c) 2026 elliottbarnes\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n", "code": "// Interference · a field of phase-shifted waves\nlet p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1);\nlet t = time * 0.32;\nlet a = sin(p.x * 9 + t);\nlet b = cos(p.y * 11 - t * 1.3);\nlet c = sin(length(p) * 15 - t * 2);\nlet field = (a + b + c) / 3;\nlet phase = field * 2.4 + vec3(0, 1.8, 3.9);\nlet color = 0.5 + 0.5 * cos(phase);\nlet glow = pow(1 - abs(field), 3);\noutput color * (0.35 + 0.65 * glow);"}, {"repo": "architecture-lab", "title": "monochrome framebuffer", "path": "src/framebuffer.js", "language": "javascript", "commit": "db570f2adea137f8a362ee171ca4230f5f7b76fc", "sourceUrl": "https://github.com/elliottbarnes/architecture-lab/blob/db570f2adea137f8a362ee171ca4230f5f7b76fc/src/framebuffer.js#L33-L40", "sourceLineStart": 33, "sourceLineEnd": 40, "license": "MIT", "licenseUrl": "https://github.com/elliottbarnes/architecture-lab/blob/db570f2adea137f8a362ee171ca4230f5f7b76fc/LICENSE", "licenseText": "MIT License\n\nCopyright (c) 2026 Elliott Barnes\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n", "code": "export function byteLocation(x, y) {\n  requireInteger(x, 'x'); requireInteger(y, 'y');\n  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {\n    throw new RangeError(`Pixel coordinates must be inside ${WIDTH} × ${HEIGHT}.`);\n  }\n  const bit = 7 - (x & 7);\n  return { offset: y * ROW_BYTES + (x >> 3), bit, mask: 1 << bit };\n}"}, {"repo": "automata-lab", "title": "epsilon closure", "path": "docs/engine.js", "language": "javascript", "commit": "5f6754580cfb0ffcf393d9e3d944ce1753cc1554", "sourceUrl": "https://github.com/elliottbarnes/automata-lab/blob/5f6754580cfb0ffcf393d9e3d944ce1753cc1554/docs/engine.js#L122-L131", "sourceLineStart": 122, "sourceLineEnd": 131, "license": "MIT", "licenseUrl": "https://github.com/elliottbarnes/automata-lab/blob/5f6754580cfb0ffcf393d9e3d944ce1753cc1554/LICENSE", "licenseText": "MIT License\n\nCopyright (c) 2026 elliottbarnes\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n", "code": "function closure(nfa, initial, work) {\n  const seen = new Set(initial), queue = [...initial];\n  for (let i = 0; i < queue.length; i++) {\n    for (const edge of nfa.states[queue[i]].edges) {\n      work?.tick();\n      if (edge.chars === null && !seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); }\n    }\n  }\n  return [...seen].sort((a, b) => a - b);\n}"}];

(() => {
  "use strict";
  const canvas = document.querySelector("#code-field");
  const scene = document.querySelector("#scene");
  const entrance = document.querySelector("#entrance");
  if (!canvas || !scene) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const root = document.documentElement;
  const wall = document.querySelector("#code-wall");
  const fileLabel = document.querySelector("[data-scene-file]");
  const pathLabel = document.querySelector("[data-scene-path]");
  const readout = document.querySelector("[data-pointer-readout]");
  const command = document.querySelector("#typed-command");
  const modeLabel = document.querySelector("#entrance .mode");
  const positionLabel = document.querySelector("#entrance .status-position");
  const codeSurface = document.querySelector("#scene .scene-body") || canvas.parentElement;
  const sceneFeedback = document.querySelector("#scene-feedback");
  const projectLinks = document.querySelector(".scene-project-links");
  const projectSource = document.querySelector("[data-scene-source]");
  const projectDemo = document.querySelector("[data-scene-demo]");
  const projectTry = document.querySelector("[data-scene-try]");
  const ecdsaControls = document.querySelector("[data-ecdsa-controls]");
  const ecdsaButtons = Object.fromEntries(["back", "next", "play", "tamper", "close"].map(name => [name, document.querySelector(`[data-ecdsa-${name}]`)]));
  const ecdsaLabel = document.querySelector("[data-ecdsa-step]");
  const ecdsaStepLength = 3200;
  const ecdsaDescriptions = [
    "The toy curve is y squared = x cubed + 2x + 2 modulo 17. G = (5, 1), with order 19. These tiny public values are for learning only.",
    "The demo private key is d = 7. Repeated point addition gives the public key Q = 7G = (0, 6).",
    "The demo nonce is k = 3. R = 3G = (10, 6). Real signing requires a secret nonce that is never reused across different messages.",
    "Using the example message hash representative z = 11, r = 10 and s = inverse(3) times (11 + 10 times 7) modulo 19 = 8. The signature is (10, 8).",
    "Verification uses the public key and signature: w = inverse(8) = 12, u1 = 18 and u2 = 6. Compute u1G + u2Q.",
    "Verified: the reconstructed point is (10, 6). Its x coordinate modulo 19 equals r = 10.",
  ];
  let ecdsaAnnouncement = "";
  // Public commit snapshot; no browser API requests or fabricated history.
  const commitHistory = {"glassbox":[{"sha":"c7ae7bd3eb374580b0c28e0b554108b5504a1c00","parents":["5789eec04c64bea45b2f5b9bce3adc6387128d81"],"message":"docs: make the README a concise project entry point (#2)"},{"sha":"5789eec04c64bea45b2f5b9bce3adc6387128d81","parents":["6baf3aacc2b86458bd42dfb4d3f511721005bcef"],"message":"docs: expand project guide and protect local files (#1)"},{"sha":"6baf3aacc2b86458bd42dfb4d3f511721005bcef","parents":[],"message":"Build an inspectable typed compiler with a WebAssembly backend"}],"pixel-language":[{"sha":"bf7abf01bd02a9a3f40216a81f6a6b8809009ea2","parents":["cd06ed6f5e2d42fb484af4d330905266417d9098"],"message":"docs: make the README a concise project entry point (#2)"},{"sha":"cd06ed6f5e2d42fb484af4d330905266417d9098","parents":["fe0af8647aedf8d711789868bf717e4663081889"],"message":"docs: expand project guide and protect local files (#1)"},{"sha":"fe0af8647aedf8d711789868bf717e4663081889","parents":["62ab5f3b97880c16763dc0e78163a8d536542735"],"message":"Use the repository owner handle for copyright attribution"},{"sha":"62ab5f3b97880c16763dc0e78163a8d536542735","parents":[],"message":"Build a typed graphics language and live WebGL compiler playground"}],"architecture-lab":[{"sha":"c452bb8ff75c68809035e3efa569e49473932cb2","parents":["19e468a1cb4fe2eee032afc94079da63a6dc9d52"],"message":"Version published assets to prevent stale mixed releases"},{"sha":"19e468a1cb4fe2eee032afc94079da63a6dc9d52","parents":["db570f2adea137f8a362ee171ca4230f5f7b76fc"],"message":"Explore three generations of Macintosh hardware in interactive 3D"},{"sha":"db570f2adea137f8a362ee171ca4230f5f7b76fc","parents":["81349c74afb61f8444e664c154ab56a882d27b7c"],"message":"Refine Macintosh lab with rainbow styling and integrated experiments"},{"sha":"81349c74afb61f8444e664c154ab56a882d27b7c","parents":[],"message":"Build an interactive Macintosh 128K architecture exhibit"}],"automata-lab":[{"sha":"5f6754580cfb0ffcf393d9e3d944ce1753cc1554","parents":["e0faf5ceae6eeb2c8a0cb00b51496976dad9655d"],"message":"Document regex resource limits with a bounded research harness (#2)"},{"sha":"e0faf5ceae6eeb2c8a0cb00b51496976dad9655d","parents":["4747efde9b7da4a791ea51809697a5bcbe2cdf96"],"message":"docs: expand project guide and protect local files (#1)"},{"sha":"4747efde9b7da4a791ea51809697a5bcbe2cdf96","parents":["ccd219aeaba07d3c214fcf216f623fb9d2a577af"],"message":"Link the lab back to the portfolio"},{"sha":"ccd219aeaba07d3c214fcf216f623fb9d2a577af","parents":[],"message":"Build an inspectable regex compiler and automata playground"}]};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const inputHud = document.createElement("canvas");
  inputHud.setAttribute("aria-hidden", "true");
  inputHud.className = "input-hud";
  inputHud.hidden = true;
  Object.assign(inputHud.style, { position: "absolute", top: "calc(100% + 18px)", left: "50%",
    transform: "translateX(-50%)", width: "310px", height: "140px", pointerEvents: "none" });
  const hudContext = inputHud.getContext("2d", { alpha: true });
  if (hudContext) scene.append(inputHud);
  const words = new Set("export function const let return if else for of in new throw true false null undefined class async await output".split(" "));
  // Keep the opening source preview aligned with the featured project link.
  const featuredRepo = document.querySelector("[data-enter]")?.getAttribute("href")?.slice(1);
  const featuredIndex = snippets.findIndex(snippet => snippet.repo === featuredRepo);
  if (featuredIndex > 0) snippets.unshift(...snippets.splice(featuredIndex, 1));
  const glyphs = snippets.map(snippet => snippet.code.replace(/\s+/g, " ")).join(" ");
  const cycleLength = 4800;
  const entryDuration = 420;
  const rowCache = new Map();
  const tokenCache = new Map();
  let width = 0, height = 0, ratio = 1, fontSize = 12, cell = 7.2, lineHeight = 17;
  let frame = 0, lastFrame = 0, elapsed = 0, sourceImage = null, portrait = [];
  let lastInput = -Infinity, pointerRect = null;
  let gesture = null, interaction = null, resumedSnippet = null, resumeUntil = 0;
  let releaseAt = Infinity;
  let sourceRows = [], renderedSnippet = snippets[0], displayedGraphic = null, sourceDimming = null;
  const sourceLineRows = new Map();
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0, lastReadout = 0;
  let palette = {}, leaving = null, entryPromise = null, finishEntry = null, entryTimer = 0, entryLayout = null;
  let currentFile = "", currentMode = "", currentCommand = "", currentPosition = "";
  let selectedSource = "", keyboardFocus = false;
  let heldSnippet = null, projectHovered = false;
  const clamp = (number, low = 0, high = 1) => Math.max(low, Math.min(high, number));
  const ease = number => { const t = clamp(number); return t * t * (3 - 2 * t); };
  const visible = () => !document.hidden && root.dataset.view !== "workspace";
  const still = () => root.dataset.motion === "paused" || (root.dataset.motion !== "running" && motion.matches);
  const running = () => visible() && root.dataset.training !== "open" && (!still() || Boolean(leaving));
  let quietPreviously = still(), frozenTime = null;

  function announceScene(message) {
    if (sceneFeedback && sceneFeedback.textContent !== message) sceneFeedback.textContent = message;
  }

  const sourceKey = row => `${row.line}:${row.column}`;
  const selectedRow = () => sourceRows.find(row => sourceKey(row) === selectedSource) || sourceRows[0];
  const holdDuration = type => type === "touch" || type === "pen" ? 6000 : 9000;

  function colors() {
    const style = getComputedStyle(root);
    const get = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    const ink = get("--ink", "#cbcbb6");
    const accent = get("--accent", ink);
    const highlight = get("--highlight", ink);
    palette = {
      ink, accent, highlight, paper: get("--paper", "#0c0c0c"),
      muted: get("--muted", ink), faint: get("--faint", ink),
      keyword: get("--syntax-keyword", highlight), string: get("--syntax-string", accent),
      number: get("--syntax-number", ink),
    };
  }

  function setLabel(node, value, oldValue) {
    if (node && value !== oldValue) node.textContent = value;
    return value;
  }

  function status(snippet, mode, text, row = 1, column = 1) {
    const path = snippet ? `${snippet.repo}/${snippet.path}` : "~/Projects";
    if (path !== currentFile) {
      if (fileLabel) fileLabel.textContent = path;
      if (pathLabel) pathLabel.textContent = snippet ? `~/Projects/${path}` : "~/Projects";
      currentFile = path;
      const project = snippet && document.getElementById(snippet.repo);
      const demo = project?.querySelector("[data-demo]");
      if (projectSource && snippet) {
        projectSource.setAttribute("href", snippet.sourceUrl);
        projectSource.setAttribute("aria-label", `Read ${path} on GitHub`);
      }
      if (projectDemo && demo) {
        projectDemo.setAttribute("href", demo.getAttribute("href"));
        projectDemo.setAttribute("aria-label", demo.getAttribute("aria-label"));
        projectDemo.textContent = demo.textContent;
      }
      if (projectTry) {
        projectTry.hidden = !project?.dataset.experiment;
        if (project?.dataset.experiment) {
          projectTry.textContent = `try ${project.dataset.experimentLabel}`;
          projectTry.setAttribute("aria-label", `Try ${project.dataset.experimentLabel} from ${snippet.repo} source`);
        }
      }
    }
    currentMode = setLabel(modeLabel, mode, currentMode);
    currentCommand = setLabel(command, text, currentCommand);
    currentPosition = setLabel(positionLabel, `${row}:${column}  All`, currentPosition);
  }

  function buildPortrait() {
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 120;
    sampleCanvas.height = 120;
    const sample = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sample) return;
    if (sourceImage) {
      // Preserve the transparent Memoji's whole silhouette, including hair and chin.
      const scale = 116 / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight);
      const w = sourceImage.naturalWidth * scale, h = sourceImage.naturalHeight * scale;
      sample.drawImage(sourceImage, (120 - w) / 2, (120 - h) / 2, w, h);
    } else {
      sample.fillStyle = "white";
      sample.font = '78px "Plex Mono", monospace';
      sample.textAlign = "center";
      sample.fillText("eb", 60, 88);
    }
    let pixels;
    try { pixels = sample.getImageData(0, 0, 120, 120).data; } catch { return; }
    const corners = [0, 119 * 4, 119 * 120 * 4, (120 * 120 - 1) * 4];
    const backdrop = corners.reduce((total, index) => total + (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3, 0) / 4;
    portrait = [];
    const step = width < 600 ? 3 : 2;
    for (let y = 1; y < 119; y += step) for (let x = 1; x < 119; x += step) {
      const i = (y * 120 + x) * 4;
      if (pixels[i + 3] < 30) continue;
      const luminance = (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
      const contrast = Math.abs(luminance - backdrop / 255);
      const intensity = backdrop > 140 ? 1 - luminance : luminance;
      if (intensity < .045 && contrast < .065) continue;
      const edge = pixels[i + 3] / 255;
      portrait.push({ x: (x - 60) / 120, y: (y - 60) / 120, z: (luminance - .5) * .13,
        brightness: Math.max(.10, intensity) * edge, phase: x * .7 + y * .3,
        order: (x * 73 + y * 131) % 997 });
    }
    // Spread the first carried letters over the whole silhouette, rather than
    // filling its top rows before the rest of the face appears.
    portrait.sort((a, b) => a.order - b.order);
  }

  // Display data only: the excerpt text is never evaluated or executed.
  function rowsFor(snippet) {
    const columns = Math.max(20, Math.floor((width - 46) / cell));
    const cached = rowCache.get(snippet);
    if (cached?.columns === columns) return cached.rows;
    const rows = [];
    for (const [index, text] of snippet.code.split("\n").entries()) {
      if (!text.length) rows.push({ text: "", line: snippet.sourceLineStart + index, continuation: false, column: 0 });
      else for (let start = 0; start < text.length; start += columns) {
        rows.push({ text: text.slice(start, start + columns), line: snippet.sourceLineStart + index, continuation: start > 0, column: start });
      }
    }
    rowCache.set(snippet, { columns, rows });
    return rows;
  }

  function syntaxLine(text, x, y, alpha, amount = text.length, sourceLine = 0, sourceColumn = 0) {
    let tokens = tokenCache.get(text);
    if (!tokens) {
      tokens = text.match(/\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[^\w$]+/g) || [];
      tokenCache.set(text, tokens);
    }
    context.globalAlpha = alpha;
    let consumed = 0;
    for (const token of tokens) {
      if (amount <= 0) break;
      const comment = token.startsWith("//");
      context.fillStyle = comment ? palette.muted : words.has(token) ? palette.keyword
        : /^["'`]/.test(token) ? palette.string : /^\d/.test(token) ? palette.number : palette.ink;
      if (comment) context.globalAlpha = alpha * .58;
      const shownToken = token.slice(0, amount);
      if (interaction?.glyphKeys) {
        const tokenAlpha = context.globalAlpha;
        for (let i = 0; i < shownToken.length; i++) {
          const carried = interaction.glyphKeys.has(`${sourceLine}:${sourceColumn + consumed + i}`);
          const px = x + i * cell;
          const edge = sourceDimming ? Math.min(px - sourceDimming.left, sourceDimming.right - px,
            y - sourceDimming.top, sourceDimming.bottom - y) : -100;
          const separation = 1 - .90 * ease((edge + 16) / 32) * clamp(interaction.amount);
          context.globalAlpha = tokenAlpha * separation * (carried ? 1 - clamp(interaction.amount) : 1);
          context.fillText(shownToken[i], x + i * cell, y);
        }
      } else context.fillText(shownToken, x, y);
      consumed += token.length;
      x += token.length * cell;
      amount -= token.length;
    }
    context.globalAlpha = 1;
  }

  function editor(snippet, progress, alpha = 1, time = 0, active = true, editing = true) {
    sourceRows = [];
    sourceLineRows.clear();
    renderedSnippet = snippet;
    const rows = rowsFor(snippet);
    const capacity = Math.max(3, Math.floor((height - 24) / lineHeight));
    const total = rows.reduce((sum, row) => sum + row.text.length + 1, 0);
    const seed = Math.min(total, (rows[0]?.text.length || 0) + (rows[1]?.text.length || 0) + 2);
    const shown = Math.round(seed + (total - seed) * clamp(progress));
    let count = 0, cursorRow = rows.length - 1, cursorColumn = rows[cursorRow]?.text.length || 0;
    for (let i = 0; i < rows.length; i++) {
      if (count + rows[i].text.length + 1 > shown) { cursorRow = i; cursorColumn = Math.max(0, shown - count); break; }
      count += rows[i].text.length + 1;
    }
    if (!editing) {
      cursorRow = Math.min(rows.length - 1, Math.floor(time / 1100) % Math.max(1, rows.length));
      cursorColumn = Math.min(rows[cursorRow].text.length, Math.floor(time / 230) % 15);
    }
    const scroll = Math.max(0, cursorRow - capacity + 3);
    const gutter = 37;
    context.font = `${fontSize}px "Plex Mono", monospace`;
    context.textBaseline = "top";
    context.textAlign = "left";
    if (active) {
      context.globalAlpha = alpha * .045;
      context.fillStyle = palette.ink;
      context.fillRect(0, 10 + (cursorRow - scroll) * lineHeight - 1, width, lineHeight);
    }
    let offset = 0;
    rows.forEach((row, index) => {
      const y = 10 + (index - scroll) * lineHeight;
      const amount = editing ? clamp(shown - offset, 0, row.text.length) : row.text.length;
      offset += row.text.length + 1;
      if (y < 0 || y > height - lineHeight || (editing && index > cursorRow)) return;
      if (amount > 0 && row.text.trim()) {
        const source = { text: row.text.slice(0, amount), line: row.line, column: row.column, x: gutter, y,
          right: Math.min(width, gutter + amount * cell), bottom: y + lineHeight };
        sourceRows.push(source);
        if (!sourceLineRows.has(row.line)) sourceLineRows.set(row.line, []);
        sourceLineRows.get(row.line).push(source);
      }
      if (keyboardFocus && !interaction && sourceKey(row) === selectedSource) {
        context.globalAlpha = alpha * .14;
        context.fillStyle = palette.accent;
        context.fillRect(0, y - 1, width, lineHeight);
      }
      context.globalAlpha = alpha * .37;
      context.fillStyle = palette.muted;
      context.fillText(row.continuation ? "  ·" : String(row.line).padStart(3, " "), 3, y);
      syntaxLine(row.text, gutter, y, alpha * .88, amount, row.line, row.column);
    });
    if (active && ((still() && frozenTime === null) || Math.floor(time / 560) % 2 === 0)) {
      const x = gutter + cursorColumn * cell;
      const y = 10 + (cursorRow - scroll) * lineHeight;
      context.globalAlpha = alpha * .76;
      context.fillStyle = palette.accent;
      context.fillRect(x, y, editing ? 1.4 : cell, fontSize + 2);
    }
    context.globalAlpha = 1;
    if (keyboardFocus && sourceRows.length && !sourceRows.some(row => sourceKey(row) === selectedSource)) selectedSource = sourceKey(sourceRows[0]);
    scene.dataset.selectedLine = keyboardFocus ? String(selectedRow()?.line || "") : "";
    return { row: rows[cursorRow].line, column: cursorColumn + 1 };
  }


  function transportedGlyphs() {
    return (interaction?.glyphs || []).map(point => {
      const row = sourceLineRows.get(point.line)?.find(row => point.column >= row.column && point.column < row.column + row.text.length);
      return row ? { ...point, x: row.x + (point.column - row.column) * cell, y: row.y + fontSize / 2 } : point;
    });
  }

  function carryGlyph(points, index, destination, amount, color, brightness, size, replacement) {
    if (!points.length) return;
    const point = points[index % points.length];
    const primary = index < points.length;
    const lag = (index % 11) * .012;
    const progress = ease((amount - lag) / (1 - lag));
    const extra = primary ? 1 : ease((amount - .32) / .68);
    const bend = Math.sin(progress * Math.PI) * (6 + index % 7 * 2);
    const x = point.x + (destination.x - point.x) * progress;
    const y = point.y + (destination.y - point.y) * progress - bend;
    const glyphSize = point.size + (size - point.size) * progress;
    const blend = replacement ? ease((progress - .30) / .40) : 0;
    context.font = `${glyphSize}px "Plex Mono", monospace`;
    context.fillStyle = color;
    context.globalAlpha = clamp(amount * extra * (1 + (brightness - 1) * progress));
    if (blend < .995) {
      context.globalAlpha *= 1 - blend;
      context.fillText(point.glyph, x, y);
    }
    if (blend > .005) {
      context.globalAlpha = clamp(amount * extra * brightness * blend);
      context.fillText(replacement, x, y);
    }
  }


  function avatar(amount, time) {
    const size = Math.min(width * .82, height * .87, 300) * (.55 + .45 * ease(amount));
    const quiet = interaction?.static;
    const t = quiet ? 0 : time / 1000;
    const yaw = quiet ? 0 : pointerX * .31 + Math.sin(t * .25) * .035;
    const pitch = quiet ? 0 : pointerY * .20;
    const cosine = Math.cos(yaw), sine = Math.sin(yaw);
    const cx = width * .5 + (interaction?.pull?.x || 0), cy = height * .49 + (interaction?.pull?.y || 0);
    displayedGraphic = { kind: "avatar", snippet: renderedSnippet, amount,
      bounds: { left: cx - size / 2, right: cx + size / 2, top: cy - size / 2, bottom: cy + size / 2 } };
    const points = transportedGlyphs();
    const glyphSize = Math.max(3.5, size / (width < 600 ? 40 : 54));
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = palette.ink;
    for (const [index, point] of portrait.entries()) {
      const x = (point.x * cosine + point.z * sine) * size;
      const y = (point.y - point.z * pitch) * size;
      carryGlyph(points, index, { x: cx + x - glyphSize * .3, y: cy + y + Math.sin(t * .8 + point.phase) * .22 },
        amount, point.y < -.12 ? palette.accent : palette.ink, .09 + point.brightness * 1.02, glyphSize);
    }
    context.globalAlpha = 1;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = `9px "Plex Mono", monospace`;
    context.fillStyle = palette.muted;
    context.globalAlpha = amount * .8;
    context.fillText("// elliott typing…", Math.max(12, cx - size * .46), Math.min(height - 18, cy + size * .53));
    context.globalAlpha = 1;
  }

  // A small monochrome window stored as real packed bytes, like framebuffer.js.
  const framebuffer = Array.from({ length: 80 }, (_, address) => {
    const row = Math.floor(address / 4), column = address % 4;
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      const x = column * 8 + bit, y = row;
      const border = x >= 2 && x <= 29 && y >= 2 && y <= 17 && (x === 2 || x === 29 || y === 2 || y === 17 || y === 5);
      const title = y === 3 && x >= 6 && x <= 26 && x % 2 === 0;
      const icon = x >= 6 && x <= 12 && y >= 8 && y <= 13 && (x === 6 || x === 12 || y === 8 || y === 13);
      const lines = x >= 16 && x <= 25 && [9, 12, 14].includes(y) && (y !== 14 || x < 22);
      if (border || title || icon || lines) byte |= 1 << (7 - bit);
    }
    return byte;
  });

  function liveObject(snippet, amount, time, anchor = null) {
    const quiet = interaction?.static;
    const clock = quiet ? 3200 : Math.max(0, time - (interaction?.visualStarted || 0)) % 6200;
    const address = Math.min(79, Math.floor(clock / 60)), complete = clock >= 4800;
    const row = Math.floor(address / 4), column = address % 4, byte = framebuffer[address];
    const w = Math.min(540, width - 24), h = Math.min(320, height - 30);
    const cx = clamp(width * (anchor?.x ?? .5) + (interaction?.pull?.x || 0), w / 2 + 12, width - w / 2 - 12);
    const cy = clamp(height * (anchor?.y ?? .5) + (interaction?.pull?.y || 0), h / 2 + 15, height - h / 2 - 15);
    const left = cx - w / 2, top = cy - h / 2;
    displayedGraphic = { kind: "object", snippet, amount, anchor,
      bounds: { left, right: left + w, top, bottom: top + h } };
    const points = transportedGlyphs();
    let glyph = 0;
    const label = (value, x, y, color = palette.muted, size = 10) => {
      for (const character of value) {
        if (character !== " ") carryGlyph(points, glyph++, { x: left + x, y: top + y }, amount, color, 1, size, character);
        x += size * .6;
      }
    };
    const geometry = ease((amount - .25) / .75);
    const line = (coordinates, color, alpha = 1, stroke = 1) => {
      context.beginPath(); context.strokeStyle = color; context.globalAlpha = geometry * alpha; context.lineWidth = stroke;
      coordinates.forEach(([x, y], index) => context[index ? "lineTo" : "moveTo"](left + x, top + y)); context.stroke();
    };
    const fill = (x, y, width, height, color, alpha) => {
      context.fillStyle = color; context.globalAlpha = geometry * alpha; context.fillRect(left + x, top + y, width, height);
    };
    context.save(); context.textAlign = "left"; context.textBaseline = "middle";
    label("framebuffer / from byte to pixel", 4, 15, palette.accent, 11);
    label("READ MEMORY  →  DECODE  →  SCANOUT", 4, 35, palette.muted, 9);
    const pixel = Math.min((w - 112) / 32, (h - 166) / 20), screenX = w - pixel * 32 - 5, screenY = 64;
    const screenW = pixel * 32, screenH = pixel * 20;
    fill(screenX - 5, screenY - 5, screenW + 10, screenH + 10, palette.paper, .96);
    line([[screenX - 5, screenY - 5], [screenX + screenW + 5, screenY - 5], [screenX + screenW + 5, screenY + screenH + 5], [screenX - 5, screenY + screenH + 5], [screenX - 5, screenY - 5]], palette.muted, .5);
    label("32 × 20 / 1 bit", screenX, screenY - 17, palette.muted, 9);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 32; x++) {
      const offset = y * 4 + (x >> 3), value = (framebuffer[offset] >> (7 - (x & 7))) & 1;
      const scanned = complete || quiet || offset <= address;
      fill(screenX + x * pixel, screenY + y * pixel, Math.max(1, pixel - .7), Math.max(1, pixel - .7),
        offset === address && !complete ? palette.highlight : palette.accent, value ? (scanned ? .88 : .12) : .035);
    }
    if (!complete) {
      fill(screenX, screenY + row * pixel, screenW, pixel, palette.accent, .10);
      const bx = screenX + column * 8 * pixel, by = screenY + row * pixel;
      line([[bx, by], [bx + 8 * pixel, by], [bx + 8 * pixel, by + pixel], [bx, by + pixel], [bx, by]], palette.highlight, .95, 1.5);
    }
    const memoryY = 72, memoryStep = 24, start = Math.max(0, Math.min(75, address - 2));
    label("ADDRESS / BYTE", 4, 49, palette.muted, 9);
    for (let index = 0; index < 5; index++) {
      const offset = start + index, selected = offset === address;
      fill(2, memoryY + index * memoryStep - 11, 83, 22, selected ? palette.accent : palette.muted, selected ? .17 : .045);
      label(offset.toString(16).padStart(4, "0").toUpperCase(), 7, memoryY + index * memoryStep, selected ? palette.highlight : palette.muted, 10);
      label(framebuffer[offset].toString(16).padStart(2, "0").toUpperCase(), 58, memoryY + index * memoryStep, selected ? palette.ink : palette.accent, 11);
    }
    const busY = memoryY + (address - start) * memoryStep, targetY = screenY + (row + .5) * pixel;
    line([[86, busY], [screenX - 13, busY], [screenX - 13, targetY], [screenX - 6, targetY]], palette.accent, .7, 1.5);
    const bitsY = Math.max(screenY + screenH + 27, 214), bitWidth = (w - 16) / 8;
    label("BYTE " + byte.toString(16).padStart(2, "0").toUpperCase() + "  /  MOST SIGNIFICANT BIT FIRST", 4, bitsY - 19, palette.muted, 9);
    for (let bit = 0; bit < 8; bit++) {
      const value = (byte >> (7 - bit)) & 1, x = 4 + bit * bitWidth;
      fill(x, bitsY - 8, bitWidth - 4, 27, value ? palette.accent : palette.muted, value ? .24 : .07);
      label(String(value), x + bitWidth / 2 - 6, bitsY + 5, value ? palette.highlight : palette.muted, 15);
      label(String(7 - bit), x + bitWidth / 2 - 4, bitsY + 31, palette.muted, 9);
    }
    label(complete ? "frame complete / 80 bytes → 640 pixels" : `byte ${String(address + 1).padStart(2, "0")}/80  ·  row ${String(row).padStart(2, "0")}  ·  x ${column * 8}–${column * 8 + 7}`,
      4, h - 14, palette.accent, w < 340 ? 9 : 10);
    context.restore(); context.globalAlpha = 1;
  }

  function drawInputHud(time) {
    if (!hudContext) return;
    const phase = scene.dataset.phase;
    const allowed = visible() && (!still() || frozenTime !== null) && !entryLayout && !leaving && !interaction
      && window.innerHeight >= (window.innerWidth < 600 ? 700 : 680) && phase !== "boot";
    inputHud.hidden = !allowed;
    if (!allowed) return;
    const narrow = window.innerWidth < 600;
    inputHud.style.width = narrow ? "230px" : "310px";
    const scale = Math.min(window.devicePixelRatio || 1, 3);
    if (inputHud.width !== Math.round(310 * scale)) {
      inputHud.width = Math.round(310 * scale);
      inputHud.height = Math.round(140 * scale);
      hudContext.setTransform(scale, 0, 0, scale, 0, 0);
    }
    const opacity = phase === "avatar" ? .73 : phase === "editing" ? .38 : .30;
    const typing = (phase === "editing" || (phase === "still" && frozenTime !== null)) && currentMode === "INSERT";
    const activeKey = typing ? glyphs[Math.floor(time / 115) % glyphs.length].toLowerCase() : "";
    hudContext.clearRect(0, 0, 310, 140);
    hudContext.font = '7px "Plex Mono", monospace';
    hudContext.textAlign = "center";
    hudContext.textBaseline = "middle";
    const keyboard = ["1234567890-=", "qwertyuiop[]", "asdfghjkl;", "zxcvbnm,./"];
    keyboard.forEach((row, rowIndex) => {
      const spacing = 17, left = (310 - row.length * spacing) / 2 + rowIndex * 2;
      for (let index = 0; index < row.length; index++) {
        const x = left + index * spacing, y = 5 + rowIndex * 10;
        const selected = row[index] === activeKey;
        hudContext.globalAlpha = opacity * (selected ? .95 : .22);
        hudContext.fillStyle = selected ? palette.accent : palette.muted;
        if (selected) {
          hudContext.globalAlpha = opacity * .14;
          hudContext.fillRect(x - 5, y - 5, 10, 10);
          hudContext.globalAlpha = opacity;
        }
        hudContext.fillText(row[index], x, y);
      }
    });
    // These are decorative local-input diagrams, not camera or hand tracking.
    function inputMesh(center, mirror, value, label) {
      const top = 54, t = time / 1000;
      const tilt = pointerX * 4 * mirror, lift = pointerY * 3;
      const wrist = [center + tilt, top + 70];
      const knuckles = [];
      hudContext.strokeStyle = palette.muted;
      hudContext.lineWidth = .55;
      hudContext.globalAlpha = opacity * .18;
      hudContext.strokeRect(center - 39, top - 2, 78, 78);
      hudContext.beginPath();
      for (let finger = 0; finger < 5; finger++) {
        const dx = (finger - 2) * 13 * mirror;
        const flex = typing ? Math.max(0, Math.sin(t * 5 + finger * 1.7)) * 5 : Math.sin(t * .7 + finger) * .5;
        const knuckle = [center + dx * .70 + tilt, top + 40 + Math.abs(finger - 2) * 1.5];
        const joint = [center + dx * .87 + tilt, top + 20 + Math.abs(finger - 2) * 3 + flex + lift];
        const tip = [center + dx + tilt * .7, top + 3 + Math.abs(finger - 2) * 4 + flex * 1.5 + lift];
        knuckles.push(knuckle);
        hudContext.moveTo(wrist[0], wrist[1]);
        hudContext.lineTo(knuckle[0], knuckle[1]);
        hudContext.lineTo(joint[0], joint[1]);
        hudContext.lineTo(tip[0], tip[1]);
        for (const point of [tip, joint, knuckle]) {
          hudContext.fillStyle = palette.ink;
          hudContext.globalAlpha = opacity * .74;
          hudContext.fillRect(point[0] - .65, point[1] - .65, 1.3, 1.3);
        }
      }
      hudContext.moveTo(knuckles[0][0], knuckles[0][1]);
      for (const point of knuckles.slice(1)) hudContext.lineTo(point[0], point[1]);
      hudContext.globalAlpha = opacity * .45;
      hudContext.stroke();
      hudContext.font = '5.5px "Plex Mono", monospace';
      hudContext.textAlign = "center";
      hudContext.fillStyle = palette.muted;
      hudContext.globalAlpha = opacity * .68;
      hudContext.fillText(`${label} ${(value + .5).toFixed(3)}`, center, top - 8);
    }
    inputMesh(100, 1, pointerX, "input.x");
    inputMesh(211, -1, pointerY, "input.y");
    hudContext.globalAlpha = 1;
  }

  function sourceHit(x, y) {
    const row = sourceRows.find(row => x >= 3 && x <= row.right + 12 && y >= row.y && y < row.bottom);
    if (!row) return null;
    const column = Math.floor((x - row.x) / cell);
    const token = [...row.text.matchAll(/[A-Za-z_$][\w$]*/g)].find(match => column >= match.index && column < match.index + match[0].length)?.[0];
    return { ...row, gutter: x < row.x - 4, token };
  }

  function makeAnchor(row) {
    const halfWidth = Math.min(width - 30, 578) / 2;
    const halfHeight = Math.min(height - 60, 231) / 2;
    return { x: clamp(row.x + halfWidth, halfWidth + 12, width - halfWidth - 12) / width,
      y: clamp(row.y, halfHeight + 12, height - halfHeight - 26) / height,
      sourceX: row.x / width, sourceY: row.y / height, text: row.text || "code" };
  }

  function sourceGlyphs(row, limit = 180) {
    const sorted = [...sourceRows].sort((a, b) => Math.abs(a.y - row.y) - Math.abs(b.y - row.y));
    const points = [];
    for (const source of sorted) for (let i = 0; i < source.text.length; i++) {
      if (!source.text[i].trim()) continue;
      points.push({ key: `${source.line}:${source.column + i}`, glyph: source.text[i], x: source.x + i * cell, y: source.y + fontSize / 2, size: fontSize, line: source.line, column: source.column + i });
      if (points.length >= limit) return points;
    }
    return points;
  }

  // Interleave different silhouettes. Recent choices are shared across source
  // changes, so a new project cannot immediately recycle the same experiment.
  const effectDecks = {
    glassbox: ["tokens", "fourier", "graph", "quadtree", "interference", "pathfinding", "ecdsa", "convolution", "sort", "phyllotaxis", "automaton", "attractor"],
    "pixel-language": ["interference", "convolution", "phyllotaxis", "fourier", "quadtree", "attractor", "tokens", "pathfinding", "sort", "ecdsa", "automaton", "graph"],
    "architecture-lab": ["object", "quadtree", "convolution", "graph", "fourier", "pathfinding", "sort", "attractor", "automaton", "ecdsa", "phyllotaxis", "interference"],
    "automata-lab": ["graph", "pathfinding", "automaton", "quadtree", "attractor", "tokens", "fourier", "convolution", "phyllotaxis", "ecdsa", "sort", "interference"],
  };
  const effectNames = {
    history: "git history", tokens: "compile sketch", avatar: "source portrait", object: "framebuffer scan",
    interference: "interference field", sort: "bubble sort", automaton: "rule 110 cellular automaton",
    graph: "breadth-first search", ecdsa: "ECDSA signing and verification", fourier: "Fourier synthesis",
    attractor: "Lorenz attractor", phyllotaxis: "golden-angle spiral", pathfinding: "shortest-path search",
    quadtree: "quadtree spatial subdivision", convolution: "image convolution",
  };
  const renderedEffects = new Set(["history", "tokens", "sort", "automaton", "graph", "interference", "ecdsa",
    "fourier", "attractor", "phyllotaxis", "pathfinding", "quadtree", "convolution"]);
  // A reduced-motion discovery is a useful frozen illustration, not an empty
  // first frame. Pausing a running effect still preserves its exact live frame.
  const previewTimes = { tokens: 1500, sort: 5000, graph: 2400, automaton: 3200,
    interference: 1200, fourier: 1600, attractor: 3000, phyllotaxis: 3500,
    pathfinding: 5000, quadtree: 3200, convolution: 5000 };
  const effectVisits = new Map(), recentEffects = [];
  let discoveries = 0;
  function nextSourceEffect(repo) {
    discoveries++;
    // Keep the portrait as an occasional surprise, four times rarer than before.
    if (discoveries % 36 === 0) return "avatar";
    const deck = effectDecks[repo] || effectDecks.glassbox;
    let visit = effectVisits.get(repo) || 0, kind;
    for (let attempt = 0; attempt < deck.length; attempt++) {
      kind = deck[visit++ % deck.length];
      if (!recentEffects.includes(kind)) break;
    }
    effectVisits.set(repo, visit);
    recentEffects.push(kind);
    if (recentEffects.length > 6) recentEffects.shift();
    return kind;
  }

  function openGraphic(row, pointerType, requestedKind) {
    if (!row || !visible() || leaving || document.querySelector("dialog[open]")) return;
    const staticEffect = still();
    const now = performance.now();
    const kind = requestedKind || (row.gutter ? "history" : nextSourceEffect(renderedSnippet.repo));
    const next = { kind, snippet: renderedSnippet, anchor: makeAnchor(row), visualStarted: elapsed,
      amount: staticEffect ? 1 : 0, velocity: 0, target: 1, static: staticEffect,
      pointerType, pull: { x: 0, y: 0 }, pullTarget: { x: 0, y: 0 },
      expires: staticEffect || kind === "ecdsa" ? Infinity : now + holdDuration(pointerType),
      ecdsa: kind === "ecdsa" ? { position: 0, playing: !staticEffect, tampered: false } : null };
    next.glyphs = sourceGlyphs(row, ["history", "tokens"].includes(kind) ? 180 : 720);
    next.glyphKeys = new Set(next.glyphs.map(point => point.key));
    if (staticEffect) interaction = next;
    else if (interaction && interaction.kind === next.kind && interaction.snippet === next.snippet) {
      // Retarget an existing spring rather than snapping a repeated tap back to zero.
      interaction.destination = next.anchor;
      interaction.target = 1;
      interaction.expires = next.expires;
      interaction.next = null;
      interaction.visualStarted = next.visualStarted;
      interaction.glyphs = next.glyphs;
      interaction.glyphKeys = next.glyphKeys;
      interaction.ecdsa = next.ecdsa;
    } else if (displayedGraphic && displayedGraphic.amount > .02) {
      interaction = { ...displayedGraphic, velocity: 0, target: 0, next };
    } else interaction = next;

    lastInput = now;
    announceScene(`${effectNames[kind]} from source characters. ${kind === "history" ? "left and right select commits. " : ""}escape returns to code.`);
    // Measure the expanded scene before the first frame, including on short phones.
    scene.dataset.effect = kind;
    resize();
    schedule();
  }

  function closeGraphic() {
    if (!interaction && displayedGraphic) interaction = { ...displayedGraphic, velocity: 0 };
    if (interaction) {
      interaction.target = 0; interaction.next = null;
      syncECDSA();
      if (interaction.static || still()) {
        resumedSnippet = interaction.snippet;
        resumeUntil = elapsed + cycleLength - elapsed % cycleLength;
        interaction = null;
        drawScene(elapsed);
      }
      announceScene("returned to source code.");
    }
  }

  function updateInteraction(now, delta) {
    if (!interaction) return;
    if (interaction.static) return;
    if (interaction.ecdsa?.playing && interaction.target) {
      interaction.ecdsa.position = Math.min(ecdsaStepLength * 6 - 1, interaction.ecdsa.position + Math.min(delta || 0, 80));
      if (interaction.ecdsa.position >= ecdsaStepLength * 6 - 1) interaction.ecdsa.playing = false;
    }
    if (now >= interaction.expires) { interaction.target = 0; }
    const dt = Math.min(delta || 16.67, 48) / 1000;
    if (interaction.pull) {
      const follow = 1 - Math.exp(-dt / .07);
      for (const axis of ["x", "y"]) interaction.pull[axis] += ((interaction.pullTarget?.[axis] || 0) - interaction.pull[axis]) * follow;
    }
    const frequency = interaction.target ? (["history", "tokens"].includes(interaction.kind) ? 9 : 14) : 20;
    const offset = interaction.amount - interaction.target;
    const impulse = (interaction.velocity + frequency * offset) * dt;
    const decay = Math.exp(-frequency * dt);
    interaction.amount = interaction.target + (offset + impulse) * decay;
    interaction.velocity = (interaction.velocity - frequency * impulse) * decay;
    if (interaction.destination && interaction.anchor) {
      const follow = 1 - Math.exp(-dt / .09);
      for (const axis of ["x", "y", "sourceX", "sourceY"]) interaction.anchor[axis] += (interaction.destination[axis] - interaction.anchor[axis]) * follow;
      interaction.anchor.text = interaction.destination.text;
    }
    if (!interaction.target && interaction.amount < .012) {
      const next = interaction.next;
      if (!next) {
        resumedSnippet = interaction.snippet;
        resumeUntil = elapsed + cycleLength - elapsed % cycleLength;
        announceScene("returned to source code.");
      }
      interaction = next || null;
    }
  }

  function drawInteraction(time) {
    const { snippet, amount, kind, anchor } = interaction;
    const quiet = interaction.static;
    const renderKind = kind === "object" && snippet.repo !== "architecture-lab" ? "interference" : kind;
    if (quiet) time = 0;
    scene.dataset.phase = "interactive";
    // Keep the live code outside the graphic clear; fade the cells beneath its
    // labels without painting a panel or hiding the continuous typing.
    sourceDimming = window.PortfolioEntranceEffects?.bounds?.(renderKind, {
      width, height, amount, anchor, glyphs: interaction.glyphs, pull: interaction.pull,
    }) || null;
    editor(snippet, quiet ? 1 : (time % cycleLength) / cycleLength, 1 - amount * .58, time, !quiet, !quiet);
    scene.dataset.effect = kind;
    scene.dataset.selectedCommit = kind === "history" ? interaction.selectedCommit || commitHistory[snippet.repo]?.[0]?.sha || "" : "";
    if (renderedEffects.has(renderKind) && window.PortfolioEntranceEffects) {
      const bounds = window.PortfolioEntranceEffects.draw(renderKind, { context, width, height, amount, time: quiet ? (previewTimes[kind] || 0) : Math.max(0, time - (interaction.visualStarted || 0)), anchor, snippet,
        pointerX: quiet ? 0 : pointerX, pointerY: quiet ? 0 : pointerY,
        ecdsaStep: Math.floor((interaction.ecdsa?.position || 0) / ecdsaStepLength),
        ecdsaProgress: interaction.ecdsa ? (interaction.ecdsa.position % ecdsaStepLength) / (ecdsaStepLength - 1) : 1,
        ecdsaTampered: Boolean(interaction.ecdsa?.tampered),
        history: commitHistory[snippet.repo] || [], selectedCommit: interaction.selectedCommit,
        pull: interaction.pull, glyphs: transportedGlyphs(), ...palette });
      displayedGraphic = { kind, snippet, amount, anchor, bounds, glyphs: interaction.glyphs, glyphKeys: interaction.glyphKeys };
    } else if (kind === "avatar") avatar(amount, time);
    else liveObject(snippet, amount, time, anchor);
    if (displayedGraphic) Object.assign(displayedGraphic, { glyphs: interaction.glyphs,
      glyphKeys: interaction.glyphKeys, visualStarted: interaction.visualStarted, static: interaction.static, pull: interaction.pull,
      ecdsa: interaction.ecdsa, pullTarget: interaction.pullTarget, pointerType: interaction.pointerType, selectedCommit: interaction.selectedCommit });
    status(snippet, "NORMAL", kind === "history" ? "git log --graph --oneline" : kind === "tokens" ? "./source --inspect" : kind === "avatar" ? "!./avatar --track" : renderedEffects.has(kind) ? `./sketch --${kind}` : `!./${snippet.repo} --live`);
    drawInputHud(time);
  }

  function drawScene(time) {
    context.clearRect(0, 0, width, height);
    sourceDimming = null;
    displayedGraphic = null;
    scene.dataset.effect = interaction?.kind || "";
    if (!interaction) scene.dataset.selectedCommit = "";
    syncECDSA();
    if (!width || !height) return;
    const clock = time % cycleLength;
    const snippet = heldSnippet || (resumedSnippet && time < resumeUntil ? resumedSnippet : snippets[Math.floor(time / cycleLength) % snippets.length]);
    if (interaction && (interaction.static || interaction.frozen || !still())) { drawInteraction(time); return; }
    if (still()) {
      const frozen = frozenTime !== null;
      const position = editor(snippet, frozen ? (frozenTime % cycleLength) / cycleLength : 1,
        1, frozen ? frozenTime : 0, frozen, frozen);
      status(snippet, frozen ? "INSERT" : "NORMAL", "", position.row, position.column);
      scene.dataset.phase = "still";
      drawInputHud(frozen ? frozenTime : 0);
      return;
    }
    scene.dataset.phase = "editing";
    const position = editor(snippet, clock / cycleLength, 1, time, true, true);
    status(snippet, "INSERT", "", position.row, position.column);
    drawInputHud(time);
  }

  function drawDive(now) {
    if (!leaving) return;
    inputHud.hidden = true;
    const progress = clamp((now - leaving.started) / entryDuration);
    context.clearRect(0, 0, width, height);
    const centerX = width * (.5 + pointerX * .12), centerY = height * (.48 + pointerY * .10);
    const travel = Math.pow(progress, 1.5);
    const zoom = 1 + travel * 27;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const fade = 1 - ease((progress - .76) / .24);
    for (const point of leaving.particles) {
      const scale = 1 + (zoom - 1) * point.depth;
      const x = centerX + point.x * scale;
      const y = centerY + point.y * scale;
      if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
      context.globalAlpha = point.alpha * fade;
      context.fillStyle = point.bright ? palette.accent : palette.ink;
      context.font = `${Math.min(26, point.size * Math.sqrt(scale))}px "Plex Mono", monospace`;
      context.fillText(point.glyph, x, y);
      if (progress > .25) {
        context.globalAlpha *= .2;
        context.fillText(point.glyph, centerX + point.x * scale * .97, centerY + point.y * scale * .97);
      }
    }
    context.globalAlpha = 1;
    if (progress >= 1) completeEntry();
  }

  function completeEntry() {
    if (!leaving && !finishEntry) return;
    clearTimeout(entryTimer);
    leaving = null;
    root.classList.remove("is-leaving");
    if (entryLayout) {
      canvas.style.cssText = entryLayout.canvas;
      if (entryLayout.parent) entryLayout.parent.style.cssText = entryLayout.parentStyle;
      entryLayout = null;
      resize();
    }
    const resolve = finishEntry;
    finishEntry = null;
    entryPromise = null;
    if (resolve) resolve();
  }

  function enter() {
    if (entryPromise) return entryPromise;
    if (!visible() || still() || motion.matches) return Promise.resolve();
    gesture = null; interaction = null;
    const parent = canvas.parentElement;
    entryLayout = { canvas: canvas.style.cssText, parent, parentStyle: parent?.style.cssText || "" };
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100svh",
      zIndex: "9", backgroundColor: palette.paper, pointerEvents: "none" });
    if (parent) parent.style.overflow = "visible";
    root.classList.add("is-leaving");
    resize();
    const particles = [];
    const count = width < 600 ? 420 : 800;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963;
      const radius = Math.sqrt((i + .5) / count);
      particles.push({ x: Math.cos(angle) * radius * width * .62, y: Math.sin(angle) * radius * height * .68,
        depth: .18 + ((i * 37) % 101) / 101, glyph: glyphs[(i * 31) % glyphs.length],
        alpha: .2 + ((i * 19) % 80) / 100, size: 5 + i % 5, bright: i % 7 === 0 });
    }
    leaving = { started: performance.now(), particles };
    root.classList.add("is-leaving");
    scene.dataset.phase = "enter";
    status(null, "NORMAL", "open portfolio/");
    entryPromise = new Promise(resolve => { finishEntry = resolve; });
    // This upper bound also completes navigation if the browser stops animation frames.
    entryTimer = setTimeout(completeEntry, entryDuration + 80);
    schedule();
    return entryPromise;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    pointerRect = rect;
    const wasNarrow = width < 600;
    width = rect.width; height = rect.height;
    // Render text at Retina density; cap large entry canvases by pixel area.
    ratio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(4000000 / Math.max(1, width * height)));
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    fontSize = 12;
    context.font = `${fontSize}px "Plex Mono", monospace`;
    rowCache.clear();
    tokenCache.clear();
    cell = context.measureText("M").width || fontSize * .6;
    lineHeight = 15;
    if (wasNarrow !== (width < 600)) buildPortrait();
    if (visible()) leaving ? drawDive(performance.now()) : drawScene(elapsed);
  }

  function tick(now) {
    frame = 0;
    if (!running()) { lastFrame = 0; return; }
    // Rest at 30fps; respond to a pointer or navigation on the next display frame.
    const interactive = leaving || interaction || now - lastInput < 800;
    if (!interactive && lastFrame && now - lastFrame < 30) { schedule(); return; }
    const delta = lastFrame ? Math.min(now - lastFrame, 80) : 0;
    lastFrame = now;
    const follow = 1 - Math.exp(-(delta || 16.67) / 65);
    pointerX += (targetX - pointerX) * follow;
    pointerY += (targetY - pointerY) * follow;
    if (now >= releaseAt) { targetX = 0; targetY = 0; releaseAt = Infinity; }
    updateInteraction(now, delta);
    if (leaving) drawDive(now);
    else { elapsed += delta; drawScene(elapsed); }
    schedule();
  }

  function schedule() { if (!frame && running()) frame = requestAnimationFrame(tick); }

  function refresh() {
    colors();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = 0;
    const quiet = still();
    if (!visible()) {
      heldSnippet = null; projectHovered = false;
      cancelGesture();
      interaction = null;
      displayedGraphic = null;
      frozenTime = null;
      syncECDSA();
      releaseAt = Infinity;
      targetX = 0; targetY = 0;
    } else if (quiet) {
      cancelGesture();
      if (!quietPreviously) frozenTime = elapsed;
      if (interaction && !interaction.static && !interaction.frozen) {
        interaction.remainingHold = Math.max(0, interaction.expires - performance.now());
        interaction.expires = Infinity;
        interaction.frozen = true;
      }
    } else {
      frozenTime = null;
      if (interaction?.static || interaction?.frozen) {
        interaction.expires = interaction.kind === "ecdsa" ? Infinity : performance.now() + (interaction.static ? holdDuration(interaction.pointerType) : interaction.remainingHold || 0);
        interaction.static = false;
        interaction.frozen = false;
      }
    }
    quietPreviously = quiet;
    if (leaving && (!visible() || still() || motion.matches)) completeEntry();
    if (visible()) leaving ? drawDive(performance.now()) : drawScene(elapsed);
    schedule();
  }

  const controlsSelector = "a, button, input, textarea, select, summary, [role=button], [contenteditable]";
  function ignoresInput(event) {
    return !visible() || leaving || event.isPrimary === false
      || Boolean(event.target?.closest?.(controlsSelector)) || Boolean(document.querySelector("dialog[open]"));
  }
  function trackPointer(event) {
    if (ignoresInput(event) || still()) { return; }
    const rect = pointerRect || canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    targetX = clamp((event.clientX - rect.left) / rect.width) - .5;
    targetY = clamp((event.clientY - rect.top) / rect.height) - .5;
    lastInput = performance.now();
    if (readout && event.timeStamp - lastReadout > 50) {
      readout.textContent = `x ${(targetX + .5).toFixed(3)} / y ${(targetY + .5).toFixed(3)}`;
      lastReadout = event.timeStamp;
    }
    schedule();
  }
  function releasePointer() { targetX = 0; targetY = 0; lastInput = performance.now(); schedule(); }
  function trackGesture(event, checkButtons = false) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (checkButtons && ["mouse", "pen"].includes(event.pointerType) && event.buttons !== undefined && (event.buttons & 1) === 0) {
      cancelGesture(); releasePointer(); return;
    }
    gesture.distance = Math.max(gesture.distance, Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y));
    if (!still() && gesture.effect && gesture.effect === interaction && gesture.distance > 6) {
      interaction.pullTarget = { x: clamp((event.clientX - gesture.x) * .55, -40, 40),
        y: clamp((event.clientY - gesture.y) * .55, -40, 40) };
      interaction.expires = interaction.kind === "ecdsa" ? Infinity : performance.now() + holdDuration(event.pointerType);
      lastInput = performance.now();
      schedule();
    }
  }
  function graphicContains(x, y) {
    const bounds = displayedGraphic?.bounds;
    return displayedGraphic?.amount > .35 && bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }
  function chooseCommit(record) {
    if (!interaction || !record) return;
    interaction.selectedCommit = record.sha;
    const hold = holdDuration(interaction.pointerType);
    interaction.remainingHold = hold;
    interaction.expires = still() || interaction.static ? Infinity : performance.now() + hold;
    scene.dataset.selectedCommit = record.sha;
    announceScene(`${record.sha.slice(0, 7)}: ${record.message}.`);
    if (still()) drawScene(elapsed);
    schedule();
  }
  function cancelGesture() {
    const id = gesture?.id;
    if (gesture?.effect && gesture.effect === interaction) interaction.pullTarget = { x: 0, y: 0 };
    gesture = null;
    scene.dataset.dragging = "false";
    try {
      if (id !== undefined && codeSurface?.hasPointerCapture?.(id)) codeSurface.releasePointerCapture(id);
    } catch { /* Capture may already have ended. */ }
  }
  const inputSurface = entrance || canvas;
  inputSurface.addEventListener("pointerdown", event => {
    if (event.isPrimary === false) { cancelGesture(); releasePointer(); return; }
    if (ignoresInput(event) || (event.button !== undefined && event.button !== 0)) return;
    pointerRect = canvas.getBoundingClientRect();
    const inside = !still() && graphicContains(event.clientX - pointerRect.left, event.clientY - pointerRect.top);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), distance: 0,
      effect: inside ? interaction : null };
    if (inside) {
      scene.dataset.dragging = "true";
      try { codeSurface?.setPointerCapture?.(event.pointerId); } catch { /* The pointer may already be released. */ }
    }
    releaseAt = Infinity;

    trackPointer(event);
  }, { passive: true });
  inputSurface.addEventListener("pointermove", event => { trackGesture(event, true); trackPointer(event); }, { passive: true });
  inputSurface.addEventListener("pointerleave", () => { if (!gesture) releasePointer(); });
  window.addEventListener("pointermove", event => trackGesture(event, true), { passive: true });
  window.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    trackGesture(event);
    const tap = gesture.distance < 25 && performance.now() - gesture.started < 500;
    const pulled = gesture.effect && gesture.distance > 6;
    scene.dataset.dragging = "false";
    if (gesture.effect === interaction && interaction) interaction.pullTarget = { x: 0, y: 0 };
    gesture = null;
    if (ignoresInput(event)) return;
    if (tap && !pulled) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const insideGraphic = graphicContains(x, y);
      const row = sourceHit(x, y);
      const commit = insideGraphic && interaction?.kind === "history" ? window.PortfolioEntranceEffects?.pick?.("history", {
        width, height, amount: interaction.amount, anchor: interaction.anchor, snippet: interaction.snippet,
        pull: interaction.pull, glyphs: transportedGlyphs(), history: commitHistory[interaction.snippet.repo] || [],
      }, x, y) : null;
      if (commit) chooseCommit(commit);
      else if (insideGraphic || !row) closeGraphic();
      else openGraphic(row, event.pointerType);
    }
    // The spring keeps the tap alive after release; do not zero it before its first frame.
    lastInput = performance.now();
    if (event.pointerType !== "mouse") releaseAt = lastInput + 120;
    schedule();
  }, { passive: true });
  window.addEventListener("pointercancel", event => {
    if (gesture?.id !== event.pointerId) return;
    cancelGesture(); releasePointer();
  }, { passive: true });
  codeSurface?.addEventListener("lostpointercapture", event => {
    if (event.target === codeSurface && gesture?.id === event.pointerId) { cancelGesture(); releasePointer(); }
  });
  window.addEventListener("scroll", () => { pointerRect = null; }, { passive: true });
  window.addEventListener("portfolio:preferences", refresh);
  window.addEventListener("portfolio:training", refresh);
  window.addEventListener("portfolio:view", () => { resize(); refresh(); });
  document.addEventListener("visibilitychange", refresh);
  motion.addEventListener("change", refresh);
  window.addEventListener("resize", resize, { passive: true });
  codeSurface?.addEventListener("focus", () => {
    keyboardFocus = true;
    const row = selectedRow();
    if (row) selectedSource = sourceKey(row);
    drawScene(elapsed);
  });
  codeSurface?.addEventListener("blur", () => { keyboardFocus = false; if (visible()) drawScene(elapsed); });
  codeSurface?.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
      || !visible() || leaving || document.querySelector("dialog[open]")) return;
    if (interaction?.kind === "ecdsa" && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      stepECDSA(event.key === "ArrowLeft" ? -1 : 1);
    } else if (interaction?.kind === "history" && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      const records = (commitHistory[interaction.snippet.repo] || []).slice(0, 4).reverse();
      const current = Math.max(0, records.findIndex(record => record.sha === (interaction.selectedCommit || records.at(-1)?.sha)));
      const index = clamp(current + (event.key === "ArrowLeft" ? -1 : 1), 0, records.length - 1);
      chooseCommit(records[index]);
    } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
      if (!sourceRows.length) return;
      const current = Math.max(0, sourceRows.findIndex(row => sourceKey(row) === selectedSource));
      const row = sourceRows[clamp(current + (event.key === "ArrowUp" ? -1 : 1), 0, sourceRows.length - 1)];
      selectedSource = sourceKey(row);
      keyboardFocus = true;
      announceScene(`line ${row.line}: ${row.text.trim()}`);
      drawScene(elapsed);
    } else if (event.key.toLowerCase() === "n") {
      if (event.repeat) { event.preventDefault(); return; }
      const row = selectedRow();
      if (!row) return;
      openGraphic(row, "keyboard", nextSourceEffect(renderedSnippet.repo));
    } else if (event.key === " " || event.key === "Spacebar") {
      if (event.repeat) { event.preventDefault(); return; }
      if (interaction?.target) closeGraphic();
      else {
        const row = selectedRow();
        if (!row) return;
        const token = row.text.match(/\b(?:compile|tokens|tokenize|ast|wasm|lower|optimize|output|byteLocation|match)\b/)?.[0];
        openGraphic({ ...row, token }, "keyboard");
      }
    } else return;
    event.preventDefault();
    event.stopPropagation?.();
    schedule();
  });
  inputSurface.addEventListener("keydown", event => {
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || !interaction || !visible()
      || document.querySelector("dialog[open]")) return;
    event.preventDefault(); event.stopPropagation?.();
    closeGraphic(); schedule();
  });
  fileLabel?.addEventListener("click", () => {
    const row = sourceRows[0];
    if (!row) return;
    if (interaction?.kind === "history" && interaction.target) closeGraphic();
    else {
      openGraphic(row, "button", "history");
      if (interaction?.kind === "history" && interaction.target) codeSurface?.focus?.({ preventScroll: true });
    }
    lastInput = performance.now();
    schedule();
  });
  // Keep action destinations stable while someone is reading or focusing them.
  const holdProject = () => { heldSnippet = renderedSnippet; };
  const releaseProject = () => {
    if (heldSnippet) {
      resumedSnippet = heldSnippet;
      resumeUntil = elapsed + cycleLength - elapsed % cycleLength;
    }
    heldSnippet = null;
  };
  projectLinks?.addEventListener("pointerenter", () => { projectHovered = true; holdProject(); });
  projectLinks?.addEventListener("pointerleave", () => {
    projectHovered = false;
    if (!projectLinks.contains(document.activeElement)) releaseProject();
  });
  projectLinks?.addEventListener("focusin", holdProject);
  projectLinks?.addEventListener("focusout", event => {
    if (!projectHovered && !projectLinks.contains(event.relatedTarget)) releaseProject();
  });
  projectTry?.addEventListener("click", () => {
    const kind = document.getElementById(renderedSnippet.repo)?.dataset.experiment;
    const row = selectedRow() || sourceRows[0];
    if (!kind || !row) return;
    openGraphic(row, "button", kind);
    codeSurface?.focus?.({ preventScroll: true });
  });
  function syncECDSA() {
    const active = interaction?.kind === "ecdsa" && interaction.target && Boolean(interaction.ecdsa);
    if (ecdsaControls) {
      const restoreFocus = visible() && !active && !ecdsaControls.hidden && ecdsaControls.contains(document.activeElement);
      ecdsaControls.hidden = !active;
      if (restoreFocus) codeSurface?.focus?.({ preventScroll: true });
    }
    if (!active) { ecdsaAnnouncement = ""; return; }
    const state = interaction.ecdsa, step = Math.floor(state.position / ecdsaStepLength);
    if (ecdsaLabel) ecdsaLabel.textContent = `${step + 1} / 6`;
    if (ecdsaButtons.back) ecdsaButtons.back.disabled = step === 0;
    if (ecdsaButtons.next) ecdsaButtons.next.disabled = step === 5;
    if (ecdsaButtons.play) {
      ecdsaButtons.play.disabled = still();
      ecdsaButtons.play.textContent = still() ? "paused" : state.playing ? "pause" : step === 5 ? "replay" : "play";
      ecdsaButtons.play.setAttribute("aria-label", still() ? "Animation paused; use arrows to step" : state.playing ? "Pause ECDSA playback" : "Play ECDSA animation");
    }
    ecdsaButtons.tamper?.setAttribute("aria-pressed", String(state.tampered));
    if (ecdsaButtons.tamper) ecdsaButtons.tamper.textContent = state.tampered ? "restore hash" : "tamper hash";
    const key = `${step}:${state.tampered}`;
    if (ecdsaAnnouncement !== key) {
      ecdsaAnnouncement = key;
      const description = state.tampered && step >= 4
        ? step === 4 ? "Changed hash z = 12, with the original signature and public key. u1 = 11 and u2 = 6."
          : "Rejected: changing the hash from 11 to 12 reconstructs (3, 16). Its x coordinate 3 does not match r = 10."
        : ecdsaDescriptions[step];
      announceScene(`ECDSA step ${step + 1} of 6. ${description}`);
    }
  }
  function stepECDSA(direction) {
    if (!interaction?.ecdsa || !interaction.target) return;
    const state = interaction.ecdsa;
    state.position = (clamp(Math.floor(state.position / ecdsaStepLength) + direction, 0, 5) + 1) * ecdsaStepLength - 1;
    state.playing = false;
    drawScene(elapsed); schedule();
  }
  function openECDSA() {
    if (!visible() || document.querySelector("dialog[open]")) return;
    // A command opens immediately, even if another source experiment is retracting.
    interaction = null; displayedGraphic = null;
    openGraphic(selectedRow() || sourceRows[0], "keyboard", "ecdsa");
    codeSurface?.focus?.({ preventScroll: true });
  }
  ecdsaButtons.back?.addEventListener("click", () => stepECDSA(-1));
  ecdsaButtons.next?.addEventListener("click", () => stepECDSA(1));
  ecdsaButtons.close?.addEventListener("click", () => { closeGraphic(); schedule(); });
  ecdsaButtons.play?.addEventListener("click", () => {
    if (!interaction?.ecdsa || still()) return;
    const state = interaction.ecdsa;
    if (Math.floor(state.position / ecdsaStepLength) === 5 && !state.playing) state.position = 0;
    state.playing = !state.playing;
    drawScene(elapsed); schedule();
  });
  ecdsaButtons.tamper?.addEventListener("click", () => {
    if (!interaction?.ecdsa) return;
    interaction.ecdsa.tampered = !interaction.ecdsa.tampered;
    interaction.ecdsa.position = ecdsaStepLength * 6 - 1;
    interaction.ecdsa.playing = false;
    drawScene(elapsed); schedule();
  });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(codeSurface);
  window.PortfolioAnimation = Object.freeze({ enter, cancel: completeEntry, openECDSA,

    get state() { return Object.freeze({ effect: interaction?.kind || null, glyphCount: interaction?.glyphs?.length || 0,
      static: Boolean(interaction?.static), frozen: Boolean(interaction?.frozen), amount: interaction?.amount || 0,
      pull: Object.freeze({ x: interaction?.pull?.x || 0, y: interaction?.pull?.y || 0 }), selectedCommit: interaction?.selectedCommit || null,
      ecdsaStep: interaction?.ecdsa ? Math.floor(interaction.ecdsa.position / ecdsaStepLength) : null,
      ecdsaPlaying: Boolean(interaction?.ecdsa?.playing), ecdsaTampered: Boolean(interaction?.ecdsa?.tampered),
      selectedLine: selectedRow()?.line || null }); } });
  const image = new Image();
  image.onload = () => { sourceImage = image; buildPortrait(); refresh(); };
  image.onerror = () => { buildPortrait(); refresh(); };
  image.src = "/assets/memoji-saiyan.webp";
  if (document.fonts?.ready) document.fonts.ready.then(() => { buildPortrait(); resize(); refresh(); });
  colors();
  buildPortrait();
  if (wall) wall.textContent = "";
  resize();
  scene.classList.add("has-canvas");
  refresh();
})();
