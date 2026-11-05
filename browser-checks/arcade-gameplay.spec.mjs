import { test, expect } from '@playwright/test';
import { runCallbacks } from './helpers/clock.mjs';

async function command(page, name) {
  await page.locator('.scene-body').focus();
  await page.keyboard.press('/');
  await page.locator('#command-input').fill(name);
  await page.locator('#command-input').press('Enter');
}

async function controlledClock(page) {
  await page.clock.install();
  // install() still advances with wall time. Freeze between trusted input and
  // observation calls so a slower CI host cannot change release/catch timing.
  await page.clock.pauseAt(new Date());
}

async function hitTarget(locator) {
  const locate = element => {
    const box = element.getBoundingClientRect();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: element === hit || element.contains(hit) };
  };
  let point = await locator.evaluate(locate);
  // Most grid cells are already in view. Only ask the browser to scroll when
  // necessary; still reject an overlay intercepting the actual touch point.
  if (!point.hit) { await locator.scrollIntoViewIfNeeded(); point = await locator.evaluate(locate); }
  expect(point.hit).toBe(true);
  return point;
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 844, height: 375 }]) {
  test(`small arcade games complete and replay with touch at ${viewport.width}×${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(test.info().project.use.baseURL || 'http://127.0.0.1:4178');
      await command(page, 'arcade');
      await expect(page.locator('#arcade-picker .game-choice')).toHaveCount(5);
      await hitTarget(page.locator('#game-pick-ki')); await page.locator('#game-pick-ki').tap();
      const charge = page.locator('#ki-charge'); await charge.waitFor(); await hitTarget(charge);
      await controlledClock(page);
      const times = [1474, 500, 1672, 1232, 1738];
      for (let round = 0; round < times.length; round++) {
        await charge.press('Enter'); await runCallbacks(page, times[round]); await charge.press('Enter');
        if (round === 0) {
          await expect(page.locator('#ki-band')).toHaveText('56–78%');
          await expect(page.locator('#arcade-status')).toContainText('Perfect control!');
        }
        if (round === 1) await expect(page.locator('#arcade-status')).toContainText('Hold a little longer');
      }
      await expect(page.locator('#arcade-status')).toContainText('Training complete: 4 of 5 hits');
      await expect(page.locator('#arcade-record')).toContainText('best 4/5 hits · 4 perfect');
      await charge.tap(); await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits · 0 perfect');
      // A trusted short tap begins a charge; a second tap releases it.
      await charge.tap(); await runCallbacks(page, 1474); await charge.tap();
      await expect(page.locator('#arcade-status')).toContainText('Perfect control!');
      await page.locator('#arcade-close').tap();
      await command(page, 'arcade');
      await hitTarget(page.locator('#game-pick-radar')); await page.locator('#game-pick-radar').tap();
      const cells = page.locator('#hunt-grid button'); let reread = false;
      // Complete a real random board using visible grid controls. No targets or state are injected/read.
      for (let index = 0; index < 36; index++) {
        const cell = cells.nth(index), point = await hitTarget(cell);
        // A trusted native tap at the freshly hit-tested centre avoids a second
        // redundant scroll/stability pass for each of the 36 fixed grid cells.
        await page.touchscreen.tap(point.x, point.y);
        const reading = await cell.evaluate(button => ({ signal: button.dataset.signal, text: button.textContent,
          label: button.getAttribute('aria-label'), score: document.getElementById('arcade-score').textContent,
          status: document.getElementById('arcade-status').textContent }));
        expect(['found', 'hot', 'warm', 'cold']).toContain(reading.signal);
        if (!reread && reading.signal !== 'found') {
          expect(reading.text).toMatch(/^[1-9][0-9]?$/);
          expect(reading.label).toMatch(/steps? to the nearest ball/);
          const repeatPoint = await hitTarget(cell);
          await page.touchscreen.tap(repeatPoint.x, repeatPoint.y);
          await expect(page.locator('#arcade-score')).toHaveText(reading.score);
          await expect(page.locator('#arcade-status')).toContainText('no extra scan used'); reread = true;
        }
        if (reading.status.startsWith('All seven')) break;
      }
      await expect(page.locator('#arcade-status')).toContainText('All seven found');
      await expect(page.locator('#hunt-dragon')).toBeVisible();
      await page.locator('#hunt-dragon').evaluate(image => image.decode());
      await expect(page.locator('#arcade-record')).toContainText('best');
      await page.locator('#arcade-reset').tap(); await expect(page.locator('#arcade-score')).toHaveText('0 / 7 · 0 scans');
      await cells.first().focus(); await page.keyboard.press('ArrowLeft'); await expect(cells.first()).toBeFocused();
      await page.keyboard.press('ArrowDown'); await expect(cells.nth(6)).toBeFocused();
      await page.keyboard.press('End'); await expect(cells.nth(11)).toBeFocused();
      await expect(page.locator('#hunt-grid button[tabindex="0"]')).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('Ki capture loss cancels cleanly and keyboard repeat cannot spend extra rounds', async ({ page }) => {
  await page.goto('/'); await command(page, 'ki'); const charge = page.locator('#ki-charge');
  await charge.waitFor(); await controlledClock(page);
  const bounds = await charge.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await runCallbacks(page, 500);
  // Exercise a browser cancellation boundary; this is not a claim of a physical touch test.
  await charge.dispatchEvent('lostpointercapture', { pointerId: 1 }); await page.mouse.up();
  await expect(charge).toHaveText('charge ki');
  await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits · 0 perfect');
  await charge.press('Enter'); await runCallbacks(page, 500);
  await charge.dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await expect(charge).toHaveText('release ki');
  await page.locator('#arcade-reset').focus(); await expect(charge).toHaveText('charge ki');
  await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits · 0 perfect');
  for (const interruption of ['window', 'focus']) {
    await charge.scrollIntoViewIfNeeded(); const rect = await charge.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await runCallbacks(page, 500);
    if (interruption === 'window') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else await page.locator('#arcade-reset').focus();
    await page.mouse.up(); await runCallbacks(page, 2500);
    await expect(charge).toHaveText('charge ki');
    await expect(page.locator('#arcade-score')).toHaveText('1 / 5 · 0 hits · 0 perfect');
  }
});

test('Ki native touch hold releases once and cancellation preserves the next round', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Native touch cancellation requires Chromium CDP; both engines cover ordinary taps.');
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  try {
    const page=await context.newPage(); await page.goto(baseURL); await command(page,'ki');
    const charge=page.locator('#ki-charge'); await hitTarget(charge); await controlledClock(page);
    const cdp=await context.newCDPSession(page), box=await charge.boundingBox();
    const point={id:1,x:box.x+box.width/2,y:box.y+box.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await runCallbacks(page, 1474);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#arcade-status')).toContainText('Perfect control!');
    await expect(charge).toHaveText('charge ki');
    const result=await page.locator('#arcade-score').textContent();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await runCallbacks(page, 400);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await runCallbacks(page, 2500);
    await expect(charge).toHaveText('charge ki');
    await expect(page.locator('#arcade-score')).toHaveText(result);
    await expect(page.locator('#ki-power')).toHaveText('0%');
  } finally { await context.close(); }
});

test('Brick Breaker normal controls produce a perfect return, fair loss, and immediate retry', async ({ page }) => {
  test.setTimeout(60_000);
  // Wrap creation only to observe the unmodified live state. All play uses trusted browser input.
  await page.addInitScript(() => {
    let engine;
    Object.defineProperty(window, 'PortfolioBreakerEngine', { configurable: true,
      get: () => engine, set(value) { engine = { ...value, create(...args) {
        const state = value.create(...args); window.__observedBreaker = state; return state;
      } }; },
    });
  });
  await page.goto('/'); await command(page, 'breaker');
  const canvas = page.locator('#training-canvas'); await canvas.waitFor(); await controlledClock(page);
  const snapshot = () => page.evaluate(() => {
    const g = window.__observedBreaker;
    return { phase: g.phase, time: g.time, lives: g.lives, perfects: g.perfects, score: g.score,
      paddle: { ...g.paddle }, ball: { ...g.ball }, pulseReadyAt: g.pulseReadyAt };
  });
  const box = await canvas.boundingBox(), y = box.y + box.height * .75;
  let dragging = false, cursorX = 0;
  const move = async (x, current) => {
    if (!dragging) {
      cursorX = box.x + current * box.width / 360;
      await page.mouse.move(cursorX, y); await page.mouse.down(); dragging = true;
    }
    cursorX += (x - current) * box.width / 360;
    await page.mouse.move(cursorX, y);
  };
  const endDrag = async () => { if (dragging) { await page.mouse.up(); dragging = false; } };
  const landing = g => {
    const seconds = (g.paddle.y - g.ball.radius - g.ball.y) / g.ball.vy;
    const span = 360 - 2 * g.ball.radius;
    const travel = g.ball.x - g.ball.radius + g.ball.vx * seconds;
    const folded = ((travel % (2 * span)) + 2 * span) % (2 * span);
    return { seconds, x: g.ball.radius + (folded <= span ? folded : 2 * span - folded) };
  };
  await canvas.focus(); await page.keyboard.down('ArrowLeft'); await runCallbacks(page, 100); await page.keyboard.up('ArrowLeft');
  expect((await snapshot()).paddle.x).toBeLessThan(150);
  await page.keyboard.press('Space');
  let game = await snapshot();
  for (let i = 0; i < 48 && !game.perfects; i++) {
    expect(game.phase, 'the first flight must remain playable until its earned return').toBe('playing');
    if (game.ball.vy > 0 && game.ball.y > 180) {
      // Below the shield field, only wall banks can change the landing point.
      // Guide the real pointer there, then earn the perfect with a real Space press.
      const target = landing(game);
      await move(Math.max(34, Math.min(326, target.x)), game.paddle.x);
      if (target.seconds <= .15) {
        expect(target.seconds).toBeGreaterThan(0);
        expect(game.time).toBeGreaterThanOrEqual(game.pulseReadyAt);
        await page.keyboard.press('Space');
        await runCallbacks(page, Math.ceil((target.seconds + .04) * 1000));
      } else await runCallbacks(page, Math.min(200, Math.floor((target.seconds - .1) * 1000)));
    } else await runCallbacks(page, 200);
    game = await snapshot();
  }
  await endDrag();
  expect(game.perfects).toBeGreaterThan(0);
  expect(game.score).toBeGreaterThan(0);
  await page.keyboard.press('p'); const paused = await snapshot(); await runCallbacks(page, 1000);
  expect(await snapshot()).toEqual(paused); await page.keyboard.press('p');
  // Deliberately miss each return through the same real pointer controls.
  // Observing once per quarter-second is enough; the paused clock prevents
  // time from leaking into the intervening browser protocol round trips.
  game = await snapshot();
  for (let i = 0; i < 96 && game.phase !== 'lost'; i++) {
    if (game.phase === 'ready') {
      await endDrag(); await page.keyboard.press('Space'); game = await snapshot();
    }
    const target = game.ball.vy > 0 && game.ball.y > 180 ? landing(game).x : game.ball.x;
    await move(target > 180 ? 34 : 326, game.paddle.x);
    await runCallbacks(page, 250); game = await snapshot();
  }
  await endDrag();
  expect((await snapshot()).phase).toBe('lost'); await expect(page.locator('#training-status')).toContainText('Run complete');
  await page.locator('#training-action').click();
  const retry = await snapshot(); expect(retry.phase).toBe('playing'); expect(retry.lives).toBe(3); expect(retry.score).toBe(0);
  await page.keyboard.press('Escape'); await expect(page.locator('#arcade-picker')).toBeVisible();
});

test('Brick Breaker touch launch, pause, and controls remain reachable on short screens', async ({ browser, baseURL }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 375 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(); await page.goto(baseURL); await command(page, 'breaker');
      const canvas = page.locator('#training-canvas'), pause = page.locator('#training-pause');
      await canvas.waitFor(); await controlledClock(page); await hitTarget(canvas); await canvas.tap();
      await expect(page.locator('#training-action')).toHaveText('pulse · space');
      await runCallbacks(page, 1800); expect(Number(await page.locator('#training-score').textContent())).toBeGreaterThan(0);
      await hitTarget(pause); await pause.tap(); await expect(page.locator('#training-status')).toHaveText('training paused');
      await runCallbacks(page, 1000); await expect(page.locator('#training-status')).toHaveText('training paused');
      await pause.tap(); await expect(pause).toHaveAttribute('aria-pressed', 'false');
      for (const selector of ['#training-action', '[data-training-close]', '#training-dialog [data-arcade-open]']) {
        await hitTarget(page.locator(selector));
      }
      await page.locator('#training-dialog [data-arcade-open]').tap(); await expect(page.locator('#arcade-picker')).toBeVisible();
    } finally { await context.close(); }
  }
});
