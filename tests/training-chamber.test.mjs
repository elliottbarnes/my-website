import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trainingHarness } from "./helpers/training-harness.mjs";

const engineSource = await readFile(new URL("../assets/brick-breaker.js", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../assets/training-chamber.js", import.meta.url), "utf8");
const chamber = options => trainingHarness({ engineSource, uiSource, ...options });
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} should be within ${tolerance} of ${expected}`);
const pointer = (page, type, pointerId = 1, clientX = 100, extra = {}) => page.canvas.emit(type, {
  pointerId, clientX, clientY: 300, ...extra,
});
const key = (page, type, value) => page.document.emit(type, { key: value, target: page.canvas });
const frameText = page => page.drawing.filter(call => call.method === "fillText").map(call => call.args[0]);
// Font state cannot affect geometry; retain it only on text when comparing a
// fresh canvas with one that has already painted an earlier round.
const frameDrawing = page => JSON.stringify(page.drawing.map(({ font, ...call }) =>
  call.method === "fillText" ? { ...call, font } : call));

function flight(page) {
  page.open();
  page.action.emit("click");
  // Keep the path clear of bricks and walls, so these checks measure the
  // controller's display clock rather than collision geometry.
  Object.assign(page.state.ball, { x: 100, y: 320, vx: 80, vy: -60, speed: 100 });
  page.displayFrame(0);
}

test("pulse is available through the native button and Space, with repeat and pause protection", () => {
  for (const source of ["button", "keyboard"]) {
    const page = chamber(); flight(page);
    assert.equal(page.action.disabled, false);
    if (source === "button") page.action.emit("click"); else key(page, "keydown", " ");
    assert.ok(page.state.pulseUntil > page.state.time);
    assert.equal(page.action.disabled, true);
    const until = page.state.pulseUntil;
    page.document.emit("keydown", { key: " ", target: page.canvas, repeat: true });
    assert.equal(page.state.pulseUntil, until);
    page.pause.emit("click");
    assert.equal(page.state.pulseUntil, 0, "pause cancels an armed window");
    page.pause.emit("click");
    assert.equal(page.state.pulseUntil, 0, "resume cannot recover a cancelled pulse");
  }
});

test("finished runs keep bounded personal records and ignore invalid or unavailable storage", () => {
  const recordKey = "portfolio:breaker:pulse-v1";
  for (const invalid of ["not json", "null", JSON.stringify({version:1,score:999,time:0,chain:2}), JSON.stringify({version:1,score:999,time:20,chain:-1}), "x".repeat(513)]) {
    const page = chamber({storage:new Map([[recordKey,invalid]])}); page.open();
    assert.doesNotMatch(page.status.textContent, /Best 999/);
    page.action.emit("click");
    page.state.score = 10; page.state.time = 12; page.state.bestChain = 2; page.state.perfects = 3;
    page.window.emit("portfolio:preferences");
    assert.equal(page.storage.get(recordKey), invalid, "ongoing games do not write records");
    page.state.phase = "lost"; page.displayFrame(16);
    const record = JSON.parse(page.storage.get(recordKey));
    assert.equal(record.score, 150); assert.equal(record.chain, 2);
    assert.match(page.status.textContent, /New personal best/);
    page.api.close(); page.open();
    assert.match(page.status.textContent, /Best 150/);
    page.action.emit("click");
    page.state.score = 5; page.state.time = 12; page.state.bestChain = 4; page.state.phase = "lost";
    page.displayFrame(32);
    const next = JSON.parse(page.storage.get(recordKey));
    assert.equal(next.score, 150); assert.equal(next.chain, 4);
  }
  const blocked = chamber({storageBlocked:true}); blocked.open(); blocked.action.emit("click");
  blocked.state.score = 10; blocked.state.time = 12; blocked.state.phase = "lost";
  assert.doesNotThrow(()=>blocked.displayFrame(16));
  assert.match(blocked.status.textContent, /150 power/);
});

test("a failed record write retains the session best and newer stored bests are merged", () => {
  const recordKey = "portfolio:breaker:pulse-v1";
  const storage = new Map([[recordKey,JSON.stringify({version:1,score:1000,chain:2,time:60})]]);
  const page = chamber({storage,storageWriteBlocked:true}); page.open(); page.action.emit("click");
  page.state.score = 100; page.state.time = 30; page.state.bestChain = 3; page.state.phase = "lost";
  page.displayFrame(16);
  assert.match(page.status.textContent,/New personal best/);
  page.api.close(); page.open();
  assert.match(page.status.textContent,/Best 1500/);
  page.action.emit("click"); page.state.score = 90; page.state.time = 40; page.state.phase = "lost";
  page.displayFrame(32);
  assert.doesNotMatch(page.status.textContent,/New personal best/);
  assert.match(page.status.textContent,/Best 1500/);
  storage.set(recordKey,JSON.stringify({version:1,score:2000,chain:5,time:20}));
  page.api.close(); page.open();
  assert.match(page.status.textContent,/Best 2000/);
});

test("training artwork waits for entry, then loads only once across reopening", () => {
  const page = chamber();
  assert.equal(page.requests.length, 0, "a visitor who never opens the game does not request its artwork");
  assert.equal(page.images.length, 0);
  page.open();
  assert.deepEqual([...page.requests].sort(), [
    ...Array.from({ length: 7 }, (_, index) => `/assets/dragon-ball-${index + 1}.webp`),
    "/assets/training-arena.webp",
  ].sort());
  assert.ok(page.images.every(image => image.decoding === "async"));
  page.api.close();
  page.open();
  assert.equal(page.requests.length, 8, "reopening reuses the first set of artwork");
});

test("the game starts with fallback balls while sprites load, and late loads respect closure", () => {
  const page = chamber();
  page.open();
  assert.ok(page.paints > 0, "the ready board appears before image loading completes");
  assert.ok(!page.drawing.some(call => call.method === "drawImage"));
  page.action.emit("click");
  assert.equal(page.state.phase, "playing", "sprite loading does not block launching the ball");
  assert.equal(page.pendingFrames, 1);
  const sprite = page.images.find(image => image.url === "/assets/dragon-ball-1.webp");
  sprite.load();
  assert.ok(page.drawing.some(call => call.method === "drawImage" && call.args[0] === sprite));
  page.api.close();
  const before = page.paints;
  for (const image of page.images.filter(image => image !== sprite)) image.load();
  assert.equal(page.paints, before, "late sprite and arena loads must not redraw a closed game");
  assert.equal(page.pendingFrames, 0);
});

test("failed artwork leaves the board playable with a complete canvas fallback", () => {
  const page = chamber();
  page.open();
  for (const image of page.images) image.fail();
  page.window.emit("portfolio:preferences");
  assert.ok(!page.drawing.some(call => call.method === "drawImage"), "failed images must not be drawn");
  assert.ok(page.drawing.some(call => call.method === "roundRect"), "shield and paddle geometry remains visible");
  assert.ok(frameText(page).includes("master the return"));
  page.action.emit("click");
  page.displayFrame(100);
  assert.equal(page.state.phase, "playing");
  assert.ok(page.state.time > 0, "artwork failures must not block the simulation");
  assert.equal(page.pendingFrames, 1);
});

test("late arena artwork covers the board without resuming a paused game", () => {
  const page = chamber();
  page.open();
  page.pause.emit("click");
  const state = JSON.stringify(page.snapshot());
  const arena = page.images.find(image => image.url === "/assets/training-arena.webp");
  arena.load();
  const image = page.drawing.find(call => call.method === "drawImage" && call.args[0] === arena);
  assert.ok(image, "successful arena loading replaces the fallback backdrop");
  const [, x, y, width, height] = image.args;
  assert.ok([x, y, width, height].every(Number.isFinite));
  assert.ok(x <= 0 && y <= 0 && x + width >= page.state.width && y + height >= page.state.height,
    "the backdrop must cover the board at its different aspect ratio");
  assert.equal(JSON.stringify(page.snapshot()), state);
  assert.equal(page.pendingFrames, 0);
  assert.equal(page.pause.getAttribute("aria-pressed"), "true");
});

test("completed training results survive blur and hidden-tab changes", () => {
  for (const phase of ["clear", "won", "lost"]) {
    const page = chamber();
    page.open();
    page.state.phase = phase;
    page.images[0].load();
    const title = phase === "clear" ? "arena cleared" : phase === "won" ? "wish granted" : "another round?";
    assert.ok(frameText(page).includes(title));
    page.window.emit("blur");
    page.document.hidden = true;
    page.document.emit("visibilitychange");
    page.images[1].load();
    assert.ok(frameText(page).includes(title), "completion must not become a paused overlay");
    assert.notEqual(page.status.textContent, "training paused");
    assert.equal(page.pendingFrames, 0);
  }
});

test("continuing a cleared arena keeps the score and waits for a fresh launch", () => {
  const page = chamber(); page.open();
  page.state.phase = "clear"; page.state.score = 665; page.state.lives = 2;
  page.state.collected = [1, 2, 3, 4, 5, 6, 7];
  page.window.emit("portfolio:preferences");
  key(page, "keydown", " ");
  assert.equal(page.state.wave, 2);
  assert.equal(page.state.score, 665);
  assert.equal(page.state.lives, 3);
  assert.equal(page.state.phase, "ready");
  assert.equal(page.pendingFrames, 0);
  assert.equal(page.state.collected.length, 0);
  assert.match(page.status.textContent, /Nova/);
  page.document.emit("keydown", { key: " ", target: page.canvas, repeat: true });
  assert.equal(page.state.phase, "ready", "holding Space through the intermission cannot launch");
  key(page, "keyup", " "); key(page, "keydown", " ");
  assert.equal(page.state.phase, "playing");
  assert.equal(page.pendingFrames, 1);
});

test("an old arrow-key repeat cannot restore a hold cleared by pause or restart", () => {
  const page = chamber(); page.open();
  key(page, "keydown", "ArrowRight");
  page.pause.emit("click"); page.pause.emit("click");
  let x = page.state.paddle.x;
  page.document.emit("keydown", { key: "ArrowRight", target: page.canvas, repeat: true });
  page.displayFrame(200);
  assert.equal(page.state.paddle.x, x);
  key(page, "keydown", "ArrowRight");
  assert.ok(page.state.paddle.x > x, "a fresh press still works");
  page.state.phase = "lost"; page.action.emit("click");
  x = page.state.paddle.x;
  page.document.emit("keydown", { key: "ArrowRight", target: page.canvas, repeat: true });
  page.displayFrame(220);
  assert.equal(page.state.paddle.x, x, "restart cannot inherit the old hold");
});

test("mouse, pen, and touch drag from the existing paddle without jumping to the press", () => {
  for (const pointerType of ["mouse", "pen", "touch"]) {
    const page = chamber({ cssWidth: 240 });
    page.open();
    const initial = page.state.paddle.x;
    pointer(page, "pointerdown", 1, 70, { pointerType });
    assert.equal(page.state.paddle.x, initial, pointerType);
    assert.ok(page.canvas.hasPointerCapture(1));
    pointer(page, "pointermove", 1, 110, { pointerType });
    close(page.state.paddle.x, initial + 40 / 240 * page.state.width);
    pointer(page, "pointerup", 1, 110, { pointerType });
    assert.equal(page.state.phase, "ready", "a drag must not also launch the ball");
    assert.equal(page.canvas.hasPointerCapture(1), false);
  }
});

test("secondary pointer cancellation and capture loss leave the primary drag intact", () => {
  for (const ending of ["pointercancel", "lostpointercapture"]) {
    const page = chamber();
    page.open();
    const initial = page.state.paddle.x;
    pointer(page, "pointerdown", 1, 100);
    pointer(page, "pointerdown", 2, 130, { isPrimary: false });
    pointer(page, ending, 2, 130, { isPrimary: false });
    pointer(page, "pointermove", 1, 140);
    assert.equal(page.state.paddle.x, initial + 40, ending);
    assert.ok(page.canvas.hasPointerCapture(1), ending);
    pointer(page, "pointerup", 1, 140);
  }
});

test("primary cancellation or capture loss ends dragging without launching", () => {
  for (const ending of ["pointercancel", "lostpointercapture"]) {
    const page = chamber();
    page.open();
    pointer(page, "pointerdown", 1, 100);
    pointer(page, "pointermove", 1, 130);
    if (ending === "lostpointercapture") page.canvas.releasePointerCapture(1);
    else pointer(page, ending);
    const stopped = page.state.paddle.x;
    pointer(page, "pointermove", 1, 230);
    pointer(page, "pointerup", 1, 230);
    assert.equal(page.state.paddle.x, stopped);
    assert.equal(page.state.phase, "ready");
    assert.equal(page.canvas.hasPointerCapture(1), false);
  }
});

test("pause, backgrounding, and resize release old input before resuming", () => {
  for (const ending of ["pause", "blur", "visibilitychange", "pagehide", "resize"]) {
    const page = chamber();
    page.open();
    pointer(page, "pointerdown", 1, 100);
    pointer(page, "pointermove", 1, 120);
    if (ending === "pause") page.pause.emit("click");
    else if (ending === "visibilitychange") {
      page.document.hidden = true;
      page.document.emit(ending);
    } else {
      if (ending === "resize") page.setBounds({ width: 300, height: 400 });
      page.window.emit(ending);
    }
    assert.equal(page.canvas.hasPointerCapture(1), false, ending);
    const stopped = page.state.paddle.x;
    page.document.hidden = false;
    if (page.pause.getAttribute("aria-pressed") === "true") page.pause.emit("click");
    pointer(page, "pointermove", 1, 240);
    pointer(page, "pointerup", 1, 240);
    assert.equal(page.state.paddle.x, stopped, `${ending}: stale movement must wait for a fresh press`);
    assert.equal(page.state.phase, "ready", `${ending}: stale release must not launch`);
  }
});

test("tapping a paused ready board neither launches nor resumes it", () => {
  for (const pointerType of ["mouse", "pen", "touch"]) {
    const page = chamber();
    page.open();
    assert.equal(page.action.disabled, false);
    page.pause.emit("click");
    assert.equal(page.action.disabled, true, "a paused board must not advertise an enabled release action");
    pointer(page, "pointerdown", 1, 100, { pointerType });
    pointer(page, "pointerup", 1, 100, { pointerType });
    assert.equal(page.state.phase, "ready", pointerType);
    assert.equal(page.pause.getAttribute("aria-pressed"), "true", pointerType);
    assert.equal(page.canvas.hasPointerCapture(1), false, pointerType);
    assert.equal(page.pendingFrames, 0);
    key(page, "keydown", " ");
    assert.equal(page.state.phase, "ready", "space must respect the same explicit pause");
    page.pause.emit("click");
    assert.equal(page.action.disabled, false, "resuming restores the ready action");
  }
});

test("a pointer release consumes its final position and cannot mistake an undelivered drag for a tap", () => {
  for (const intermediate of [false, true]) {
    const page = chamber();
    page.open();
    pointer(page, "pointerdown", 1, 100);
    if (intermediate) pointer(page, "pointermove", 1, 120);
    pointer(page, "pointerup", 1, 140);
    close(page.state.paddle.x, 220);
    assert.equal(page.state.phase, "ready");
    assert.equal(page.canvas.hasPointerCapture(1), false);
  }
});

test("releasing one arrow continues ready-state movement from the other held arrow", () => {
  for (const [held, released, sign] of [["ArrowLeft", "ArrowRight", -1], ["ArrowRight", "ArrowLeft", 1]]) {
    const page = chamber();
    page.open();
    key(page, "keydown", held);
    key(page, "keydown", released);
    key(page, "keyup", released);
    assert.equal(page.pendingFrames, 1, held);
    const before = page.state.paddle.x;
    page.displayFrame(0);
    page.displayFrame(50);
    assert.ok((page.state.paddle.x - before) * sign > 8, held);
    key(page, "keyup", held);
    assert.equal(page.pendingFrames, 0, "releasing the final key stops idle movement");
  }
});

test("30, 60, and 120 Hz displays advance the same flight using fixed physics steps", () => {
  const positions = [];
  for (const rate of [30, 60, 120]) {
    const page = chamber();
    flight(page);
    for (let frame = 1; frame <= rate; frame++) page.displayFrame(frame * 1000 / rate);
    close(page.state.time, 1, 1 / 120 + 1e-8);
    assert.ok(page.engineSteps.length >= 119);
    for (const step of page.engineSteps) close(step.requestedSeconds, 1 / 120);
    positions.push({ x: page.state.ball.x, y: page.state.ball.y });
  }
  for (const position of positions) {
    close(position.x, 180, .7);
    close(position.y, 260, .6);
  }
});

test("timestamped keys retain their duration across display rates and a stall spanning release", () => {
  const endpoints = [];
  const inputs = [{ at: 223, type: "keydown", key: "ArrowRight" }, { at: 557, type: "keyup", key: "ArrowRight" },
    { at: 811, type: "keydown", key: "ArrowLeft" }, { at: 1063, type: "keyup", key: "ArrowLeft" }];
  for (const rate of [20, 30, 60, 120]) for (const stalled of [false, true]) {
    const page = chamber();
    flight(page);
    const frames = Array.from({ length: Math.round(2.5 * rate) }, (_, index) => (index + 1) * 1000 / rate)
      .filter(at => !stalled || at <= 500 + 1e-7 || at >= 600 - 1e-7);
    const events = [...inputs.map(event => ({ at: event.at, event })), ...frames.map(at => ({ at }))]
      .sort((a, b) => a.at - b.at || Number(!a.event) - Number(!b.event));
    for (const entry of events) entry.event ? page.input(entry.event) : page.displayFrame(entry.at);
    endpoints.push(page.state.paddle.x);
    const continuousOracle = 180 + 330 * ((557 - 223) - (1063 - 811)) / 1000;
    close(page.state.paddle.x, continuousOracle, 330 / 120);
    close(page.state.time, 2.5, 1 / 120);
  }
  close(Math.max(...endpoints) - Math.min(...endpoints), 0);
});

test("a timestamped drag just before paddle contact has the same return across dropped display frames", () => {
  const outcomes = [];
  for (const rate of [20, 30, 60, 120]) for (const stalled of [false, true]) {
    const page = chamber();
    flight(page);
    Object.assign(page.state.ball, { x: 210, y: 286.2, vx: 0, vy: 260, speed: 260 });
    const inputs = [{ at: 200, type: "pointerdown", x: .5 }, { at: 557, type: "pointermove", x: 2 / 3 },
      { at: 650, type: "pointercancel", x: 2 / 3 }];
    const frames = Array.from({ length: Math.round(.7 * rate) }, (_, index) => (index + 1) * 1000 / rate)
      .filter(at => !stalled || at <= 500 + 1e-7 || at >= 600 - 1e-7);
    const events = [...inputs.map(event => ({ at: event.at, event })), ...frames.map(at => ({ at }))]
      .sort((a, b) => a.at - b.at || Number(!a.event) - Number(!b.event));
    for (const entry of events) entry.event ? page.input(entry.event) : page.displayFrame(entry.at);
    close(page.state.time, .7);
    close(page.state.paddle.x, 240);
    assert.ok(page.state.ball.vx < 0 && page.state.ball.vy < 0, "the late drag must produce the intended left/up return");
    outcomes.push({ ...page.state.ball });
  }
  for (const outcome of outcomes) for (const field of ["x", "y", "vx", "vy", "speed"]) close(outcome[field], outcomes[0][field]);
});

test("launch time starts the clock before the first delayed display frame", () => {
  const page = chamber();
  page.open();
  page.advanceTo(125);
  page.action.emit("click");
  page.displayFrame(175);
  close(page.state.time, .05);
});

test("releasing the final ready-state key paints its actual endpoint before idle rendering stops", () => {
  const page = chamber();
  page.open();
  key(page, "keydown", "ArrowRight");
  page.displayFrame(10);
  page.advanceTo(24);
  key(page, "keyup", "ArrowRight");
  assert.equal(page.pendingFrames, 0);
  close(page.state.paddle.x, 197.5);
  const paddle = page.state.paddle;
  const edges = page.drawing.filter(call => ["moveTo", "lineTo"].includes(call.method)
    && call.args[1] >= paddle.y && call.args[1] <= paddle.y + paddle.height
    && Math.abs(call.args[0] - paddle.x) <= paddle.width / 2)
    .map(call => call.args[0]);
  assert.ok(edges.length > 0, "the stopped frame must include the paddle silhouette");
  close((Math.min(...edges) + Math.max(...edges)) / 2, paddle.x);
});

test("a long display stall recovers at most 250 ms without carrying a catch-up backlog", () => {
  const page = chamber();
  flight(page);
  page.displayFrame(1000);
  assert.ok(page.state.time >= .24 && page.state.time <= .25 + 1e-8);
  const recovered = page.state.time;
  page.displayFrame(1016);
  assert.ok(page.state.time - recovered <= .025 + 1e-8, "later frames must not replay the dropped second");
});

test("pausing clears fractional simulation debt and excludes time spent in the background", () => {
  const page = chamber();
  flight(page);
  page.displayFrame(10);
  const before = page.state.time;
  page.document.hidden = true;
  page.document.emit("visibilitychange");
  assert.equal(page.pendingFrames, 0);
  page.displayFrame(5000);
  close(page.state.time, before);
  page.document.hidden = false;
  page.document.emit("visibilitychange");
  assert.equal(page.pendingFrames, 0, "returning to the tab requires explicit resume");
  page.pause.emit("click");
  page.displayFrame(5000);
  page.displayFrame(5007);
  close(page.state.time, before, 1e-9);
  page.displayFrame(5009);
  close(page.state.time - before, 1 / 120);
});

test("decorative motion preferences do not change the same launched flight", () => {
  const pages = [chamber(), chamber(), chamber()];
  pages[1].motion.matches = true;
  pages[2].root.dataset.motion = "paused";
  for (const page of pages) flight(page);
  for (let frame = 1; frame <= 120; frame++) {
    for (const page of pages) page.displayFrame(frame * 1000 / 60);
    const expected = JSON.stringify(pages[0].snapshot());
    for (const page of pages.slice(1)) assert.equal(JSON.stringify(page.snapshot()), expected);
  }
  assert.notEqual(JSON.stringify(pages[0].drawing), JSON.stringify(pages[1].drawing),
    "the fixture must exercise a visibly different motion preference");
});

test("pausing freezes the decorated frame and reopening starts a clean board", () => {
  const page = chamber();
  flight(page);
  for (const time of [16, 32, 48, 64]) page.displayFrame(time);
  page.pause.emit("click");
  const paused = JSON.stringify(page.snapshot());
  const pixels = JSON.stringify(page.drawing);
  const paints = page.paints;
  page.displayFrame(5000);
  assert.equal(page.pendingFrames, 0);
  assert.equal(page.paints, paints, "a paused game must not keep rendering decorative frames");
  assert.equal(JSON.stringify(page.snapshot()), paused);
  page.window.emit("portfolio:preferences");
  assert.equal(JSON.stringify(page.drawing), pixels, "repainting a paused frame cannot advance its decoration");
  page.api.close();
  page.open();
  const clean = chamber();
  clean.open();
  assert.equal(frameDrawing(page), frameDrawing(clean),
    "reopening must not retain trails, bursts, or impact highlights from the previous round");
  assert.equal(page.pendingFrames, 0, "the reset board waits for an explicit launch");
});

test("sustained real shield impacts keep decorative drawing work bounded", () => {
  const page = chamber();
  flight(page);
  const target = page.state.bricks[7];
  page.state.bricks = [target];
  // Reuse one long-lived shield to stress repeated impacts without finishing a
  // round. The collision engine still decides whether each impact occurs.
  target.health = 1000;
  const warm = [], later = [];
  for (let frame = 1; frame <= 300; frame++) {
    Object.assign(page.state.ball, { x: target.x + target.width / 2,
      y: target.y + target.height + page.state.ball.radius + 1, vx: 0, vy: -260, speed: 260 });
    page.displayFrame(frame * 1000 / 60);
    if (frame >= 60 && frame < 120) warm.push(page.drawing.length);
    if (frame >= 240) later.push(page.drawing.length);
  }
  assert.ok(target.health < 800, "the fixture must create repeated collisions");
  assert.ok(Math.max(...later) <= Math.max(...warm) + 10,
    "older impacts must expire rather than accumulate drawing work throughout a round");
});

test("remaining shield hits have distinct visuals even with reduced motion", () => {
  const page = chamber();
  page.motion.matches = true;
  page.open();
  const brick = { ...page.state.bricks[0] };
  page.state.bricks = [brick];
  const drawing = (health, maxHealth) => {
    Object.assign(brick, { health, maxHealth });
    page.window.emit("portfolio:preferences");
    return JSON.stringify(page.drawing);
  };
  const single = drawing(1, 1), armored = drawing(2, 2), damaged = drawing(1, 2);
  assert.notEqual(single, armored, "full one-hit and two-hit shields must be distinguishable before impact");
  assert.notEqual(armored, damaged, "damage must remain visible without decorative particles");
});

test("re-enabling decorative motion does not replay a hidden collision or collection", () => {
  for (const collect of [false, true]) {
    const page = chamber();
    page.motion.matches = true;
    flight(page);
    const target = page.state.bricks[7], other = page.state.bricks[8];
    page.state.bricks = [target, other];
    if (collect) target.health = 1;
    Object.assign(page.state.ball, { x: target.x + target.width / 2,
      y: target.y + target.height + page.state.ball.radius + 1, vx: 0, vy: -260, speed: 260 });
    page.displayFrame(40);
    assert.equal(target.health, collect ? 0 : 1, "the fixture must really hit the shield");
    assert.equal(page.state.collected.includes(target.star), collect);
    page.motion.matches = false;
    page.motion.emit("change");
    page.displayFrame(60);
    const clean = chamber();
    clean.open();
    Object.assign(clean.state, JSON.parse(JSON.stringify(page.state)));
    clean.window.emit("portfolio:preferences");
    assert.equal(frameDrawing(page), frameDrawing(clean),
      "an old hit or collection must not emit a new burst when motion returns");
  }
});

test("switching off motion clears an active impact before motion is enabled again", () => {
  for (const preference of ["system", "site"]) {
    const page = chamber();
    flight(page);
    const target = page.state.bricks[7];
    page.state.bricks = [target];
    Object.assign(page.state.ball, { x: target.x + target.width / 2,
      y: target.y + target.height + page.state.ball.radius + 1, vx: 0, vy: -260, speed: 260 });
    page.displayFrame(40);
    assert.equal(target.health, 1);
    const decorated = frameDrawing(page);
    const setMotion = disabled => {
      if (preference === "system") {
        page.motion.matches = disabled;
        page.motion.emit("change");
      } else {
        page.root.dataset.motion = disabled ? "paused" : "running";
        page.window.emit("portfolio:preferences");
      }
    };
    setMotion(true);
    setMotion(false);
    const clean = chamber();
    clean.open();
    Object.assign(clean.state, JSON.parse(JSON.stringify(page.state)));
    clean.window.emit("portfolio:preferences");
    assert.notEqual(decorated, frameDrawing(clean), "the fixture must first create a visible impact");
    assert.equal(frameDrawing(page), frameDrawing(clean),
      `${preference} preference must discard active effects rather than hide them until motion returns`);
  }
});

test("an input that ends a flight leaves its result visible until a fresh launch action", () => {
  for (const control of ["space", "pointer"]) {
    const page = chamber();
    flight(page);
    if (control === "pointer") pointer(page, "pointerdown", 1, 100);
    Object.assign(page.state.ball, { x: 10, y: page.state.height + page.state.ball.radius + 1, vx: 0, vy: 100 });
    page.advanceTo(20);
    if (control === "space") key(page, "keydown", " ");
    else pointer(page, "pointerup", 1, 100);
    assert.equal(page.state.phase, "ready", control);
    assert.equal(page.state.lives, 2, control);
    assert.ok(frameText(page).includes("ki scattered"), control);
  }
});

test("a missed ball explains the lost life and clears the flight trail before the next serve", () => {
  const page = chamber();
  flight(page);
  for (const time of [16, 32, 48, 64]) page.displayFrame(time);
  Object.assign(page.state.ball, { x: 10, y: page.state.height + page.state.ball.radius + 1, vx: 0, vy: 100 });
  page.displayFrame(80);
  assert.equal(page.state.phase, "ready");
  assert.equal(page.state.lives, 2);
  assert.match(page.status.textContent, /ki lost/i);
  assert.ok(frameText(page).includes("ki scattered"));
  assert.equal(page.pendingFrames, 0, "another serve still requires a deliberate launch");

  const clean = chamber();
  clean.open();
  clean.state.lives = 2;
  clean.engine.movePaddle(clean.state, page.state.paddle.x);
  clean.window.emit("portfolio:preferences");
  const circles = controls => controls.drawing.filter(call => call.method === "arc").map(call => call.args);
  assert.deepEqual(circles(page), circles(clean), "the ready board must not retain ghost points from the old flight");
});
