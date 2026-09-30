import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { QUESTIONS, ROUND_LENGTH, createGame, parseBest, readBest, saveBest, clearBest } = require("../assets/interactive/arcade.js");

function finish(game, correct = true) {
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    const question = game.state.questions[game.state.index];
    game.select(correct ? question.correctIndex : (question.correctIndex + 1) % 4);
    game.next();
  }
}

test("the bank has distinct questions, four unique options, and exactly one correct answer each", () => {
  assert.equal(QUESTIONS.length, 10);
  assert.equal(new Set(QUESTIONS.map(question => question.id)).size, QUESTIONS.length);
  assert.equal(new Set(QUESTIONS.map(question => question.prompt)).size, QUESTIONS.length);
  for (const question of QUESTIONS) {
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.equal(question.choices.filter(choice => choice === question.answer).length, 1);
    assert.ok(question.fact.length > 0);
  }
});

test("every round picks five distinct questions and preserves answers through shuffling", () => {
  const orders = new Set();
  for (const random of [() => 0, () => 0.45, () => 0.999999, Math.random]) {
    const game = createGame(random);
    const state = game.state;
    assert.equal(state.questions.length, ROUND_LENGTH);
    assert.equal(new Set(state.questions.map(question => question.id)).size, ROUND_LENGTH);
    for (const question of state.questions) {
      const original = QUESTIONS.find(item => item.id === question.id);
      assert.equal(new Set(question.choices).size, 4);
      assert.deepEqual([...question.choices].sort(), [...original.choices].sort());
      assert.equal(question.choices[question.correctIndex], original.answer);
    }
    orders.add(state.questions.map(question => question.id).join(","));
    assert.equal(state.phase, "question");
    assert.equal(state.index, 0);
    assert.equal(state.selected, null);
    assert.equal(state.score, 0);
    assert.deepEqual(state.answers, Array(ROUND_LENGTH).fill(null));
  }
  assert.ok(orders.size > 1);
});

test("answers remain visible and locked until the player explicitly continues", () => {
  const game = createGame();
  const answer = game.state.questions[0].correctIndex;
  assert.equal(game.select(answer), true);
  assert.equal(game.state.phase, "answered");
  assert.equal(game.state.selected, answer);
  assert.equal(game.state.score, 1);
  assert.equal(game.select(answer), false);
  assert.equal(game.select((answer + 1) % 4), false);
  assert.equal(game.state.score, 1);
  assert.equal(game.state.index, 0);
  assert.equal(game.next(), true);
  assert.equal(game.state.index, 1);
  assert.equal(game.state.selected, null);
  assert.equal(game.state.phase, "question");
  assert.equal(game.next(), false);
  assert.equal(game.state.index, 1);
});

test("invalid answers and attempts to skip never change progress", () => {
  const game = createGame();
  const before = game.state;
  for (const index of [-1, 4, 0.5, NaN, Infinity, "1", null, undefined]) {
    assert.equal(game.select(index), false);
  }
  assert.equal(game.next(), false);
  assert.deepEqual(game.state, before);
});

test("a wrong answer cannot be retried for points", () => {
  const game = createGame();
  const correct = game.state.questions[0].correctIndex;
  const wrong = (correct + 1) % 4;
  assert.equal(game.select(wrong), true);
  assert.equal(game.select(correct), false);
  assert.equal(game.state.score, 0);
  assert.equal(game.state.selected, wrong);
  assert.equal(game.state.answers[0], false);
});

test("the last answer still shows feedback before results, then all controls lock", () => {
  const game = createGame();
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    assert.equal(game.select(game.state.questions[index].correctIndex), true);
    assert.equal(game.state.phase, "answered");
    assert.equal(game.state.score, index + 1);
    if (index < ROUND_LENGTH - 1) assert.equal(game.next(), true);
  }
  assert.equal(game.state.index, 4);
  assert.equal(game.state.phase, "answered");
  assert.equal(game.next(), true);
  assert.equal(game.state.phase, "complete");
  assert.equal(game.state.score, 5);
  assert.deepEqual(game.state.answers, Array(ROUND_LENGTH).fill(true));
  assert.equal(game.select(0), false);
  assert.equal(game.next(), false);
  assert.equal(game.state.score, 5);
});

test("mixed and zero-score rounds finish correctly, and reset clears all progress", () => {
  const game = createGame();
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    const correct = game.state.questions[index].correctIndex;
    game.select(index % 2 === 0 ? correct : (correct + 1) % 4);
    game.next();
  }
  assert.equal(game.state.score, 3);
  assert.equal(game.state.phase, "complete");
  assert.deepEqual(game.state.answers, [true, false, true, false, true]);
  game.reset();
  assert.equal(game.state.phase, "question");
  assert.equal(game.state.index, 0);
  assert.equal(game.state.score, 0);
  assert.equal(game.state.selected, null);
  assert.deepEqual(game.state.answers, Array(ROUND_LENGTH).fill(null));
  finish(game, false);
  assert.equal(game.state.phase, "complete");
  assert.equal(game.state.score, 0);
});

test("state snapshots and the question bank cannot change the game behind its controls", () => {
  const game = createGame();
  const state = game.state;
  state.questions[0].choices.fill("changed");
  state.questions[0].correctIndex = 900;
  state.questions[0].prompt = "changed";
  state.questions.splice(1);
  state.answers.fill(true);
  state.score = 900;
  assert.equal(game.state.questions.length, ROUND_LENGTH);
  assert.ok(game.state.questions[0].choices.every(choice => choice !== "changed"));
  assert.notEqual(game.state.questions[0].correctIndex, 900);
  assert.notEqual(game.state.questions[0].prompt, "changed");
  assert.deepEqual(game.state.answers, Array(ROUND_LENGTH).fill(null));
  assert.equal(game.state.score, 0);
  assert.throws(() => QUESTIONS[0].choices.fill("changed"), TypeError);
  assert.throws(() => { QUESTIONS[0].answer = "changed"; }, TypeError);
});

test("best scores accept only whole scores from zero through five", () => {
  for (const invalid of [null, undefined, 0, 5, "", " ", "00", "05", "6", "-1", "3.0", "1.5", "5points", "NaN", "Infinity", "9007199254740992"]) {
    assert.equal(parseBest(invalid), null);
  }
  for (let score = 0; score <= ROUND_LENGTH; score += 1) assert.equal(parseBest(String(score)), score);
});

test("persistence keeps the highest trivia score and never reads or overwrites the old game", () => {
  const values = new Map([["elliott-signal-match-best", "6"]]);
  const reads = [];
  const storage = {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  assert.equal(readBest(storage), null);
  assert.equal(saveBest(storage, 0), true);
  assert.equal(readBest(storage), 0);
  assert.equal(saveBest(storage, 3), true);
  assert.equal(saveBest(storage, 2), true);
  assert.equal(readBest(storage), 3);
  assert.equal(saveBest(storage, 5), true);
  assert.equal(readBest(storage), 5);
  for (const score of [-1, 6, 2.5, NaN, Infinity, "3", null, undefined]) {
    assert.equal(saveBest(storage, score), false);
  }
  assert.equal(readBest(storage), 5);
  assert.ok(reads.every(key => key === "elliott-dragon-ball-trivia-best"));
  assert.equal(values.get("elliott-signal-match-best"), "6");
  assert.equal(clearBest(storage), true);
  assert.equal(readBest(storage), null);
  assert.equal(values.get("elliott-signal-match-best"), "6");
});

test("a corrupt stored value is ignored and replaced by a valid completed score", () => {
  let value = "44";
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  assert.equal(readBest(storage), null);
  assert.equal(saveBest(storage, 2), true);
  assert.equal(readBest(storage), 2);
});

test("unavailable or blocked storage does not prevent a complete round", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  for (const storage of [undefined, null, blocked]) {
    assert.equal(readBest(storage), null);
    assert.equal(saveBest(storage, 5), false);
    assert.equal(clearBest(storage), false);
  }
  const game = createGame();
  finish(game);
  assert.equal(game.state.phase, "complete");
  assert.equal(game.state.score, 5);
});
