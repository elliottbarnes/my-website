import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('../../assets/piccolo-lookout.js');

// This test-only observer returns copies. It cannot mutate the running game.
// Every change to the game below comes through normal browser keyboard events.
export async function openPiccolo(page) {
  await page.route(/\/assets\/piccolo-lookout(?:\.[a-f0-9]+)?\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    assert.ok(body.includes('let storage;'), 'read-only observer insertion point');
    await route.fulfill({ response, body: body.replace('let storage;', "Object.defineProperty(window, '__piccoloSnapshot', { value: () => JSON.parse(JSON.stringify(game)) }); let storage;") });
  });
  await page.goto('/');
  await page.locator('.scene-body').focus();
  await page.keyboard.press('/');
  await page.locator('#command-input').fill('piccolo');
  await page.locator('#command-input').press('Enter');
  await page.locator('#piccolo-start').waitFor();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.locator('#piccolo-start').click();
  await page.clock.runFor(32);
}

export function piccoloDriver(page) {
  let held = new Set();
  const state = () => page.evaluate(() => window.__piccoloSnapshot());
  async function input(control = {}, ms = 16) {
    const wanted = new Set([
      ...(control.x ? [control.x > 0 ? 'ArrowRight' : 'ArrowLeft'] : []),
      ...(control.y ? [control.y > 0 ? 'ArrowDown' : 'ArrowUp'] : []),
      ...(control.action ? ['z'] : []),
    ]);
    for (const key of held) if (!wanted.has(key)) await page.keyboard.up(key);
    for (const key of wanted) if (!held.has(key)) await page.keyboard.down(key);
    held = wanted;
    await page.clock.runFor(ms);
    return state();
  }
  async function walkTo(tx, ty) {
    let game = await state();
    const key = (x, y) => `${x},${y}`;
    const sx = Math.round(game.player.x / 8) * 8, sy = Math.round(game.player.y / 8) * 8;
    const queue = [[sx, sy]], previous = new Map([[key(sx, sy), null]]); let end;
    for (let index = 0; index < queue.length; index++) {
      const [x, y] = queue[index]; if (Math.hypot(x - tx, y - ty) < 5) { end = [x, y]; break; }
      for (const [dx, dy] of [[0, -8], [8, 0], [0, 8], [-8, 0]]) {
        const nx = x + dx, ny = y + dy, id = key(nx, ny);
        if (!previous.has(id) && engine.canStand(game, nx, ny)) { previous.set(id, [x, y]); queue.push([nx, ny]); }
      }
    }
    assert.ok(end, `walkable route to ${tx},${ty}`); const route = [];
    while (previous.get(key(...end))) { route.push(end); end = previous.get(key(...end)); }
    const points = route.reverse().filter((point, index, all) => index === all.length - 1 || index === 0 ||
      Math.sign(point[0] - all[index - 1][0]) !== Math.sign(all[index + 1][0] - point[0]) ||
      Math.sign(point[1] - all[index - 1][1]) !== Math.sign(all[index + 1][1] - point[1]));
    for (const [x, y] of points) {
      let tries = 0;
      while (Math.hypot(game.player.x - x, game.player.y - y) > 1.3 && tries++ < 150) {
        const dx = x - game.player.x, dy = y - game.player.y;
        const ms = Math.max(16, Math.min(240, Math.floor(Math.max(Math.abs(dx), Math.abs(dy)) / 68 * 1000 / 16) * 16));
        game = await input({ x: Math.abs(dx) > .65 ? Math.sign(dx) : 0, y: Math.abs(dy) > .65 ? Math.sign(dy) : 0 }, ms);
        assert.notEqual(game.phase, 'lost', `survive normal walk in room ${game.room + 1}`);
      }
      assert.ok(tries < 150, `not stuck at ${game.player.x},${game.player.y} walking to ${x},${y}`);
    }
    await input();
  }
  const charge = async () => { await input({ action: true }, 848); return input({}, 32); };
  const quick = async () => { await input({ action: true }, 32); return input({}, 400); };
  const next = async room => { await walkTo(304, 96); const game = await input({ x: 1 }, 240); assert.equal(game.room, room); await input(); };
  async function complete(onRoom = async () => {}) {
    await charge(); await onRoom(await state()); await next(1);
    await walkTo(152, 168); await input({ y: -1 }); await charge();
    await walkTo(248, 168); await input({ y: -1 }); await charge(); await onRoom(await state()); await next(2);
    await walkTo(32, 48); await input({ x: 1 }); await charge();
    await walkTo(104, 144); await input({ x: 1 }); await charge(); await onRoom(await state()); await next(3);
    await walkTo(72, 96); await input({ y: -1 }); await charge();
    await walkTo(248, 128); await input({ y: 1 }); await quick(); await onRoom(await state()); await next(4);
    await walkTo(152, 88); await input({ y: -1 }); await charge();
    await walkTo(248, 168); await input({ y: -1 }); await charge(); await onRoom(await state()); await next(5);
    await walkTo(32, 48); await input({ x: 1 }); await charge();
    await walkTo(160, 168); await input({ y: -1 });
    for (let i = 0; i < 750; i++) {
      const game = await state(), keeper = game.rooms[5].guards[0], offset = keeper.x - game.player.x;
      if (keeper.hp <= 0) break;
      assert.equal(game.phase, 'playing', 'normal-input keeper fight survives');
      if (game.player.charge + 1e-9 >= engine.CHARGE_TIME && keeper.exposed > .1 && Math.abs(offset) < 8) await input({}, 32);
      else await input({ action: true, x: Math.abs(offset) > 3 ? Math.sign(offset) : 0 }, 48);
    }
    assert.ok(engine.unlocked(await state())); await onRoom(await state());
    await walkTo(160, 56); await quick();
    const game = await state(); assert.equal(game.phase, 'won'); return game;
  }
  return { state, input, walkTo, charge, quick, next, complete };
}
