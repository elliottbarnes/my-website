// Independent, dependency-free simulation for the circular portfolio.
// Distances are CSS pixels; time is seconds. No DOM or storage is accessed here.
const TAU = Math.PI * 2;
const SAMPLES = 64;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const dimensions = (width, height) => [Math.max(1, finite(width, 1)), Math.max(1, finite(height, 1))];
const radiusFor = (width, height) => Math.max(1, Math.min(Math.max(2, width - 12), height * 469 / 852) * (width <= 700 ? .3125 : .425));
const makeBall = (x, y, radius, padding = 13) => ({
  x, y, vx: 0, vy: 0, radius, extent: radius + padding, padding, angle: Math.PI,
  spin: 0, compression: 0, pressure: 0, settled: false,
  offsets: Array(SAMPLES).fill(0), waves: Array(SAMPLES).fill(0),
});

export function createWorld(width, height, { reducedMotion = false } = {}) {
  [width, height] = dimensions(width, height);
  const baseRadius = radiusFor(width, height);
  const world = {
    width, height, baseRadius, reducedMotion: Boolean(reducedMotion),
    ball: makeBall(width / 2, height / 2, baseRadius), puck: null,
    mode: 'home', remaining: 15, score: 0, palette: 0, paused: false,
    held: false, scale: 1, scaleVelocity: 0, scaling: false,
    grabOffset: { x: 0, y: 0 }, pointer: { x: width / 2, y: height / 2 },
    elapsed: 0, lastDrag: -1, lastPalette: -1, pressureTime: 0,
    particles: [], reassembly: 0, goal: null,
  };
  refreshSize(world);
  return world;
}

function setRadius(world, body, radius, padding) {
  body.radius = radius;
  body.padding = padding;
  // On extremely short windows, retain a bounded collision shape.
  body.extent = Math.min(radius + padding, world.width / 2, world.height / 2);
}

function refreshSize(world) {
  const game = world.mode === 'game' || world.mode === 'results';
  const radius = world.baseRadius * world.scale * (game ? .5 : 1);
  setRadius(world, world.ball, radius, game ? 6.5 : 13);
  if (world.puck) setRadius(world, world.puck, world.baseRadius * .5, 6.5);
  const goalWidth = Math.min(world.width - 16, world.baseRadius * 2 + 26);
  world.goal = { width: Math.max(1, goalWidth), left: (world.width - goalWidth) / 2, right: (world.width + goalWidth) / 2, y: 10 };
}

function contain(world, body) {
  const r = body.extent;
  body.x = clamp(body.x, r, Math.max(r, world.width - r));
  body.y = clamp(body.y, r, Math.max(r, world.height - r));
}

export function resizeWorld(world, width, height) {
  [width, height] = dimensions(width, height);
  const sx = width / world.width, sy = height / world.height;
  world.width = width; world.height = height; world.baseRadius = radiusFor(width, height);
  refreshSize(world);
  for (const body of [world.ball, world.puck].filter(Boolean)) {
    body.x *= sx; body.y *= sy; contain(world, body);
  }
  for (const particle of world.particles) { particle.x *= sx; particle.y *= sy; }
  release(world);
  return world;
}

export function resetWorld(world) {
  const reducedMotion = world.reducedMotion;
  const next = createWorld(world.width, world.height, { reducedMotion });
  Object.assign(world, next);
  refreshSize(world);
  return world;
}

export function startGame(world) {
  world.mode = 'game'; world.remaining = 15; world.score = 0;
  world.paused = false; world.held = false; world.scale = 1; world.scaleVelocity = 0; world.scaling = false;
  world.pressureTime = 0; world.particles = []; world.reassembly = 0;
  world.ball.vx = 0; world.ball.vy = 0; world.ball.settled = false;
  world.ball.offsets.fill(0); world.ball.waves.fill(0);
  world.ball.pressure = 0;
  world.puck = makeBall(world.width * .32, world.height * .58, world.baseRadius * .5, 6.5);
  refreshSize(world); contain(world, world.ball); contain(world, world.puck);
  // Start with a visible, gentle approach rather than an immediate shot at goal.
  world.puck.vx = Math.min(75, world.width * .14); world.puck.vy = -45;
  separateBodies(world, 0);
  contain(world, world.ball); contain(world, world.puck);
  return world;
}

export function endGame(world) {
  if (world.mode !== 'game') return world;
  world.mode = 'results'; world.remaining = 0; world.held = false;
  world.ball.vx = world.ball.vy = 0;
  if (world.puck) world.puck.vx = world.puck.vy = 0;
  return world;
}

export function grab(world, x, y) {
  if (!['home', 'game'].includes(world.mode)) return false;
  world.held = true;
  world.grabOffset = { x: finite(x) - world.ball.x, y: finite(y) - world.ball.y };
  world.pointer = { x: finite(x), y: finite(y) };
  world.ball.vx = world.ball.vy = 0; world.ball.settled = false;
  world.lastDrag = world.elapsed; world.pressureTime = 0;
  return true;
}

export function drag(world, x, y, dt = 1 / 60) {
  if (!world.held || !['home', 'game'].includes(world.mode)) return false;
  x = finite(x, world.pointer.x); y = finite(y, world.pointer.y);
  dt = clamp(finite(dt, 1 / 60), 1 / 240, .1);
  world.pointer = { x, y };
  const ball = world.ball, previous = { x: ball.x, y: ball.y };
  const targetX = x - world.grabOffset.x, targetY = y - world.grabOffset.y;
  const extent = ball.extent;
  const allowance = world.mode === 'home' ? .38 * ball.radius : 0;
  ball.x = clamp(targetX, extent - allowance, Math.max(extent - allowance, world.width - extent + allowance));
  ball.y = clamp(targetY, extent - allowance, Math.max(extent - allowance, world.height - extent + allowance));
  ball.vx = clamp((ball.x - previous.x) / dt, -1800, 1800);
  ball.vy = clamp((ball.y - previous.y) / dt, -1800, 1800);
  ball.spin = clamp((ball.vx - ball.vy * .35) / Math.max(50, ball.radius) * .15, -2.5, 2.5);
  ball.pressure = Math.max(0, extent - targetX, targetX + extent - world.width, extent - targetY, targetY + extent - world.height) / Math.max(1, ball.radius);
  world.lastDrag = world.elapsed;
  if (world.mode === 'game') sweepPaddle(world, previous);
  return true;
}

export function release(world) {
  world.held = false; world.scaling = false; world.pressureTime = 0;
  world.ball.pressure = 0;
  if (world.elapsed - world.lastDrag > .12) world.ball.vx = world.ball.vy = 0;
  if (world.reducedMotion && world.mode === 'home') world.ball.vx = world.ball.vy = 0;
  if (world.paused || (world.reducedMotion && world.mode === 'home')) contain(world, world.ball);
  return world;
}

// Keyboard impulses use pixels/second, just like pointer release velocity.
export function kick(world, dx, dy) {
  if (!['home', 'game'].includes(world.mode)) return;
  release(world);
  if (world.paused || (world.reducedMotion && world.mode === 'home')) {
    world.ball.x += finite(dx) / 10; world.ball.y += finite(dy) / 10; contain(world, world.ball);
    return;
  }
  world.ball.vx = clamp(world.ball.vx + finite(dx), -1800, 1800);
  world.ball.vy = clamp(world.ball.vy + finite(dy), -1800, 1800);
  world.ball.settled = false;
}

export function setScale(world, scale) {
  if (world.mode !== 'home') return;
  world.scale = clamp(finite(scale, 1), .55, 1.45); world.scaling = true; world.scaleVelocity = 0;
  refreshSize(world);
}

function wave(body, direction, force) {
  for (let i = 0; i < SAMPLES; i++) {
    const delta = Math.atan2(Math.sin(i * TAU / SAMPLES - direction), Math.cos(i * TAU / SAMPLES - direction));
    const center = Math.exp(-delta * delta / .075);
    const shoulder = Math.exp(-Math.pow(Math.abs(delta) - .47, 2) / .075);
    body.waves[i] += force * (-center + shoulder * .37);
  }
}

function deform(world, body, dt) {
  const held = world.held && body === world.ball;
  const speed = dt * 60;
  const restoring = held ? .19 : .095;
  const next = body.waves.map((v, i) => {
    const center = body.offsets[i];
    const neighbors = body.offsets[(i + SAMPLES - 1) % SAMPLES] + body.offsets[(i + 1) % SAMPLES] - 2 * center;
    return (v + (neighbors * .22 - center * restoring) * speed) * Math.pow(.82, speed);
  });
  let average = 0;
  for (let i = 0; i < SAMPLES; i++) {
    body.waves[i] = next[i];
    body.offsets[i] = clamp(body.offsets[i] + next[i] * speed, -body.radius * .42, body.radius * .25);
    average += body.offsets[i] / SAMPLES;
  }
  for (let i = 0; i < SAMPLES; i++) body.offsets[i] -= average;
  body.compression += ((held ? Math.min(.42, body.pressure) : 0) - body.compression) * Math.min(1, dt * 18);
}

function palette(world, events, body, speed) {
  if (body !== world.ball || speed < 22 || world.elapsed - world.lastPalette < .16) return;
  world.palette = (world.palette + 1) % 8;
  world.lastPalette = world.elapsed;
  events.push({ type: 'wall', palette: world.palette, speed });
}

function boundaries(world, body, events, dt) {
  const r = body.extent;
  if (world.held && body === world.ball) return;
  const bounce = world.mode === 'game' ? .91 : .94;
  const hit = (direction, speed) => { wave(body, direction, Math.min(body.radius * .22, speed * .018)); palette(world, events, body, speed); };
  if (body.x < r) { const speed = Math.abs(body.vx); body.x = r; body.vx = Math.abs(body.vx) * bounce; hit(Math.PI, speed); }
  else if (body.x > world.width - r) { const speed = Math.abs(body.vx); body.x = Math.max(r, world.width - r); body.vx = -Math.abs(body.vx) * bounce; hit(0, speed); }
  if (world.mode === 'game' && body === world.puck && body.y - r <= world.goal.y && body.vy < 0 && body.x - r >= world.goal.left && body.x + r <= world.goal.right) {
    world.score += 1;
    events.push({ type: 'goal', score: world.score });
    body.x = world.width / 2; body.y = Math.max(r + 40, world.height * .37);
    body.vx = (world.score % 2 ? -1 : 1) * Math.min(70, world.width * .1); body.vy = 90;
  } else if (body.y < r) {
    const speed = Math.abs(body.vy); body.y = r; body.vy = Math.abs(body.vy) * bounce; hit(-Math.PI / 2, speed);
  } else if (body.y > world.height - r) {
    const speed = Math.abs(body.vy); body.y = Math.max(r, world.height - r);
    if (world.mode === 'home' && speed < 22) { body.vy = 0; body.vx *= Math.pow(.8, dt * 60); body.settled = Math.abs(body.vx) < 1; }
    else { body.vy = -speed * bounce; body.settled = false; hit(Math.PI / 2, speed); }
  }
}

function separateBodies(world, impulse = 1) {
  const a = world.ball, b = world.puck;
  if (!b) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.hypot(dx, dy), minimum = a.extent + b.extent;
  if (distance >= minimum) return;
  const nx = distance > .001 ? dx / distance : 0, ny = distance > .001 ? dy / distance : -1;
  const overlap = minimum - distance;
  if (world.held) { b.x += nx * overlap; b.y += ny * overlap; }
  else { a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2; }
  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach > 0 && impulse) {
    const force = approach * (world.held ? 1.8 : .94);
    b.vx = clamp(b.vx + nx * force, -1800, 1800); b.vy = clamp(b.vy + ny * force, -1800, 1800);
    if (!world.held) { a.vx -= nx * force; a.vy -= ny * force; }
    wave(a, Math.atan2(ny, nx), Math.min(a.radius * .2, approach * .012));
    wave(b, Math.atan2(-ny, -nx), Math.min(b.radius * .2, approach * .012));
  }
}

function sweepPaddle(world, previous) {
  const a = world.ball, b = world.puck;
  if (!b) return;
  const dx = a.x - previous.x, dy = a.y - previous.y, length2 = dx * dx + dy * dy;
  if (length2 < .001) { separateBodies(world); return; }
  const t = clamp(((b.x - previous.x) * dx + (b.y - previous.y) * dy) / length2, 0, 1);
  const nearX = previous.x + dx * t, nearY = previous.y + dy * t;
  if (Math.hypot(b.x - nearX, b.y - nearY) < a.extent + b.extent) {
    const length = Math.sqrt(length2), nx = dx / length, ny = dy / length;
    b.x = a.x + nx * (a.extent + b.extent); b.y = a.y + ny * (a.extent + b.extent);
    const speed = Math.min(1800, Math.max(180, Math.hypot(a.vx, a.vy) * 1.2));
    b.vx = nx * speed; b.vy = ny * speed;
    wave(b, Math.atan2(-ny, -nx), b.radius * .15);
  }
  separateBodies(world);
}

export function burstWorld(world, count = world.wordCount ?? 16) {
  if (world.mode !== 'home') return false;
  world.mode = 'burst'; world.held = false; world.scaling = false; world.pressureTime = 0;
  count = clamp(Math.floor(finite(count, 16)), 1, 80);
  world.burstOrigin = { x: world.ball.x, y: world.ball.y, angle: world.ball.angle };
  world.particles = Array.from({ length: count }, (_, index) => {
    const angle = world.ball.angle + (world.wordAngles?.[index] ?? index * TAU / count);
    const point = ringPoint(world, angle), speed = 228 + ((index * 71) % 286);
    return { index, x: point.x, y: point.y, angle: point.angle, vx: Math.cos(angle) * speed + world.ball.vx * .2, vy: Math.sin(angle) * speed + world.ball.vy * .2, spin: ((index % 5) - 2) * 1.5 };
  });
  world.reassembly = 0;
  return true;
}

export function reassembleWorld(world) {
  if (world.mode !== 'burst' || world.reassembly) return false;
  world.reassembly = .72; world.scale = 1; world.scaleVelocity = 0;
  world.ball = makeBall(world.width / 2, world.height / 2, world.baseRadius);
  refreshSize(world);
  for (const particle of world.particles) { particle.fromX = particle.x; particle.fromY = particle.y; particle.fromAngle = particle.angle; }
  return true;
}

function stepParticles(world, dt, events) {
  if (world.reassembly > 0) {
    world.reassembly = Math.max(0, world.reassembly - dt);
    const progress = 1 - Math.pow(world.reassembly / .72, 4);
    for (const particle of world.particles) {
      const target = ringPoint(world, world.ball.angle + (world.wordAngles?.[particle.index] ?? particle.index * TAU / world.particles.length));
      particle.x = particle.fromX + (target.x - particle.fromX) * progress;
      particle.y = particle.fromY + (target.y - particle.fromY) * progress;
      const turn = Math.atan2(Math.sin(target.angle - particle.fromAngle), Math.cos(target.angle - particle.fromAngle));
      particle.angle = particle.fromAngle + turn * progress;
    }
    if (world.reassembly === 0) { world.mode = 'home'; world.particles = []; events.push({ type: 'reassemble' }); }
    return;
  }
  for (const particle of world.particles) {
    particle.vy += Math.min(2100, Math.max(1450, world.height * 2)) * dt;
    particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.angle += particle.spin * dt;
    if (particle.x < 12) { particle.x = 12; particle.vx = Math.abs(particle.vx) * .58; }
    if (particle.x > world.width - 12) { particle.x = world.width - 12; particle.vx = -Math.abs(particle.vx) * .58; }
    if (particle.y > world.height - 16) { particle.y = world.height - 16; particle.vy = Math.abs(particle.vy) < 45 ? 0 : -Math.abs(particle.vy) * .28; particle.vx *= Math.pow(.7, dt * 60); particle.spin *= Math.pow(.7, dt * 60); }
  }
}

export function stepWorld(world, delta) {
  const events = [];
  if (world.paused || world.mode === 'results') return events;
  // Keep integration stable under slow frames, but measure the round in actual
  // active time. The controller pauses the world while hidden or in a dialog.
  const elapsed = Math.max(0, finite(delta));
  const gameElapsed = world.mode === 'game' ? elapsed : 0;
  const duration = Math.min(elapsed, .05);
  if (!duration) return events;
  const steps = Math.ceil(duration / (1 / 120)), dt = duration / steps;
  for (let s = 0; s < steps; s++) {
    world.elapsed += dt;
    if (world.mode === 'burst') { stepParticles(world, dt, events); continue; }
    if (!world.scaling && Math.abs(world.scale - 1) + Math.abs(world.scaleVelocity) > .0001) {
      world.scaleVelocity += ((1 - world.scale) * 90 - world.scaleVelocity * 16) * dt;
      world.scale = clamp(world.scale + world.scaleVelocity * dt, .55, 1.45); refreshSize(world);
    }
    const activeHome = world.mode === 'home' && !world.reducedMotion;
    const ball = world.ball;
    if (world.held) {
      if (world.elapsed - world.lastDrag > .06) { ball.vx *= Math.pow(.65, dt * 60); ball.vy *= Math.pow(.65, dt * 60); }
      if (world.mode === 'home' && ball.pressure > .45) world.pressureTime += dt;
      else world.pressureTime = 0;
      if (world.pressureTime >= .9) { burstWorld(world); events.push({ type: 'burst' }); continue; }
    }
    for (const body of [ball, world.puck].filter(Boolean)) {
      deform(world, body, dt);
      if (body === ball && world.held) continue;
      if (activeHome || world.mode === 'game') {
        if (activeHome) body.vy += 400 * dt;
        const retention = world.mode === 'game' ? .96 : .971;
        body.vx *= Math.pow(retention, dt * 60); body.vy *= Math.pow(retention, dt * 60);
        body.x += body.vx * dt; body.y += body.vy * dt;
        boundaries(world, body, events, dt);
        if (!body.settled) body.angle += (TAU / 60 + body.spin) * dt;
        body.spin *= Math.pow(.98, dt * 60);
      }
    }
    if (world.mode === 'game') {
      separateBodies(world);
      // Collision separation cannot leave the paddle outside the viewport.
      contain(world, ball);
      contain(world, world.puck);
    }
  }
  if (world.mode === 'game' && gameElapsed) {
    world.remaining = Math.max(0, world.remaining - gameElapsed);
    if (world.remaining < 1e-8) { endGame(world); events.push({ type: 'end', score: world.score }); }
  }
  return events;
}

function pointAt(world, theta, body) {
  const sample = ((theta % TAU + TAU) % TAU) / TAU * SAMPLES;
  const lo = Math.floor(sample), mix = sample - lo;
  const offset = body.offsets[lo] * (1 - mix) + body.offsets[(lo + 1) % SAMPLES] * mix;
  let x = body.x + Math.cos(theta) * (body.radius + offset);
  let y = body.y + Math.sin(theta) * (body.radius + offset);
  if (world.held && body === world.ball && world.mode === 'home') {
    // The contact patch flattens against the boundary instead of scaling the ring.
    x = clamp(x, body.padding, world.width - body.padding);
    y = clamp(y, body.padding, world.height - body.padding);
  }
  return { x, y };
}

export function ringPoint(world, theta, body = world.ball) {
  const point = pointAt(world, theta, body), next = pointAt(world, theta + .002, body), previous = pointAt(world, theta - .002, body);
  const dx = next.x - previous.x, dy = next.y - previous.y;
  return { ...point, angle: Math.abs(dx) + Math.abs(dy) > .000001 ? Math.atan2(dy, dx) : theta + Math.PI / 2 };
}
