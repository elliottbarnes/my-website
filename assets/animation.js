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
  const glyphs = snippets.map(snippet => snippet.code.replace(/\s+/g, " ")).join(" ");
  const cycleLength = 32600;
  let width = 0, height = 0, ratio = 1, fontSize = 12, cell = 7.2, lineHeight = 17;
  let frame = 0, lastFrame = 0, elapsed = 0, sourceImage = null, portrait = [];
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0, lastReadout = 0;
  let palette = {}, leaving = null, entryPromise = null, finishEntry = null, entryTimer = 0, entryLayout = null;
  let currentFile = "", currentMode = "", currentCommand = "", currentPosition = "";
  const clamp = (number, low = 0, high = 1) => Math.max(low, Math.min(high, number));
  const ease = number => { const t = clamp(number); return t * t * (3 - 2 * t); };
  const visible = () => !document.hidden && root.dataset.view !== "workspace";
  const still = () => root.dataset.motion === "paused" || (root.dataset.motion !== "running" && motion.matches);
  const running = () => visible() && (!still() || Boolean(leaving));

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
      // The central crop keeps the GitHub avatar legible as individual code glyphs.
      const side = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight) * .60;
      sample.drawImage(sourceImage, (sourceImage.naturalWidth - side) / 2,
        (sourceImage.naturalHeight - side) / 2, side, side, 0, 0, 120, 120);
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
    for (let y = 1; y < 119; y += 2) for (let x = 1; x < 119; x += 2) {
      const i = (y * 120 + x) * 4;
      if (pixels[i + 3] < 30) continue;
      const luminance = (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
      const distance = Math.hypot((x - 60) / 60, (y - 60) / 60);
      const contrast = Math.abs(luminance - backdrop / 255);
      const intensity = backdrop > 140 ? 1 - luminance : luminance;
      if (distance > 1.02 || (intensity < .045 && contrast < .065)) continue;
      const edge = clamp((1.02 - distance) * 9);
      portrait.push({ x: (x - 60) / 120, y: (y - 60) / 120, z: (luminance - .5) * .13,
        brightness: Math.max(.10, intensity) * edge, glyph: glyphs[(x * 7 + y * 19) % glyphs.length], phase: x * .7 + y * .3 });
    }
  }

  // Display data only: the excerpt text is never evaluated or executed.
  function rowsFor(snippet) {
    const columns = Math.max(20, Math.floor((width - 46) / cell));
    const rows = [];
    for (const [index, text] of snippet.code.split("\n").entries()) {
      if (!text.length) rows.push({ text: "", line: snippet.sourceLineStart + index, continuation: false });
      else for (let start = 0; start < text.length; start += columns) {
        rows.push({ text: text.slice(start, start + columns), line: snippet.sourceLineStart + index, continuation: start > 0 });
      }
    }
    return rows;
  }

  function syntaxLine(text, x, y, alpha) {
    const tokens = text.match(/\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[^\w$]+/g) || [];
    context.globalAlpha = alpha;
    for (const token of tokens) {
      const comment = token.startsWith("//");
      context.fillStyle = comment ? palette.muted : words.has(token) ? palette.keyword
        : /^["'`]/.test(token) ? palette.string : /^\d/.test(token) ? palette.number : palette.ink;
      if (comment) context.globalAlpha = alpha * .58;
      context.fillText(token, x, y);
      x += token.length * cell;
    }
    context.globalAlpha = 1;
  }

  function editor(snippet, progress, alpha = 1, time = 0, active = true, editing = true) {
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
      context.globalAlpha = alpha * .37;
      context.fillStyle = palette.muted;
      context.fillText(row.continuation ? "  ·" : String(row.line).padStart(3, " "), 3, y);
      syntaxLine(row.text.slice(0, amount), gutter, y, alpha * .88);
    });
    if (active && (still() || Math.floor(time / 560) % 2 === 0)) {
      const x = gutter + cursorColumn * cell;
      const y = 10 + (cursorRow - scroll) * lineHeight;
      context.globalAlpha = alpha * .76;
      context.fillStyle = palette.accent;
      context.fillRect(x, y, editing ? 1.4 : cell, fontSize + 2);
    }
    context.globalAlpha = 1;
    return { row: rows[cursorRow].line, column: cursorColumn + 1 };
  }

  function type(text, time, duration) { return text.slice(0, Math.floor(text.length * clamp(time / duration))); }

  function avatar(amount, time) {
    const size = Math.min(width * .70, height * .90, 282) * (.16 + .84 * ease(amount));
    const quiet = still();
    const t = quiet ? 0 : time / 1000;
    const yaw = quiet ? 0 : pointerX * .31 + Math.sin(t * .25) * .035;
    const pitch = quiet ? 0 : pointerY * .20;
    const cosine = Math.cos(yaw), sine = Math.sin(yaw);
    const cx = width * .5, cy = height * .49;
    context.font = `${Math.max(2.7, size / 54)}px "Plex Mono", monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = palette.ink;
    for (const point of portrait) {
      const orbit = (1 - ease(amount)) * Math.sin(point.phase) * size * .3;
      const x = (point.x * cosine + point.z * sine) * size;
      const y = (point.y - point.z * pitch) * size;
      context.globalAlpha = clamp((.09 + point.brightness * 1.02) * amount);
      context.fillText(point.glyph, cx + x + orbit, cy + y + Math.sin(t * .8 + point.phase) * .22);
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

  function liveObject(snippet, amount, time) {
    const t = still() ? 0 : time / 1000;
    const columns = Math.min(68, Math.max(26, Math.floor(width / 10)));
    const rows = Math.min(21, Math.max(12, Math.floor(height / 13)));
    const spacingX = Math.min(8.5, (width - 30) / columns);
    const spacingY = Math.min(11, (height - 60) / rows);
    const cx = width * .5, cy = height * .49;
    const growth = .1 + .9 * ease(amount);
    const architecture = snippet.repo === "architecture-lab";
    const marks = " .:;+=*#%@";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${Math.max(6, spacingX)}px "Plex Mono", monospace`;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const px = (x - columns / 2) / columns, py = (y - rows / 2) / rows;
      const distance = Math.hypot(px - pointerX * .34, py - pointerY * .28);
      const value = architecture
        ? Math.sin(x * .35 - t * 1.6) * Math.cos(y * .45 + t * .8) + Math.sin(distance * 25 - t * 2)
        : Math.sin(px * 15 + t) + Math.cos(py * 18 - t * 1.3) + Math.sin(distance * 25 - t * 2);
      const brightness = clamp((value + 3) / 6);
      const edge = clamp((.72 - Math.hypot(px, py)) * 4);
      context.globalAlpha = amount * edge * (.16 + brightness * .79);
      context.fillStyle = brightness > .64 ? palette.accent : palette.ink;
      const glyph = architecture ? ((x + y + Math.floor(t * 3)) % 7 === 0 ? "1" : brightness > .6 ? "▦" : "0")
        : marks[Math.min(marks.length - 1, Math.floor(brightness * marks.length))];
      context.fillText(glyph, cx + (x - columns / 2) * spacingX * growth, cy + (y - rows / 2) * spacingY * growth);
    }
    context.globalAlpha = amount * .78;
    context.textAlign = "left";
    context.font = '9px "Plex Mono", monospace';
    context.fillStyle = palette.muted;
    context.fillText(architecture ? "// memory → signal → pixels" : "// code → interference → light", 15, height - 22);
    context.globalAlpha = 1;
  }

  function drawBoot(time) {
    context.font = `${fontSize}px "Plex Mono", monospace`;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = palette.muted;
    context.fillText("elliott@dev ~/Projects", 15, 22);
    context.fillStyle = palette.ink;
    const text = type("nvim ~/Projects", time - 430, 1160);
    context.fillText(`$ ${text}`, 15, 22 + lineHeight * 2);
    if (Math.floor(time / 420) % 2 === 0) context.fillRect(15 + (text.length + 2) * cell, 22 + lineHeight * 2, cell, fontSize + 2);
    status(null, "NORMAL", text);
  }

  function drawInputHud(time) {
    if (!hudContext) return;
    const phase = scene.dataset.phase;
    const allowed = visible() && !still() && !entryLayout && !leaving
      && window.innerHeight >= (window.innerWidth < 600 ? 700 : 680) && phase !== "boot";
    inputHud.hidden = !allowed;
    if (!allowed) return;
    const narrow = window.innerWidth < 600;
    inputHud.style.width = narrow ? "230px" : "310px";
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    if (inputHud.width !== Math.round(310 * scale)) {
      inputHud.width = Math.round(310 * scale);
      inputHud.height = Math.round(140 * scale);
      hudContext.setTransform(scale, 0, 0, scale, 0, 0);
    }
    const opacity = phase === "avatar" ? .73 : phase === "editing" ? .38 : .30;
    const typing = phase === "editing" && currentMode === "INSERT";
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

  function drawScene(time) {
    context.clearRect(0, 0, width, height);
    if (!width || !height) return;
    if (still()) {
      const snippet = snippets[0];
      editor(snippet, 1, .20, 0, false, false);
      avatar(1, 0);
      status(snippet, "NORMAL", "!./avatar --track");
      scene.dataset.phase = "still";
      drawInputHud(time);
      return;
    }
    if (time < 2400) { scene.dataset.phase = "boot"; drawBoot(time); drawInputHud(time); return; }
    const clock = (time - 2400) % cycleLength;
    const cycle = Math.floor((time - 2400) / cycleLength);
    const first = snippets[cycle % snippets.length];
    const second = snippets[(cycle + 1) % snippets.length];
    let position;
    if (clock < 5100) {
      scene.dataset.phase = "editing";
      const local = clock - 500;
      // A short backspace/retype beat makes the illustrative edit legible.
      let progress = clamp(local / 4100);
      if (local > 2350 && local < 2810) progress = .573 - (local - 2350) / 460 * .07;
      else if (local >= 2810 && local < 3150) progress = .503 + (local - 2810) / 340 * .265;
      position = editor(first, progress, ease(clock / 620), time, true, true);
      status(first, clock < 500 || clock > 4750 ? "NORMAL" : "INSERT", "", position.row, position.column);
    } else if (clock < 6400) {
      scene.dataset.phase = "colorscheme";
      position = editor(first, 1, 1, time, true, false);
      status(first, "NORMAL", type(`colorscheme ${root.dataset.theme || "carbon"}`, clock - 5100, 1050), position.row, position.column);
    } else if (clock < 8000) {
      scene.dataset.phase = "avatar-command";
      editor(first, 1, 1, time, false, false);
      status(first, "NORMAL", type("!./avatar --track", clock - 6400, 1150));
    } else if (clock < 15800) {
      scene.dataset.phase = "avatar";
      const local = clock - 8000;
      const amount = local < 1050 ? ease(local / 1050) : local > 6900 ? 1 - ease((local - 6900) / 900) : 1;
      editor(first, 1, 1 - amount * .88, time, false, false);
      avatar(amount, time);
      status(first, "NORMAL", "!./avatar --track");
    } else if (clock < 20500) {
      scene.dataset.phase = "editing";
      const local = clock - 15800;
      position = editor(second, clamp((local - 350) / 3900), 1, time, true, true);
      status(second, local < 350 || local > 4300 ? "NORMAL" : "INSERT", "", position.row, position.column);
    } else if (clock < 22300) {
      scene.dataset.phase = "object-command";
      editor(second, 1, 1, time, false, false);
      status(second, "NORMAL", type(second.repo === "architecture-lab" ? "!./framebuffer --trace" : "!./interference --live", clock - 20500, 1400));
    } else if (clock < 29900) {
      scene.dataset.phase = "object";
      const local = clock - 22300;
      const amount = local < 900 ? ease(local / 900) : local > 6700 ? 1 - ease((local - 6700) / 900) : 1;
      editor(second, 1, 1 - amount * .90, time, false, false);
      liveObject(second, amount, time);
      status(second, "NORMAL", second.repo === "architecture-lab" ? "!./framebuffer --trace" : "!./interference --live");
    } else {
      scene.dataset.phase = "normal";
      position = editor(second, 1, 1, time, true, false);
      status(second, "NORMAL", clock < 31000 ? "write | next" : "", position.row, position.column);
    }
    drawInputHud(time);
  }

  function drawDive(now) {
    if (!leaving) return;
    inputHud.hidden = true;
    const progress = clamp((now - leaving.started) / 1700);
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
    const parent = canvas.parentElement;
    entryLayout = { canvas: canvas.style.cssText, parent, parentStyle: parent?.style.cssText || "" };
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100svh",
      zIndex: "9", backgroundColor: palette.paper, pointerEvents: "none" });
    if (parent) parent.style.overflow = "visible";
    root.classList.add("is-leaving");
    resize();
    const particles = [];
    const count = width < 600 ? 1500 : 2600;
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
    entryTimer = setTimeout(completeEntry, 1800);
    schedule();
    return entryPromise;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    fontSize = 12;
    context.font = `${fontSize}px "Plex Mono", monospace`;
    cell = context.measureText("M").width || fontSize * .6;
    lineHeight = 13;
    if (visible()) leaving ? drawDive(performance.now()) : drawScene(elapsed);
  }

  function tick(now) {
    frame = 0;
    if (!running()) { lastFrame = 0; return; }
    if (lastFrame && now - lastFrame < 32) { schedule(); return; }
    const delta = lastFrame ? Math.min(now - lastFrame, 80) : 0;
    lastFrame = now;
    pointerX += (targetX - pointerX) * .10;
    pointerY += (targetY - pointerY) * .10;
    if (leaving) drawDive(now);
    else { elapsed += delta; drawScene(elapsed); }
    schedule();
  }

  function schedule() { if (!frame && running()) frame = requestAnimationFrame(tick); }

  function refresh() {
    colors();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = 0;
    if (leaving && (!visible() || still() || motion.matches)) completeEntry();
    if (visible()) leaving ? drawDive(performance.now()) : drawScene(elapsed);
    schedule();
  }

  canvas.addEventListener("pointermove", event => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    targetX = (event.clientX - rect.left) / rect.width - .5;
    targetY = (event.clientY - rect.top) / rect.height - .5;
    if (readout && event.timeStamp - lastReadout > 75) {
      readout.textContent = `x ${(targetX + .5).toFixed(3)} / y ${(targetY + .5).toFixed(3)}`;
      lastReadout = event.timeStamp;
    }
  }, { passive: true });
  canvas.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; });
  window.addEventListener("portfolio:preferences", refresh);
  window.addEventListener("portfolio:view", () => { resize(); refresh(); });
  document.addEventListener("visibilitychange", refresh);
  motion.addEventListener("change", refresh);
  window.addEventListener("resize", resize, { passive: true });
  window.PortfolioAnimation = Object.freeze({ enter, cancel: completeEntry });
  const image = new Image();
  image.onload = () => { sourceImage = image; buildPortrait(); refresh(); };
  image.onerror = () => { buildPortrait(); refresh(); };
  image.src = "/assets/github-avatar.jpg";
  if (document.fonts?.ready) document.fonts.ready.then(() => { buildPortrait(); resize(); refresh(); });
  colors();
  buildPortrait();
  if (wall) wall.textContent = "";
  resize();
  scene.classList.add("has-canvas");
  refresh();
})();
