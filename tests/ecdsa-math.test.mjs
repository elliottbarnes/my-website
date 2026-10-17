import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

await import("../assets/ecdsa-math.js");
const math = globalThis.PortfolioECDSA;
const { CURVE, POINTS, mod, inverse, add, multiply, sign, verify, verifyDetails, makeDemo } = math;

// Independently tabulated multiples for y² = x³ + 2x + 2 (mod 17), G = (5, 1).
const multiples = [null, [5, 1], [6, 3], [10, 6], [3, 1], [9, 16], [16, 13],
  [0, 6], [13, 7], [7, 6], [7, 11], [13, 10], [0, 11], [16, 4], [9, 1],
  [3, 16], [10, 11], [6, 14], [5, 16]].map(point => point && { x: point[0], y: point[1] });

test("the module also exposes the browser API without Node dependencies", async () => {
  const window = {};
  vm.runInNewContext(await readFile(new URL("../assets/ecdsa-math.js", import.meta.url), "utf8"), { window });
  assert.equal(window.PortfolioECDSA.makeDemo().signature.s, 8);
});

test("field and scalar arithmetic use their different prime moduli", () => {
  assert.equal(mod(-1, 17), 16);
  assert.equal(mod(-19, 19), 0);
  assert.equal(inverse(3, 19), 13);
  assert.equal(inverse(3, 17), 6);
  assert.equal(inverse(-3, 19), 6);
  for (const prime of [17, 19]) {
    for (let value = 1; value < prime; value++) assert.equal(mod(value * inverse(value, prime), prime), 1);
  }
  for (const args of [[0, 19], [6, 9], [1, 1]]) assert.throws(() => inverse(...args), RangeError);
  for (const args of [[1.5, 17], [1, 0], [1, -17], [NaN, 19]]) assert.throws(() => mod(...args), RangeError);
});

test("the curve has 18 finite points and the generator visits each exactly once", () => {
  assert.equal(POINTS.length, 18);
  const pointSet = new Set(POINTS.map(point => `${point.x},${point.y}`));
  for (let scalar = 0; scalar < 19; scalar++) {
    assert.deepEqual(multiply(scalar), multiples[scalar]);
    if (scalar) assert.ok(pointSet.has(`${multiples[scalar].x},${multiples[scalar].y}`));
  }
  assert.equal(multiply(19), null);
  assert.deepEqual(multiply(-1), { x: 5, y: 16 });
  assert.deepEqual(multiply(20), CURVE.G);
});

test("addition respects infinity, inverses, doubling, and the full group table", () => {
  assert.equal(add(null, null), null);
  assert.deepEqual(add(null, CURVE.G), CURVE.G);
  assert.deepEqual(add(CURVE.G, null), CURVE.G);
  assert.deepEqual(add(CURVE.G, CURVE.G), { x: 6, y: 3 });
  assert.equal(add(CURVE.G, { x: 5, y: 16 }), null);
  for (let left = 0; left < 19; left++) {
    for (let right = 0; right < 19; right++) {
      assert.deepEqual(add(multiples[left], multiples[right]), multiples[(left + right) % 19]);
    }
  }
});

test("invalid points and scalars cannot enter the arithmetic", () => {
  for (const point of [undefined, {}, { x: 1, y: 1 }, { x: 22, y: 1 }, { x: 5.1, y: 1 }]) {
    assert.equal(math.isOnCurve(point), false);
    assert.throws(() => add(point, CURVE.G), RangeError);
    if (point !== undefined) assert.throws(() => multiply(3, point), RangeError);
  }
  for (const scalar of [NaN, Infinity, 1.5, "3"]) assert.throws(() => multiply(scalar), RangeError);
  assert.equal(multiply(5, null), null);
});

test("the default demo signs and reconstructs the exact nonce point", () => {
  const demo = makeDemo();
  assert.deepEqual(demo.publicKey, { x: 0, y: 6 });
  assert.deepEqual(demo.noncePoint, { x: 10, y: 6 });
  assert.equal(demo.nonceInverse, 13);
  assert.deepEqual(demo.signature, { r: 10, s: 8 });
  assert.deepEqual(demo.verification, { valid: true, w: 12, u1: 18, u2: 6,
    leftPoint: { x: 5, y: 16 }, rightPoint: { x: 3, y: 1 }, point: { x: 10, y: 6 },
    xModN: 10, reason: "valid" });
  assert.equal(demo.keySteps.length, 8);
  assert.equal(demo.nonceSteps.length, 4);
  for (const step of [...demo.keySteps, ...demo.nonceSteps]) assert.deepEqual(step.point, multiples[step.scalar]);
});

test("changing the digest preserves the signature and fails verification", () => {
  const { signature, publicKey } = makeDemo();
  const result = verifyDetails(12, signature, publicKey);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "mismatch");
  assert.equal(result.xModN, 3);
  assert.deepEqual(result.point, { x: 3, y: 16 });
  assert.deepEqual(signature, { r: 10, s: 8 });
  assert.equal(verify(11, signature, multiply(8)), false);
});

test("zero components request a new nonce instead of returning an invalid signature", () => {
  assert.throws(() => sign(11, 7, 7), /zero signature component/);
  assert.throws(() => sign(6, 7, 3), /zero signature component/);
  for (const value of [0, 19, -1, 1.5, NaN]) {
    assert.throws(() => sign(11, value, 3), RangeError);
    assert.throws(() => sign(11, 7, value), RangeError);
  }
  assert.throws(() => sign(-1, 7, 3), RangeError);
});

test("verification rejects invalid component bounds, keys, hashes, and infinity", () => {
  const { signature, publicKey } = makeDemo();
  for (const value of [0, 19, -1, 1.5, NaN, "10"]) {
    assert.equal(verify(11, { r: value, s: 8 }, publicKey), false);
    assert.equal(verify(11, { r: 10, s: value }, publicKey), false);
  }
  for (const invalidSignature of [null, undefined, {}]) assert.equal(verify(11, invalidSignature, publicKey), false);
  for (const key of [null, undefined, { x: 1, y: 1 }]) assert.equal(verify(11, signature, key), false);
  for (const hash of [-1, NaN, Infinity, "11"]) assert.equal(verify(hash, signature, publicKey), false);
  const infinity = verifyDetails(6, signature, publicKey);
  assert.equal(infinity.valid, false);
  assert.equal(infinity.point, null);
  assert.equal(infinity.reason, "infinity");
});

test("all nonzero signatures on this small curve verify, including zero digest", () => {
  let checked = 0;
  for (let privateKey = 1; privateKey < 19; privateKey++) {
    const publicKey = multiples[privateKey];
    for (let nonce = 1; nonce < 19; nonce++) {
      const r = multiples[nonce].x;
      for (let hash = 0; hash < 19; hash++) {
        if (r === 0 || (hash + r * privateKey) % 19 === 0) continue;
        const signature = sign(hash, privateKey, nonce);
        assert.ok(verify(hash, signature, publicKey));
        checked++;
      }
    }
  }
  assert.equal(checked, 5184);
});
