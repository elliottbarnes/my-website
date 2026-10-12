// Deterministic game physics. Rendering and input stay in the training chamber.
(() => {
  const width = 360, height = 480;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const maximumSpeed = 400;
  const separation = .01;

  function dock(state) {
    state.ball.x = state.paddle.x;
    state.ball.y = state.paddle.y - state.ball.radius - 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
  }

  function create() {
    const state = {
      width, height, phase: "ready", lives: 3, score: 0, collected: [], time: 0, lastHit: null,
      paddle: { x: width / 2, y: 442, width: 68, height: 10 },
      ball: { x: width / 2, y: 435, radius: 5, vx: 0, vy: 0, speed: 260 },
      bricks: [],
    };
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 7; column++) {
        const health = row === 0 ? 1 : 2;
        state.bricks.push({
          id: row * 7 + column, x: 18 + column * 47, y: 62 + row * 26,
          width: 42, height: 18, health, maxHealth: health, star: column + 1, active: true,
        });
      }
    }
    return state;
  }

  function reset(state) {
    Object.assign(state, create());
    return state;
  }

  function movePaddle(state, x) {
    if (!Number.isFinite(x)) return state;
    state.paddle.x = clamp(x, state.paddle.width / 2, state.width - state.paddle.width / 2);
    if (state.phase === "ready") dock(state);
    return state;
  }

  function launch(state) {
    if (state.phase !== "ready") return state;
    dock(state);
    const angle = Math.PI / 15;
    state.ball.vx = Math.sin(angle) * state.ball.speed;
    state.ball.vy = -Math.cos(angle) * state.ball.speed;
    state.phase = "playing";
    return state;
  }

  // The nearest point gives the correct normal for both faces and round corners.
  function contact(ball, rectangle) {
    const nearestX = clamp(ball.x, rectangle.x, rectangle.x + rectangle.width);
    const nearestY = clamp(ball.y, rectangle.y, rectangle.y + rectangle.height);
    const dx = ball.x - nearestX, dy = ball.y - nearestY;
    const distance = Math.hypot(dx, dy);
    if (distance >= ball.radius) return null;
    if (distance > 0) return { nx: dx / distance, ny: dy / distance, depth: ball.radius - distance };
    const faces = [
      { nx: -1, ny: 0, depth: ball.x - rectangle.x + ball.radius },
      { nx: 1, ny: 0, depth: rectangle.x + rectangle.width - ball.x + ball.radius },
      { nx: 0, ny: -1, depth: ball.y - rectangle.y + ball.radius },
      { nx: 0, ny: 1, depth: rectangle.y + rectangle.height - ball.y + ball.radius },
    ];
    return faces.reduce((nearest, face) => face.depth < nearest.depth ? face : nearest);
  }

  function separate(ball, hit) {
    ball.x += hit.nx * (hit.depth + separation);
    ball.y += hit.ny * (hit.depth + separation);
  }

  function reflect(ball, hit) {
    const approach = ball.vx * hit.nx + ball.vy * hit.ny;
    if (approach >= 0) return false;
    ball.vx -= 2 * approach * hit.nx;
    ball.vy -= 2 * approach * hit.ny;
    return true;
  }

  function damage(state, brick) {
    brick.health--;
    state.score += 10;
    state.lastHit = { id: brick.id, x: state.ball.x, y: state.ball.y, star: brick.star, time: state.time };
    if (brick.health === 0) {
      brick.active = false;
      state.score += 15;
      if (!state.bricks.some(other => other.active && other.star === brick.star)) {
        state.collected.push(brick.star);
        state.collected.sort((a, b) => a - b);
      }
    }
    const ball = state.ball;
    ball.speed = Math.min(maximumSpeed, ball.speed + 3);
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      ball.vx *= ball.speed / speed;
      ball.vy *= ball.speed / speed;
    }
    if (!state.bricks.some(other => other.active)) {
      state.phase = "won";
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  function loseLife(state) {
    state.lives--;
    state.phase = state.lives > 0 ? "ready" : "lost";
    dock(state);
  }

  function advance(state, seconds) {
    const ball = state.ball;
    ball.x += ball.vx * seconds;
    ball.y += ball.vy * seconds;
    if (ball.x < ball.radius) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > state.width - ball.radius) {
      ball.x = state.width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < ball.radius) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    const paddle = state.paddle;
    const paddleHit = contact(ball, { ...paddle, x: paddle.x - paddle.width / 2 });
    if (paddleHit && ball.vy > 0 && ball.y <= paddle.y + paddle.height / 2) {
      separate(ball, paddleHit);
      const offset = clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
      const angle = offset * Math.PI * .31;
      ball.vx = Math.sin(angle) * ball.speed;
      ball.vy = -Math.cos(angle) * ball.speed;
    }

    // Resolve adjacent bricks as separate contacts, without damaging one twice.
    const touched = new Set();
    for (let attempt = 0; attempt < 4 && state.phase === "playing"; attempt++) {
      let collision = null;
      for (const brick of state.bricks) {
        if (!brick.active || touched.has(brick.id)) continue;
        const hit = contact(ball, brick);
        if (hit && (!collision || hit.depth > collision.hit.depth)) collision = { brick, hit };
      }
      if (!collision) break;
      touched.add(collision.brick.id);
      separate(ball, collision.hit);
      if (reflect(ball, collision.hit)) damage(state, collision.brick);
    }
    if (state.phase === "playing" && ball.y > state.height + ball.radius) loseLife(state);
  }

  function step(state, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || state.phase !== "playing") return state;
    const duration = Math.min(seconds, .1);
    // Normal play needs at most 18 substeps: less than half a ball radius each.
    const count = Math.min(128, Math.max(1, Math.ceil(Math.hypot(state.ball.vx, state.ball.vy) * duration
      / (state.ball.radius * .45))));
    const delta = duration / count;
    for (let index = 0; index < count && state.phase === "playing"; index++) {
      state.time += delta;
      advance(state, delta);
    }
    return state;
  }

  window.PortfolioBreakerEngine = Object.freeze({ create, reset, launch, movePaddle, step });
})();
