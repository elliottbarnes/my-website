// Public project copy. Generated HTML stays readable without JavaScript.
export const FEATURED_PROJECT_ID = "glassbox";
export const PROJECTS = Object.freeze([
  {
    "id": "glassbox",
    "label": "glassbox",
    "title": "glassbox",
    "displayName": "Glassbox",
    "titleId": "glassbox-title",
    "kind": "WebAssembly compiler",
    "description": "A typed WebAssembly compiler with differential execution checks.",
    "aliases": [],
    "search": "compiler compilers webassembly wasm typed language",
    "image": {
      "src": "/assets/projects/glassbox.jpg",
      "width": 1000,
      "height": 700,
      "alt": "Glassbox live playground preview"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/glassbox/",
      "label": "open playground ↗",
      "ariaLabel": "Open Glassbox live demo"
    },
    "source": "https://github.com/elliottbarnes/glassbox",
    "preview": {
      "label": "compiler / docs/core.js",
      "html": "export function compile(source, { optimized = true } = {}) {\n  const tokens = tokenize(source); const ast = parse(tokens); const ir = lower(ast); const optimization = optimize(ir);\n  const selectedIR = optimized ? optimization.ir : ir; const wasm = emitWasm(selectedIR);\n  if (!WebAssembly.validate(wasm)) throw new Error(&#x27;Internal compiler error: emitted invalid WebAssembly.&#x27;);\n  return { ast, ir, optimizedIr: optimization.ir, changes: optimization.changes, wasm, tokens: tokens.length - 1, resultType: ir.functions[ir.entry].result };\n}"
    },
    "experiment": {
      "kind": "tokens",
      "label": "compile sketch"
    }
  },
  {
    "id": "pixel-language",
    "label": "pixel",
    "title": "pixel language",
    "displayName": "Pixel Language",
    "titleId": "pixel-title",
    "kind": "Graphics language",
    "description": "A typed graphics language that emits inspectable GLSL.",
    "aliases": [
      "pixel"
    ],
    "search": "pixel graphics shader shaders glsl language compiler",
    "image": {
      "src": "/assets/projects/pixel-language.jpg",
      "width": 1000,
      "height": 700,
      "alt": "Pixel Language live playground preview"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/pixel-language/",
      "label": "open playground ↗",
      "ariaLabel": "Open Pixel Language live demo"
    },
    "source": "https://github.com/elliottbarnes/pixel-language",
    "preview": {
      "label": "interference.pixel / docs/presets.js",
      "html": "// Interference · a field of phase-shifted waves\nlet p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1);\nlet t = time * 0.32;\nlet a = sin(p.x * 9 + t);\nlet b = cos(p.y * 11 - t * 1.3);\nlet c = sin(length(p) * 15 - t * 2);\nlet field = (a + b + c) / 3;\nlet phase = field * 2.4 + vec3(0, 1.8, 3.9);\nlet color = 0.5 + 0.5 * cos(phase);\nlet glow = pow(1 - abs(field), 3);\noutput color * (0.35 + 0.65 * glow);"
    },
    "experiment": {
      "kind": "interference",
      "label": "interference field"
    }
  },
  {
    "id": "architecture-lab",
    "label": "architecture",
    "title": "architecture lab",
    "displayName": "Architecture Lab",
    "titleId": "architecture-title",
    "kind": "Computer architecture",
    "description": "Explore three generations of Mac hardware in interactive 3D.",
    "aliases": [
      "architecture"
    ],
    "search": "architecture mac macintosh hardware computer memory",
    "image": {
      "src": "/assets/projects/architecture-lab.jpg",
      "width": 1000,
      "height": 700,
      "alt": "Architecture Lab live playground preview"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/architecture-lab/",
      "label": "open exhibit ↗",
      "ariaLabel": "Open Architecture Lab live demo"
    },
    "source": "https://github.com/elliottbarnes/architecture-lab",
    "preview": {
      "label": "input → instructions → memory → display",
      "html": "<span class=\"syntax-comment\">// look beneath the screen</span>\n\n01  explore the machine\n02  follow a signal\n03  inspect the memory\n04  connect the pieces"
    },
    "experiment": {
      "kind": "object",
      "label": "source field"
    }
  },
  {
    "id": "automata-lab",
    "label": "automata",
    "title": "automata lab",
    "displayName": "Automata Lab",
    "titleId": "automata-title",
    "kind": "Regular expression engine",
    "description": "Bounded regex compilation with independently checked minimization.",
    "aliases": [
      "automata"
    ],
    "search": "automata regex regular expression pattern dfa nfa matching compiler",
    "image": {
      "src": "/assets/projects/automata-lab.jpg",
      "width": 1000,
      "height": 700,
      "alt": "Automata Lab live playground preview"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/automata-lab/",
      "label": "open playground ↗",
      "ariaLabel": "Open Automata Lab live demo"
    },
    "source": "https://github.com/elliottbarnes/automata-lab",
    "preview": {
      "label": "regular expression → NFA → DFA → minimization",
      "html": "<span class=\"syntax-value\">(a|b)*abb</span>\n\n<span class=\"syntax-comment\">// turn a pattern into a machine</span>\n<span class=\"syntax-comment\">// step through a string</span>\n<span class=\"syntax-comment\">// see exactly why it matches</span>"
    },
    "experiment": {
      "kind": "graph",
      "label": "breadth-first search"
    }
  },
  {
    "id": "ellmiott",
    "label": "ellmiott",
    "title": "ellmiott",
    "displayName": "ellmiott",
    "titleId": "ellmiott-title",
    "kind": "language-model lab",
    "description": "Build a small GPT and inspect tokens, attention, and next-character predictions.",
    "aliases": [],
    "search": "attention gpt model tokens prediction transformer ai",
    "image": {
      "src": "/assets/projects/ellmiott.jpg",
      "width": 1280,
      "height": 720,
      "alt": "ellmiott interactive browser demo"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/ellmiott/",
      "label": "inspect the model ↗",
      "ariaLabel": "Open ellmiott browser demo"
    },
    "source": "https://github.com/elliottbarnes/ellmiott",
    "preview": {
      "label": "text → tokens → attention → prediction",
      "html": ""
    }
  },
  {
    "id": "batchline",
    "label": "batchline",
    "title": "batchline",
    "displayName": "batchline",
    "titleId": "batchline-title",
    "kind": "inference infrastructure",
    "description": "Explore dynamic batching, bounded queues, and backpressure in a deterministic scheduling demo.",
    "aliases": [],
    "search": "batch batching queue backpressure inference scheduling",
    "image": {
      "src": "/assets/projects/batchline.jpg",
      "width": 1280,
      "height": 720,
      "alt": "batchline interactive browser demo"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/batchline/",
      "label": "shape the traffic ↗",
      "ariaLabel": "Open batchline browser demo"
    },
    "source": "https://github.com/elliottbarnes/batchline",
    "preview": {
      "label": "arrivals → queue → batch → response",
      "html": ""
    }
  },
  {
    "id": "evaldeck",
    "label": "evaldeck",
    "title": "evaldeck",
    "displayName": "evaldeck",
    "titleId": "evaldeck-title",
    "kind": "output contracts",
    "description": "Replay saved AI answers, inspect contract checks, and compare regressions against a baseline.",
    "aliases": [],
    "search": "evaluation eval contracts checks regressions baseline answers ai",
    "image": {
      "src": "/assets/projects/evaldeck.jpg",
      "width": 1280,
      "height": 720,
      "alt": "evaldeck interactive browser demo"
    },
    "demo": {
      "url": "https://elliottbarnes.github.io/evaldeck/",
      "label": "inspect the checks ↗",
      "ariaLabel": "Open evaldeck browser demo"
    },
    "source": "https://github.com/elliottbarnes/evaldeck",
    "preview": {
      "label": "fixtures → checks → baseline → regression",
      "html": ""
    }
  }
].map(project => Object.freeze(project)));
