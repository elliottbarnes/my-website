import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createGame, parseBest, readBest, saveBest, clearBest } = require("../assets/interactive/arcade.js");

function pairIndices(game, signal) {
  return game.state.deck.flatMap((value, index) => value === signal ? [index] : []);
}

test("a shuffled board has exactly six pairs and a fresh state", () => {
  for (const random of [() => 0, () => 0.999999, Math.random]) {
    const game = createGame(random);
    assert.equal(game.state.deck.length, 12);
    for (let signal = 1; signal <= 6; signal += 1) assert.equal(pairIndices(game, signal).length, 2);
    assert.deepEqual(game.state.revealed, []);
    assert.deepEqual(game.state.matched, []);
    assert.equal(game.state.turns, 0);
    assert.equal(game.state.phase, "ready");
  }
});

test("mismatches stay visible until the player explicitly continues", () => {
  const game = createGame(() => 0.9);
  const first = pairIndices(game, 1)[0], second = pairIndices(game, 2)[0];
  assert.equal(game.select(first), true);
  assert.equal(game.state.phase, "picking");
  assert.equal(game.state.turns, 0);
  assert.equal(game.select(second), true);
  assert.equal(game.state.phase, "mismatch");
  assert.equal(game.state.turns, 1);
  assert.deepEqual(game.state.revealed, [first, second]);
  assert.equal(game.select(pairIndices(game, 3)[0]), false);
  assert.equal(game.state.turns, 1);
  assert.equal(game.next(), true);
  assert.deepEqual(game.state.revealed, []);
  assert.equal(game.state.phase, "ready");
  assert.equal(game.next(), false);
});

test("duplicate flips, matched cards, and invalid selections never consume turns", () => {
  const game = createGame();
  for (const index of [-1, 12, 0.5, NaN, "1", null]) assert.equal(game.select(index), false);
  const [first, second] = pairIndices(game, 1);
  game.select(first);
  assert.equal(game.select(first), false);
  assert.equal(game.state.turns, 0);
  game.select(second);
  assert.equal(game.state.turns, 1);
  assert.equal(game.state.phase, "ready");
  assert.deepEqual(game.state.matched, [first, second]);
  assert.equal(game.select(first), false);
  assert.equal(game.select(second), false);
  assert.equal(game.state.turns, 1);
});

test("six matched pairs complete a perfect game and reset clears progress", () => {
  const game = createGame();
  for (let signal = 1; signal <= 6; signal += 1) {
    pairIndices(game, signal).forEach((index) => game.select(index));
  }
  assert.equal(game.state.phase, "complete");
  assert.equal(game.state.turns, 6);
  assert.equal(game.state.matched.length, 12);
  assert.equal(game.select(0), false);
  assert.equal(game.next(), false);
  game.reset();
  assert.equal(game.state.phase, "ready");
  assert.equal(game.state.turns, 0);
  assert.deepEqual(game.state.matched, []);
  assert.deepEqual(game.state.revealed, []);
});

test("state snapshots cannot change the game behind its controls", () => {
  const game = createGame();
  const state = game.state;
  state.deck.fill(0);
  state.revealed.push(0);
  state.matched.push(1);
  state.turns = 900;
  assert.ok(game.state.deck.every((signal) => signal >= 1 && signal <= 6));
  assert.deepEqual(game.state.revealed, []);
  assert.deepEqual(game.state.matched, []);
  assert.equal(game.state.turns, 0);
});

test("best scores reject corruption and impossible results", () => {
  for (const invalid of [null, undefined, "", " ", "0", "5", "-6", "6.1", "6turns", "NaN", "Infinity", "9007199254740992"]) {
    assert.equal(parseBest(invalid), null);
  }
  assert.equal(parseBest("6"), 6);
  assert.equal(parseBest("24"), 24);
});

test("persistence retains the fewest turns and allows removing the saved score", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  assert.equal(readBest(storage), null);
  assert.equal(saveBest(storage, 12), true);
  assert.equal(readBest(storage), 12);
  assert.equal(saveBest(storage, 20), true);
  assert.equal(readBest(storage), 12);
  assert.equal(saveBest(storage, 8), true);
  assert.equal(readBest(storage), 8);
  assert.equal(saveBest(storage, 2), false);
  assert.equal(readBest(storage), 8);
  assert.equal(clearBest(storage), true);
  assert.equal(readBest(storage), null);
});

test("unavailable or blocked browser storage does not prevent playing", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  for (const storage of [undefined, null, blocked]) {
    assert.equal(readBest(storage), null);
    assert.equal(saveBest(storage, 8), false);
    assert.equal(clearBest(storage), false);
  }
  const game = createGame();
  pairIndices(game, 1).forEach((index) => game.select(index));
  assert.equal(game.state.turns, 1);
});
