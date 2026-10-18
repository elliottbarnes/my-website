import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/entrance-effects.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window });
const effects = window.PortfolioEntranceEffects;

// Record the visible drawing operations, including their canvas coordinates.
function surface() {
  const calls = { text: [], boxes: [], curves: [], lines: [], dots: [], fills: [], polygons: [] };
  let transform = { x: 0, y: 0, scale: 1 }, start = null, pathPoints = [];
  const saved = [];
  const point = (x, y) => ({ x: transform.x + x * transform.scale, y: transform.y + y * transform.scale });
  const context = {
    save() { saved.push({ ...transform }); },
    restore() { transform = saved.pop(); },
    translate(x, y) { transform.x += x * transform.scale; transform.y += y * transform.scale; },
    scale(x, y) { assert.equal(x, y); transform.scale *= x; },
    fillText(value, x, y) { calls.text.push({ value, color: this.fillStyle, alpha: this.globalAlpha, size: parseFloat(this.font) * transform.scale, ...point(x, y) }); },
    fillRect(x, y, width, height) { calls.fills.push({ ...point(x,y), width:width*transform.scale, height:height*transform.scale, color:this.fillStyle, alpha:this.globalAlpha }); },
    closePath() {},
    strokeRect(x, y, width, height) {
      calls.boxes.push({ ...point(x, y), width: width * transform.scale, height: height * transform.scale });
    },
    beginPath() { start = null; pathPoints = []; },
    moveTo(x, y) { start = point(x, y); pathPoints.push(start); },
    lineTo(x, y) { pathPoints.push(point(x,y)); calls.lines.push({ start, end: point(x, y), color: this.strokeStyle, alpha: this.globalAlpha }); },
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      calls.curves.push({ start, control1: point(x1, y1), control2: point(x2, y2), end: point(x, y) });
    },
    arc(x, y, radius) { calls.dots.push({ ...point(x, y), radius: radius * transform.scale, color:this.fillStyle, alpha:this.globalAlpha }); },
    stroke() {}, fill() { if (pathPoints.length > 2) calls.polygons.push({ points:[...pathPoints], color:this.fillStyle, alpha:this.globalAlpha }); },
  };
  return { context, calls };
}

function draw(kind, overrides = {}) {
  const { context, calls } = surface();
  const bounds = effects.draw(kind, {
    context, width: 348, height: 360, amount: 1, time: 1200,
    anchor: { x: .5, y: .5, sourceX: .3, sourceY: .4, text: "const value = 42;" },
    snippet: { repo: "glassbox", path: "docs/core.js", code: "const value = 42; // source comment" },
    ...overrides,
  });
  return { calls, bounds };
}

const sha = {
  root: "a123456" + "0".repeat(33),
  left: "b234567" + "0".repeat(33),
  right: "c345678" + "0".repeat(33),
  merge: "d456789" + "0".repeat(33),
};

test("history displays supplied commit hashes and connects their actual parent relationships", () => {
  const { calls } = draw("history", { history: [
    { sha: sha.merge, parents: [{ sha: sha.left }, { sha: sha.right }], message: "Merge experiment\nDetails" },
    { sha: sha.right, parents: [sha.root], message: "Right branch" },
    { sha: sha.left, parents: [sha.root], message: "Left branch" },
    { sha: sha.root, parents: [], message: "Initial source" },
  ] });
  const hashes = calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value));
  assert.deepEqual(hashes.map(entry => entry.value).sort(), Object.values(sha).map(value => value.slice(0, 7)).sort());
  assert.equal(calls.curves.length, 4, "a merge has two real parents, rather than an invented linear chain");
  const node = hash => {
    const label = hashes.find(entry => entry.value === hash.slice(0, 7));
    return calls.boxes.find(box => label.x >= box.x && label.x < box.x + box.width
      && label.y >= box.y && label.y <= box.y + box.height);
  };
  for (const [parent, child] of [[sha.root, sha.left], [sha.root, sha.right], [sha.left, sha.merge], [sha.right, sha.merge]]) {
    const from = node(parent), to = node(child);
    assert.ok(calls.curves.some(curve => curve.start.x === from.x + from.width && curve.start.y === from.y + from.height / 2
      && curve.end.x === to.x && curve.end.y === to.y + to.height / 2), "every drawn edge must end at its supplied child");
  }
  assert.ok(calls.text.some(entry => entry.value === "merge experiment"));
  assert.ok(calls.text.some(entry => entry.value === "glassbox/"));
  assert.ok(calls.text.some(entry => entry.value.includes("core.js")));
});

test("history does not imply ancestry for unrelated commits and marks omitted parents only with a stub", () => {
  const unrelated = draw("history", { history: [{ sha: sha.left }, { sha: sha.root }] });
  assert.equal(unrelated.calls.curves.length, 0);
  assert.equal(unrelated.calls.dots.length, 0);
  const omitted = draw("history", { history: [{ sha: sha.left, parents: [sha.root] }] });
  assert.equal(omitted.calls.curves.length, 1);
  assert.equal(omitted.calls.dots.length, 0, "an omitted parent should not receive a fabricated traveling commit");
  const edge = omitted.calls.curves[0];
  const commit = omitted.calls.boxes[0];
  assert.equal(edge.end.x, commit.x);
  assert.ok(edge.end.x - edge.start.x > 0 && edge.end.x - edge.start.x < commit.width,
    "the omitted parent should be a short continuation into the visible commit");
  assert.deepEqual(omitted.calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value)).map(entry => entry.value), [sha.left.slice(0, 7)]);
});

test("empty or malformed history falls back to pinned source without inventing commit hashes", () => {
  for (const history of [undefined, [], [{ sha: "not-a-commit", parents: [sha.root] }], [null]]) {
    const { calls } = draw("history", { history });
    assert.ok(calls.text.some(entry => entry.value === "commit-pinned source"));
    assert.equal(calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value)).length, 0);
    assert.equal(calls.curves.length, 0);
    assert.equal(calls.boxes.length, 0);
  }
});

test("compile sketches show real source tokens and identify each project's output", () => {
  for (const [repo, output] of [["glassbox", "wasm"], ["pixel-language", "glsl"], ["architecture-lab", "pixels"], ["automata-lab", "dfa"], ["other", "output"]]) {
    const { calls } = draw("tokens", {
      anchor: { text: "return 17;" },
      snippet: { repo, path: "src/example.js", code: "const visible = 42; // ignored" },
    });
    const labels = calls.text.map(entry => entry.value);
    assert.ok(labels.includes(output), `${repo} should identify its own illustrative output`);
    assert.ok(labels.includes("return"));
    assert.ok(labels.includes("17"));
    assert.ok(labels.includes("visible"));
    assert.equal(labels.includes("ignored"), false, "comment prose should not become a source token");
    assert.equal(labels.includes("undefined"), false);
  }
  assert.doesNotThrow(() => draw("tokens", { snippet: {}, anchor: {} }));
});

test("effects stay within a narrow mobile canvas while expanding from taps near its edges", () => {
  for (const kind of ["history", "tokens"]) {
    for (const width of [320, 348, 390]) {
      const height = 280;
      for (const amount of [0, .08, .2, .5, .8, 1]) {
        for (const corner of [0, 1]) {
          const { calls, bounds } = draw(kind, {
            width, height, amount,
            anchor: { x: corner, y: corner, sourceX: corner, sourceY: corner, text: "const x = 42;" },
            history: [{ sha: sha.left, parents: [sha.root] }, { sha: sha.root, parents: [] }],
          });
          assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= width && bounds.bottom <= height,
            `${kind} reveal must fit ${width}px at amount ${amount}`);
          for (const box of calls.boxes) {
            assert.ok(box.x >= bounds.left && box.y >= bounds.top && box.x + box.width <= bounds.right + .001 && box.y + box.height <= bounds.bottom + .001);
          }
          for (const label of calls.text) {
            assert.ok(Number.isFinite(label.x) && Number.isFinite(label.y));
            assert.ok(label.x >= bounds.left && label.x <= bounds.right && label.y >= bounds.top && label.y <= bounds.bottom);
          }
        }
      }
    }
  }
});

test("unsupported effects and unavailable canvases are harmless", () => {
  assert.equal(effects.draw("history", {}), null);
  assert.equal(effects.draw("history", { context: surface().context, width: 0, height: 360 }), null);
  assert.equal(draw("unknown").bounds, null);
});

test("source glyphs travel into effect text and return toward their original cells", () => {
  const glyphs = [{ glyph: "=", x: 45, y: 24, size: 12 }];
  const history = [{ sha: "abcdef1234567890", parents: [], message: "initial source" }];
  const opening = draw("history", { glyphs, history, amount: .02 });
  const settled = draw("history", { glyphs, history, amount: 1 });
  const returning = draw("history", { glyphs, history, amount: .001 });
  assert.equal(opening.calls.text[0].value, "=");
  assert.equal(settled.calls.text[0].value, "g");
  assert.equal(returning.calls.text[0].value, "=");
  assert.ok(Math.hypot(returning.calls.text[0].x - 45, returning.calls.text[0].y - 24) < .01);
  assert.ok(Math.hypot(settled.calls.text[0].x - 45, settled.calls.text[0].y - 24) > 20);
});

test("a commit can be picked where it is drawn, including after pulling the graph", () => {
  const history = [{ sha: sha.left, parents: [sha.root], message: "later source" },
    { sha: sha.root, parents: [], message: "initial source" }];
  for (const width of [320, 800]) {
    for (const pull of [{ x: 0, y: 0 }, { x: 40, y: -30 }, { x: -40, y: 30 }]) {
      const args = { width, height: 360, amount: 1, anchor: { x: .5, y: .5 }, history, pull };
      const { calls } = draw("history", args);
      for (const label of calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value))) {
        const picked = effects.pick("history", args, label.x + 10, label.y + 20);
        assert.equal(picked.sha.slice(0, 7), label.value, "the padded 44px target follows the visible node");
      }
      assert.equal(effects.pick("history", args, 0, 0), null);
      assert.equal(effects.pick("history", { ...args, amount: .1 }, 100, 100), null,
        "moving glyphs are not yet settled targets");
    }
  }
  assert.equal(effects.pick("tokens", {}, 10, 10), null);
});

test("selecting an earlier commit shows its own subject without changing the real ancestry", () => {
  const history = [{ sha: sha.left, parents: [sha.root], message: "later source" },
    { sha: sha.root, parents: [], message: "initial source" }];
  const selected = draw("history", { history, selectedCommit: sha.root });
  assert.ok(selected.calls.text.some(entry => entry.value === "initial source"));
  assert.equal(selected.calls.text.some(entry => entry.value === "later source"), false);
  assert.equal(selected.calls.curves.length, 1);
  const fallback = draw("history", { history, selectedCommit: "unknown" });
  assert.ok(fallback.calls.text.some(entry => entry.value === "later source"));
});

test("short history keeps hashes, source path, and selected subject in distinct readable bands", () => {
  const history = [
    { sha: sha.merge, parents: [sha.right], message: "selected commit introduces a longer public source explanation for the project history and its inspectable implementation" },
    { sha: sha.right, parents: [sha.left], message: "right branch" },
    { sha: sha.left, parents: [sha.root], message: "left branch" },
    { sha: sha.root, parents: [], message: "initial source" },
  ];
  for (const height of [110, 166]) {
    for (const width of [320, 800]) {
      for (const pull of [{ x: 0, y: 0 }, { x: 40, y: -40 }]) {
        const args = { width, height, amount: 1, anchor: { x: .5, y: .5 }, history, pull };
        const { calls, bounds } = draw("history", args);
        const hashes = calls.text.filter(entry => /^[0-9a-f]{7}$/i.test(entry.value));
        const sourcePath = calls.text.find(entry => entry.value.startsWith("glassbox/"));
        const subjects = calls.text.filter(entry => !hashes.includes(entry) && !["git log --oneline", "head"].includes(entry.value) && entry !== sourcePath);
        assert.equal(hashes.length, 4);
        assert.equal(new Set(hashes.map(entry => entry.y)).size, 1, "short history uses a single hash row");
        assert.ok(calls.boxes.every(box => box.y + box.height < sourcePath.y - sourcePath.size / 2), "the path must remain below the hash row");
        assert.ok(subjects.every(entry => entry.y - entry.size / 2 > sourcePath.y + sourcePath.size / 2), "subjects must remain below the path");
        assert.equal(subjects.length, height === 110 ? 1 : 2);
        for (const label of calls.text) {
          assert.ok(label.size >= 9, "compact layouts keep a readable font size");
          assert.ok(label.y - label.size / 2 >= bounds.top && label.y + label.size / 2 <= bounds.bottom, "settled text fits the visible canvas");
        }
        for (const label of hashes) {
          assert.equal(effects.pick("history", args, label.x + 10, label.y)?.sha.slice(0, 7), label.value, "compact hashes retain their visible hit targets");
        }
      }
    }
  }
});

test("short compile sketches show only rows that fit between labels and the source footer", () => {
  for (const height of [110, 166]) {
    const { calls, bounds } = draw("tokens", { height });
    const footer = calls.text.find(entry => entry.value === "docs/core.js");
    const headers = calls.text.filter(entry => ["source", "tokens", "wasm"].includes(entry.value));
    assert.equal(headers.length, 3);
    assert.equal(calls.boxes.length, height === 110 ? 3 : 9, "short layouts contain only complete token rows");
    for (const box of calls.boxes) {
      assert.ok(box.y > headers[0].y + headers[0].size / 2);
      assert.ok(box.y + box.height < footer.y - footer.size / 2, "token boxes cannot collide with the footer");
    }
    for (const label of calls.text) {
      assert.ok(label.size >= 9);
      assert.ok(label.y - label.size / 2 >= bounds.top && label.y + label.size / 2 <= bounds.bottom);
    }
  }
});

test('algorithm sketches remain bounded and finite on desktop and mobile over their full cycles', () => {
  for (const kind of ['sort', 'automaton', 'graph']) for (const width of [280, 740]) for (const time of [0, 650, 4800, 12600, 20000]) {
    const { calls, bounds } = draw(kind, { width, height: 260, time });
    assert.ok(bounds.left >= 0 && bounds.right <= width);
    assert.ok(bounds.top >= 0 && bounds.bottom <= 260);
    assert.ok(calls.text.length >= (kind === 'automaton' ? 4 : 10));
    for (const point of [...calls.text, ...calls.dots]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= bounds.left - 1 && point.x <= bounds.right + 1);
      assert.ok(point.y >= bounds.top && point.y <= bounds.bottom);
    }
  }
});
test('algorithm sketches use their originating source glyphs during the transition', () => {
  for (const kind of ['sort', 'automaton', 'graph']) {
    const { calls } = draw(kind, { amount: 0, glyphs: [{ glyph: 'X', x: 30, y: 50, size: 10 }] });
    assert.ok(calls.text.some(p => p.value === 'X' && Math.abs(p.x - 30) < .01));
  }
});


test("interference stays finite and bounded at pointer extremes on narrow and short canvases", () => {
  for (const width of [260, 348, 740]) for (const height of [180, 320]) for (const time of [0, 1200, 8300]) for (const pointer of [-1, 1]) {
    const { calls, bounds } = draw("interference", { width, height, time, pointerX: pointer, pointerY: pointer });
    assert.ok(calls.text.length <= 1500);
    assert.ok(calls.lines.length <= 4000);
    assert.ok(calls.polygons.length <= 1100);
    const expected = effects.bounds("interference", {width,height,amount:1,anchor:{x:.5,y:.5}});
    for (const key of ["left","right","top","bottom"]) assert.equal(bounds[key], expected[key]);
    for (const p of [...calls.text, ...calls.dots]) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= bounds.left && p.x <= bounds.right);
      assert.ok(p.y >= bounds.top && p.y <= bounds.bottom);
    }
  }
});
test("interference reacts to pointer spacing and carries real source glyphs during formation", () => {
  const first = draw("interference", {time:1200,pointerX:-1,pointerY:-1});
  const next = draw("interference", {time:1200,pointerX:1,pointerY:1});
  assert.notDeepEqual(first.calls.text, next.calls.text);
  const {calls} = draw("interference", {amount:0,glyphs:[{glyph:'X',x:30,y:50,size:10}]});
  assert.ok(calls.text.some(p=>p.value==='X' && Math.abs(p.x-30)<.01 && Math.abs(p.y-50)<.01));
});

test('sorting moves compared values continuously and lands in the next trace state', () => {
  const x = (time, value) => draw('sort', {time}).calls.text.find(p=>p.value===String(value)).x;
  assert.ok(x(85,7)>x(0,7) && x(85,7)<x(160,7));
  assert.ok(x(85,2)<x(0,2) && x(85,2)>x(160,2));
  assert.equal(x(160,7),x(165,7)); assert.equal(x(160,2),x(165,2));
});
test('graph traversal sends its pulse along an edge instead of teleporting between nodes', () => {
  const head = time => draw('graph',{time,highlight:'pulse'}).calls.dots.find(p=>p.radius===3.5&&p.color==='pulse');
  assert.ok(head(900).x>head(650).x);
  assert.ok(head(900).y<head(650).y);
});

test('sort finishes during a normal effect appearance and holds every value in its settled state', () => {
  for (const time of [4620, 5000, 6100]) {
    const { calls } = draw('sort', { time, accent: 'settled' });
    const values = calls.text.filter(p => /^[1-8]$/.test(p.value)).sort((a, b) => a.x - b.x);
    assert.deepEqual(values.map(p => Number(p.value)), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(values.every(p => p.color === 'settled'));
    assert.ok(calls.text.some(p => p.value === 'complete / every value in order'));
  }
  const initial = draw('sort', { time: 6200 }).calls.text.filter(p => /^[1-8]$/.test(p.value)).sort((a,b) => a.x-b.x);
  assert.deepEqual(initial.map(p => Number(p.value)), [7, 2, 8, 4, 1, 6, 3, 5]);
});

test('rule 110 renders filled cells from one seed and applies the actual three-neighbour rule', () => {
  for (const width of [280, 740]) {
    const opts = {width,accent:'live',highlight:'new',muted:'dead'};
    const fieldCells = frame => frame.calls.fills.filter(p => p.y >= frame.bounds.top + 87 && Math.abs(p.width-p.height)<.001 && ['live','new','dead'].includes(p.color));
    const first = draw('automaton', {...opts,time:0});
    const seed = fieldCells(first).filter(p=>p.color!=='dead');
    assert.equal(seed.length,1);
    assert.ok(seed[0].x>first.bounds.left&&seed[0].x<first.bounds.right);
    const frame = draw('automaton', {...opts,time:405}), cells = fieldCells(frame);
    const levels=[...new Set(cells.map(p=>p.y))].sort((a,b)=>a-b);
    assert.equal(levels.length,4);
    for(let row=1;row<levels.length;row++) {
      const previous=cells.filter(p=>p.y===levels[row-1]).sort((a,b)=>a.x-b.x);
      const current=cells.filter(p=>p.y===levels[row]).sort((a,b)=>a.x-b.x);
      for(let x=0;x<current.length;x++) {
        const alive=index=>previous[(index+previous.length)%previous.length].color!=='dead'?1:0;
        const pattern=(alive(x-1)<<2)|(alive(x)<<1)|alive(x+1);
        assert.equal(current[x].color!=='dead',Boolean((110>>pattern)&1));
      }
    }
  }
});

test('breadth-first search displays a FIFO frontier and highlights only actual parent edges', () => {
  const expected = ['B C', 'C D E', 'D E F', 'E F G', 'F G H', 'G H', 'H', ''];
  for (const [step, queue] of expected.entries()) {
    const { calls } = draw('graph', { time: step * 560, accent: 'tree', muted: 'other' });
    assert.ok(calls.text.some(p => p.value.startsWith(`queue [${queue}]`)));
    const tree = calls.lines.filter(p => p.color === 'tree');
    assert.equal(tree.length, [2, 4, 5, 6, 7, 7, 7, 7][step]);
  }
  for (const time of [4480, 5500, 6199]) {
    const { calls } = draw('graph', { time, accent: 'tree', muted: 'other' });
    assert.ok(calls.text.some(p => p.value === 'queue [] / traversal complete'));
    assert.equal(calls.lines.filter(p => p.color === 'tree').length, 7);
    assert.equal(calls.lines.filter(p => p.color === 'other').length, 3, 'cross edges never become invented discovery edges');
    assert.equal(calls.text.filter(p => p.value === '◆').length, 0);
  }
});

test('algorithm sketches retain readable labels on compact canvases', () => {
  for (const kind of ['sort', 'automaton', 'graph']) for (const height of [110, 166, 260]) for (const time of [0, 1500, 4800, 7000]) {
    const { calls, bounds } = draw(kind, { height, time, width: 280 });
    for (const label of calls.text) {
      assert.ok(Number.isFinite(label.x) && Number.isFinite(label.y));
      assert.ok(label.y - label.size / 2 >= bounds.top && label.y + label.size / 2 <= bounds.bottom);
    }
  }
});

test('compile sketch recognizes source keywords and keeps its pulse between token cells', () => {
  const { calls } = draw('tokens', { time: 0, anchor: { text: 'return 17;' } });
  assert.ok(calls.text.some(p => p.value === 'keyword'));
  assert.equal(calls.dots.length, 1, 'only the current token gets a traveling pulse');
  const dot = calls.dots[0], row = calls.boxes.filter(p => Math.abs(p.y + p.height / 2 - dot.y) < .001);
  assert.equal(row.length, 3);
  assert.ok(dot.x >= row[0].x + row[0].width && dot.x <= row[1].x);
});

test('optional effect modules share source-glyph helpers and fail harmlessly when unavailable', () => {
  const kinds = { PortfolioSignalEffects: ['fourier', 'attractor', 'phyllotaxis'], PortfolioStructureEffects: ['pathfinding', 'quadtree', 'convolution'] };
  for (const [name, group] of Object.entries(kinds)) {
    for (const kind of group) {
      assert.equal(draw(kind).bounds, null);
      const bounds = effects.bounds(kind, { width: 348, height: 360, amount: 1 });
      assert.equal(bounds.h, 320);
    }
    const used = [];
    window[name] = { draw(kind, args, helpers) {
      used.push(kind);
      const box = helpers.layout(args, 320), ctx = helpers.begin(args, box);
      helpers.text(ctx, 'target', 20, 30, 'ink', args.amount);
      ctx.restore();
      assert.deepEqual(Object.keys(helpers).sort(), ['begin', 'carry', 'clamp', 'dot', 'layout', 'segment', 'smooth', 'text']);
      return box;
    } };
    for (const kind of group) {
      const { calls, bounds } = draw(kind, { amount: 0, glyphs: [{ glyph: 'X', x: 30, y: 50, size: 10 }] });
      assert.ok(bounds);
      assert.ok(calls.text.some(p => p.value === 'X' && Math.abs(p.x - 30) < .01 && Math.abs(p.y - 50) < .01));
    }
    assert.deepEqual(used, group);
    delete window[name];
  }
});

test('refined diagrams use substantial geometry with readable titles at the 330px internal mobile width', () => {
  for (const kind of ['tokens','sort','graph','automaton','interference']) {
    const {calls,bounds}=draw(kind,{width:354,height:350,time:1500});
    assert.equal(bounds.right-bounds.left,330); assert.equal(bounds.bottom-bounds.top,320);
    const titlePrefix={tokens:'source →',sort:'bubble sort',graph:'breadth-first',automaton:'rule 110',interference:'wave interference'}[kind];
    const title=calls.text.find(p=>p.value.startsWith(titlePrefix));
    assert.ok(title&&title.size>=10, `${kind} title is readable`);
    if(kind==='tokens') assert.ok(calls.fills.filter(p=>p.height>=20&&p.width>=60).length>=12,'pipeline has filled token cells');
    if(kind==='sort') assert.equal(calls.boxes.filter(p=>p.height>10).length,8,'each data value has a real bar');
    if(kind==='graph') { assert.ok(calls.dots.filter(p=>p.radius>=14).length>=8,'vertices are substantial connected nodes'); assert.ok(calls.boxes.length>=1,'frontier has real FIFO cells'); }
    if(kind==='automaton') assert.ok(calls.fills.length>200,'cellular field is made of filled cells');
    if(kind==='interference') assert.ok(calls.polygons.length>500,'interference is a shaded surface');
    assert.ok(!calls.text.some(p=>['▰','■','▪','·','◆'].includes(p.value)&&p.alpha>0),'settled geometry does not remain a punctuation sketch');
  }
});

test('geometric scenes, short fallbacks and advertised drag bounds agree without escaping their panel', () => {
  for(const kind of ['tokens','sort','graph','automaton','interference']) for(const width of [280,354,760]) for(const height of [166,350]) for(const time of [0,1500,4800]) {
    const args={width,height,time,amount:1,anchor:{x:.9,y:.1},pull:{x:40,y:-20}};
    const {calls,bounds}=draw(kind,args), advertised=effects.bounds(kind,args);
    for(const key of ['left','right','top','bottom']) assert.equal(bounds[key],advertised[key]);
    for(const rect of [...calls.boxes,...calls.fills]) {
      assert.ok(rect.width>0&&rect.height>0);
      assert.ok(rect.x>=bounds.left-.001&&rect.x+rect.width<=bounds.right+.001,`${kind} horizontal bounds`);
      assert.ok(rect.y>=bounds.top-.001&&rect.y+rect.height<=bounds.bottom+.001,`${kind} vertical bounds`);
    }
    for(const polygon of calls.polygons) for(const p of polygon.points) {
      assert.ok(p.x>=bounds.left-.001&&p.x<=bounds.right+.001&&p.y>=bounds.top-.001&&p.y<=bounds.bottom+.001,`${kind} polygon bounds`);
    }
  }
});

test('solid geometry fades away before glyphs return to source cells', () => {
  for(const kind of ['tokens','sort','graph','automaton','interference']) {
    const source={glyph:'X',x:30,y:50,size:12};
    const closing=draw(kind,{amount:.001,glyphs:[source],width:354,height:350});
    assert.ok(closing.calls.text.some(p=>p.value==='X'&&Math.hypot(p.x-source.x,p.y-source.y)<.01));
    assert.equal(closing.calls.fills.length,0);
    assert.equal(closing.calls.polygons.length,0);
  }
});
