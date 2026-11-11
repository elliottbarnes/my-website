import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, resizeWorld, stepWorld, startGame, endGame, resetWorld, grab, drag, release, kick, setScale, burstWorld, reassembleWorld, ringPoint } from '../assets/ring-physics.mjs';

const advance = (world, seconds) => {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) events.push(...stepWorld(world, 1 / 120));
  return events;
};
const close = (actual, expected, tolerance = .001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`);
const inside = (world, body = world.ball) => {
  assert.ok(body.x >= body.extent - .001 && body.x <= world.width - body.extent + .001);
  assert.ok(body.y >= body.extent - .001 && body.y <= world.height - body.extent + .001);
};

test('home starts centered, with the observed desktop and mobile radius proportions', () => {
  const desktop = createWorld(1440, 1000), mobile = createWorld(390, 844), narrow = createWorld(320, 568);
  close(desktop.ball.radius, 1000 * 469 / 852 * .425);
  close(mobile.ball.radius, 378 * .3125);
  close(narrow.ball.radius, 308 * .3125);
  assert.equal(desktop.ball.x, 720); assert.equal(desktop.ball.y, 500);
  assert.equal(desktop.palette, 0); assert.equal(desktop.mode, 'home');
});

test('gravity, wall deformation and palette changes settle without floor penetration', () => {
  const world = createWorld(1440, 1000);
  const events = advance(world, 18);
  assert.ok(events.some(event => event.type === 'wall'));
  assert.ok(world.ball.y > 500);
  inside(world);
  close(world.ball.y, world.height - world.ball.extent, .1);
  assert.equal(world.ball.settled, true);
  const angle = world.ball.angle; advance(world, 1); close(world.ball.angle, angle);
});

test('reduced motion parks ambient animation but permits deliberate movement and the opt-in game', () => {
  const world = createWorld(390, 844, { reducedMotion: true });
  const initial = { x: world.ball.x, y: world.ball.y, angle: world.ball.angle };
  advance(world, 3);
  assert.deepEqual({ x: world.ball.x, y: world.ball.y, angle: world.ball.angle }, initial);
  kick(world, 200, 0); assert.equal(world.ball.x, initial.x + 20);
  startGame(world); const oldPuckY = world.puck.y; advance(world, .1);
  assert.notEqual(world.puck.y, oldPuckY); assert.ok(world.remaining < 15);
});

test('pause and invalid deltas do not advance any simulation or game time', () => {
  const world = createWorld(1440, 1000); startGame(world); world.paused = true;
  const before = JSON.stringify(world); advance(world, 2);
  assert.equal(JSON.stringify(world), before);
  world.paused = false;
  for (const delta of [0, -1, NaN, Infinity, undefined]) assert.deepEqual(stepWorld(world, delta), []);
  assert.equal(world.remaining, 15);
  stepWorld(world, 600); assert.equal(world.remaining, 0); assert.equal(world.mode, 'results');
});

test('slow frames deduct actual game time while physics integration stays bounded', () => {
  const slow = createWorld(1440, 1000), fast = createWorld(1440, 1000);
  startGame(slow); startGame(fast);
  stepWorld(slow, 1.25); stepWorld(fast, .05);
  close(slow.ball.x, fast.ball.x); close(slow.ball.y, fast.ball.y);
  close(slow.puck.x, fast.puck.x); close(slow.puck.y, fast.puck.y);
  close(slow.remaining, 13.75); close(fast.remaining, 14.95);
  const events = [];
  for (const delta of [.016, .2, 2.5, .034, 3, .1, 7.9]) events.push(...stepWorld(slow, delta));
  assert.equal(slow.mode, 'results'); assert.equal(slow.remaining, 0);
  assert.equal(events.filter(event => event.type === 'end').length, 1);
  assert.deepEqual(stepWorld(slow, 10), []);
});

test('drag preserves the grab offset and release retains bounded throw momentum', () => {
  const world = createWorld(1440, 1000);
  grab(world, world.ball.x + 40, world.ball.y + 15);
  drag(world, 900, 400, .05);
  assert.equal(world.ball.x, 860); assert.equal(world.ball.y, 385);
  release(world); const x = world.ball.x; stepWorld(world, 1 / 60);
  assert.ok(world.ball.x > x); assert.ok(Math.abs(world.ball.vx) <= 1800);
});

test('holding still before release does not launch stale pointer velocity', () => {
  const world = createWorld(1440, 1000);
  grab(world, world.ball.x, world.ball.y); drag(world, 900, 400, .03);
  advance(world, .2); release(world);
  assert.equal(world.ball.vx, 0); assert.equal(world.ball.vy, 0);
});

test('resizing during a drag releases the pointer and contains both game bodies', () => {
  const world = createWorld(1440, 1000); startGame(world);
  grab(world, world.ball.x, world.ball.y); drag(world, 1400, 950, .05);
  resizeWorld(world, 320, 568);
  assert.equal(world.held, false); inside(world); inside(world, world.puck);
  assert.ok(world.goal.left >= 8); assert.ok(world.goal.right <= 312);
  assert.equal(world.remaining, 15);
});

test('pinch is constrained and springs back after release', () => {
  const world = createWorld(390, 844);
  setScale(world, 10); assert.equal(world.scale, 1.45);
  setScale(world, .01); assert.equal(world.scale, .55);
  release(world); advance(world, 2);
  close(world.scale, 1, .001);
  startGame(world); setScale(world, 1.4); assert.equal(world.scale, 1);
});

test('wall pressure flattens the contact patch while sustained deep pressure bursts', () => {
  const world = createWorld(1440, 1000);
  world.wordCount = 23;
  grab(world, world.ball.x, world.ball.y); drag(world, -200, 500, .05);
  const point = ringPoint(world, Math.PI);
  assert.equal(point.x, world.ball.padding);
  assert.ok(Number.isFinite(point.angle));
  advance(world, .8); assert.equal(world.mode, 'home');
  const events = advance(world, .15);
  assert.equal(world.mode, 'burst'); assert.equal(world.held, false);
  assert.ok(events.some(event => event.type === 'burst')); assert.equal(world.particles.length, 23);
});

test('burst particles fall and reassemble once into a centered intact ring', () => {
  const world = createWorld(390, 844, { reducedMotion: true });
  assert.equal(burstWorld(world, 12), true); const y = world.particles[0].y;
  advance(world, .1); assert.notEqual(world.particles[0].y, y);
  assert.equal(reassembleWorld(world), true); assert.equal(reassembleWorld(world), false);
  advance(world, .5); assert.equal(world.mode, 'burst');
  const events = advance(world, .25);
  assert.equal(world.mode, 'home'); assert.deepEqual(world.particles, []);
  assert.equal(events.filter(event => event.type === 'reassemble').length, 1);
  assert.equal(world.ball.x, 195); assert.equal(world.ball.y, 422);
});

test('a puck fully inside the goal scores once and respawns; outside shots bounce', () => {
  const world = createWorld(1440, 1000); startGame(world);
  Object.assign(world.puck, { x: world.width / 2, y: world.puck.extent + 2, vx: 0, vy: -500 });
  const events = stepWorld(world, 1 / 60);
  assert.equal(world.score, 1); assert.equal(events.filter(event => event.type === 'goal').length, 1);
  assert.ok(world.puck.y > 200); assert.ok(world.puck.vy > 0);
  Object.assign(world.puck, { x: world.puck.extent, y: world.puck.extent + 1, vx: 0, vy: -500 });
  stepWorld(world, 1 / 60); assert.equal(world.score, 1); assert.ok(world.puck.vy > 0);
});

test('a fast pointer sweep strikes the puck rather than tunneling through it', () => {
  const world = createWorld(390, 844); startGame(world);
  Object.assign(world.ball, { x: 195, y: 700 }); Object.assign(world.puck, { x: 195, y: 400, vx: 0, vy: 0 });
  grab(world, 195, 700); drag(world, 195, 250, .05);
  assert.ok(world.puck.vy < -100); assert.ok(world.puck.y < world.ball.y);
  release(world); advance(world, .2);
  assert.ok(world.score >= 1);
});

test('repeated keyboard impulses can hit the puck and score without pointer input', () => {
  const world = createWorld(390, 844); startGame(world);
  Object.assign(world.ball, { x: 195, y: 650, vx: 0, vy: 0 });
  Object.assign(world.puck, { x: 195, y: 380, vx: 0, vy: 0 });
  for (let frame = 0; frame < 960; frame++) {
    if (frame % 10 === 0) kick(world, 0, -180);
    stepWorld(world, 1 / 120);
  }
  assert.ok(world.score > 0);
  inside(world); inside(world, world.puck);
});

test('15 active seconds finish exactly once and restart clears prior score and momentum', () => {
  const world = createWorld(390, 844); startGame(world); world.score = 4;
  const events = advance(world, 15.1);
  assert.equal(world.mode, 'results'); assert.equal(world.remaining, 0); assert.equal(world.score, 4);
  assert.equal(events.filter(event => event.type === 'end').length, 1);
  const stopped = JSON.stringify(world); advance(world, 1); assert.equal(JSON.stringify(world), stopped);
  startGame(world); assert.equal(world.score, 0); assert.equal(world.remaining, 15); assert.equal(world.mode, 'game');
  endGame(world); assert.equal(world.mode, 'results');
  resetWorld(world); assert.equal(world.mode, 'home'); assert.equal(world.puck, null); assert.equal(world.score, 0);
});

test('ring tangent and impact deformation remain finite at every sampled angle', () => {
  const world = createWorld(320, 568);
  Object.assign(world.ball, { x: world.ball.extent + 1, vx: -1000 }); stepWorld(world, .02);
  assert.ok(world.ball.offsets.some(offset => Math.abs(offset) > .001));
  for (let i = 0; i < 100; i++) {
    const point = ringPoint(world, i / 100 * Math.PI * 2);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.angle));
  }
  close(world.ball.offsets.reduce((sum, value) => sum + value, 0), 0, .0001);
});
