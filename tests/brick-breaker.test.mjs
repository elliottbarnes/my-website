import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const window = {};
vm.runInNewContext(await readFile(new URL("../assets/brick-breaker.js", import.meta.url), "utf8"), { window });
const engine = window.PortfolioBreakerEngine;
const snapshot = state => JSON.parse(JSON.stringify(state));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000001, `${actual} should equal ${expected}`);

function aimAtBottom(state, brick) {
  state.phase = "playing";
  Object.assign(state.ball, { x: brick.x + brick.width / 2, y: brick.y + brick.height + state.ball.radius + 1,
    vx: 0, vy: -state.ball.speed });
}

function alone(state, brick) {
  for (const other of state.bricks) other.active = other === brick;
}

test("the chamber starts ready with three lives and seven complete columns", () => {
  const state = engine.create();
  assert.equal(state.width, 360);
  assert.equal(state.height, 480);
  assert.equal(state.phase, "ready");
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.bricks.length, 21);
  for (let star = 1; star <= 7; star++) {
    assert.equal(state.bricks.filter(brick => brick.star === star).length, 3);
  }
  for (const brick of state.bricks) {
    assert.ok(brick.x >= 0 && brick.x + brick.width <= state.width);
    assert.ok(brick.health >= 1 && brick.health <= 2);
  }
  assert.equal(state.ball.vx, 0);
  assert.equal(state.ball.vy, 0);
});

test("paddle movement clamps at each edge and serves follow pointer or keyboard movement", () => {
  const state = engine.create();
  engine.movePaddle(state, -100);
  assert.equal(state.paddle.x, state.paddle.width / 2);
  assert.equal(state.ball.x, state.paddle.x);
  engine.movePaddle(state, state.paddle.x + 20);
  assert.equal(state.ball.x, 54);
  engine.movePaddle(state, 1000);
  assert.equal(state.paddle.x, state.width - state.paddle.width / 2);
  engine.movePaddle(state, NaN);
  engine.movePaddle(state, Infinity);
  assert.equal(state.paddle.x, 326);
  engine.launch(state);
  const launchedX = state.ball.x;
  engine.movePaddle(state, 100);
  assert.equal(state.ball.x, launchedX, "moving the paddle must not teleport a flying ball");
});

test("launch requires an explicit action and repeated launch does not reset flight", () => {
  const state = engine.create();
  engine.step(state, .1);
  assert.equal(state.phase, "ready");
  engine.launch(state);
  assert.equal(state.phase, "playing");
  assert.ok(state.ball.vy < 0);
  engine.step(state, .05);
  const before = snapshot(state);
  engine.launch(state);
  assert.deepEqual(snapshot(state), before);
});

test("wall and ceiling impacts keep the ball in bounds and reflect in the outgoing direction", () => {
  const state = engine.create();
  engine.launch(state);
  Object.assign(state.ball, { x: 6, y: 250, vx: -260, vy: 0 });
  engine.step(state, .02);
  assert.ok(state.ball.x >= state.ball.radius && state.ball.vx > 0);
  Object.assign(state.ball, { x: 354, y: 250, vx: 260, vy: 0 });
  engine.step(state, .02);
  assert.ok(state.ball.x <= state.width - state.ball.radius && state.ball.vx < 0);
  Object.assign(state.ball, { x: 180, y: 6, vx: 0, vy: -260 });
  engine.step(state, .02);
  assert.ok(state.ball.y >= state.ball.radius && state.ball.vy > 0);
});

test("paddle impact position aims the projectile while keeping a steep upward return", () => {
  for (const offset of [-28, 0, 28]) {
    const state = engine.create();
    engine.launch(state);
    Object.assign(state.ball, { x: state.paddle.x + offset, y: state.paddle.y - state.ball.radius - 1,
      vx: 0, vy: state.ball.speed });
    engine.step(state, .015);
    assert.ok(state.ball.vy < -state.ball.speed * .55, "edge returns must not become nearly horizontal");
    assert.equal(Math.sign(state.ball.vx), Math.sign(offset));
    close(Math.hypot(state.ball.vx, state.ball.vy), state.ball.speed);
  }
});

test("a hardened brick takes one hit per impact, then a second distinct hit destroys it", () => {
  const state = engine.create(), brick = state.bricks[14];
  alone(state, brick);
  aimAtBottom(state, brick);
  engine.step(state, .05);
  assert.equal(brick.health, 1);
  assert.equal(brick.active, true);
  assert.equal(state.score, 10);
  assert.ok(state.ball.vy > 0);
  engine.step(state, .05);
  assert.equal(brick.health, 1, "depenetration must not create repeated damage");
  aimAtBottom(state, brick);
  engine.step(state, .02);
  assert.equal(brick.health, 0);
  assert.equal(brick.active, false);
  assert.equal(state.score, 35);
});

test("a fast ball cannot tunnel through a brick during the maximum frame duration", () => {
  const state = engine.create(), brick = state.bricks[0];
  alone(state, brick);
  state.phase = "playing";
  Object.assign(state.ball, { x: brick.x + brick.width / 2, y: brick.y + brick.height + 25,
    vx: 0, vy: -400, speed: 400 });
  engine.step(state, .1);
  assert.equal(brick.active, false);
  assert.equal(state.score, 25);
});

test("round brick corners reflect along their diagonal normal without leaving invalid velocity", () => {
  const state = engine.create(), brick = state.bricks[14];
  alone(state, brick);
  state.phase = "playing";
  const component = state.ball.speed / Math.SQRT2;
  Object.assign(state.ball, { x: brick.x - 5, y: brick.y - 5, vx: component, vy: component });
  engine.step(state, .015);
  assert.equal(brick.health, 1);
  assert.ok(state.ball.vx < 0 && state.ball.vy < 0);
  close(Math.hypot(state.ball.vx, state.ball.vy), state.ball.speed);
  assert.ok(Number.isFinite(state.ball.x) && Number.isFinite(state.ball.y));
});

test("a Dragon Ball is collected only when its entire column has been cleared", () => {
  const state = engine.create();
  for (const brick of state.bricks.filter(candidate => candidate.star === 4)) {
    for (let hit = 0; hit < brick.maxHealth; hit++) {
      aimAtBottom(state, brick);
      engine.step(state, .015);
    }
    assert.equal(brick.active, false);
    assert.equal(state.collected.includes(4), brick.id >= 14);
  }
  assert.deepEqual(Array.from(state.collected), [4]);
  assert.equal(state.phase, "playing", "other columns remain playable");
});

test("clearing all seven columns wins, retains the full collection, and ends movement", () => {
  const state = engine.create();
  // Clear from the bottom so the deliberate test impacts have unobstructed paths.
  for (const brick of Array.from(state.bricks).reverse()) {
    for (let hit = 0; hit < brick.maxHealth; hit++) {
      aimAtBottom(state, brick);
      engine.step(state, .015);
    }
    assert.equal(brick.active, false);
  }
  assert.equal(state.phase, "won");
  assert.deepEqual(Array.from(state.collected), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(state.score, 665);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.ball.vy, 0);
  const before = snapshot(state);
  engine.step(state, .1);
  engine.launch(state);
  assert.deepEqual(snapshot(state), before);
});

test("missing the paddle spends one life and waits for a new launch until all three are gone", () => {
  const state = engine.create();
  state.score = 50;
  for (let remaining = 2; remaining >= 0; remaining--) {
    engine.launch(state);
    Object.assign(state.ball, { x: 10, y: state.height + state.ball.radius - 1, vx: 0, vy: 260 });
    engine.step(state, .025);
    assert.equal(state.lives, remaining);
    assert.equal(state.phase, remaining ? "ready" : "lost");
    assert.equal(state.score, 50);
    assert.equal(state.ball.vx, 0);
    assert.equal(state.ball.vy, 0);
    engine.step(state, .1);
    assert.equal(state.lives, remaining);
  }
  engine.launch(state);
  assert.equal(state.phase, "lost");
  assert.equal(engine.reset(state), state);
  assert.equal(state.phase, "ready");
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.ok(state.bricks.every(brick => brick.active && brick.health === brick.maxHealth));
});

test("frame duration is bounded and invalid timing input cannot advance the simulation", () => {
  const long = engine.create(), bounded = engine.create();
  engine.launch(long);
  engine.launch(bounded);
  engine.step(long, 10);
  engine.step(bounded, .1);
  assert.deepEqual(snapshot(long), snapshot(bounded));
  const before = snapshot(long);
  for (const duration of [0, -1, NaN, Infinity, undefined]) engine.step(long, duration);
  assert.deepEqual(snapshot(long), before);
});

test("extended deterministic play keeps coordinates and velocities finite", () => {
  const state = engine.create();
  for (let frame = 0; frame < 18000 && !["won", "lost"].includes(state.phase); frame++) {
    engine.movePaddle(state, state.ball.x + Math.sin(frame * .031) * 20);
    if (state.phase === "ready") engine.launch(state);
    engine.step(state, 1 / 60);
    for (const value of [state.ball.x, state.ball.y, state.ball.vx, state.ball.vy, state.ball.speed]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(state.ball.speed <= 400);
    assert.ok(state.bricks.every(brick => brick.health >= 0));
    assert.ok(state.lives >= 0 && state.lives <= 3);
  }
});
