// Educational arithmetic on a tiny curve. Never use this module for real keys or signatures.
// ECDSA equations: SEC 1 v2.0, sections 4.1.3 and 4.1.4: https://www.secg.org/sec1-v2.pdf
// `hash` is an already-derived integer representative, not a cryptographic hash function.
(() => {
  const CURVE = Object.freeze({ p: 17, a: 2, b: 2, n: 19, G: Object.freeze({ x: 5, y: 1 }) });
  const { p, a, b, n, G } = CURVE;
  const copy = point => point === null ? null : { x: point.x, y: point.y };
  const validScalar = value => Number.isSafeInteger(value) && value > 0 && value < n;
  const validHash = value => Number.isSafeInteger(value) && value >= 0;

  function mod(value, modulus) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(modulus) || modulus <= 0) {
      throw new RangeError("Modulo requires integers and a positive modulus.");
    }
    return ((value % modulus) + modulus) % modulus;
  }

  function inverse(value, modulus) {
    let remainder = modulus, nextRemainder = mod(value, modulus);
    let coefficient = 0, nextCoefficient = 1;
    if (modulus < 2) throw new RangeError("An inverse requires a modulus greater than one.");
    while (nextRemainder !== 0) {
      const quotient = Math.floor(remainder / nextRemainder);
      [remainder, nextRemainder] = [nextRemainder, remainder - quotient * nextRemainder];
      [coefficient, nextCoefficient] = [nextCoefficient, coefficient - quotient * nextCoefficient];
    }
    if (remainder !== 1) throw new RangeError("This value has no modular inverse.");
    return mod(coefficient, modulus);
  }

  // null is the identity point, conventionally written O (the point at infinity).
  function isOnCurve(point) {
    if (point === null) return true;
    return !!point && Number.isInteger(point.x) && Number.isInteger(point.y)
      && point.x >= 0 && point.x < p && point.y >= 0 && point.y < p
      && mod(point.y * point.y - point.x * point.x * point.x - a * point.x - b, p) === 0;
  }

  function add(left, right) {
    if (!isOnCurve(left) || !isOnCurve(right)) throw new RangeError("Point is not on the demo curve.");
    if (left === null) return copy(right);
    if (right === null) return copy(left);
    if (left.x === right.x && mod(left.y + right.y, p) === 0) return null;
    const samePoint = left.x === right.x && left.y === right.y;
    const slope = samePoint
      ? mod((3 * left.x * left.x + a) * inverse(2 * left.y, p), p)
      : mod((right.y - left.y) * inverse(right.x - left.x, p), p);
    const x = mod(slope * slope - left.x - right.x, p);
    return { x, y: mod(slope * (left.x - x) - left.y, p) };
  }

  function multiply(scalar, point = G) {
    if (!Number.isSafeInteger(scalar)) throw new RangeError("Scalar must be an integer.");
    if (!isOnCurve(point)) throw new RangeError("Point is not on the demo curve.");
    // Every nonidentity point on this particular curve has order 19.
    let remaining = mod(scalar, n), result = null, next = copy(point);
    while (remaining > 0) {
      if (remaining % 2 === 1) result = add(result, next);
      next = add(next, next);
      remaining = Math.floor(remaining / 2);
    }
    return result;
  }

  function sign(hash, privateKey, nonce) {
    if (!validHash(hash)) throw new RangeError("Hash representative must be a nonnegative integer.");
    if (!validScalar(privateKey) || !validScalar(nonce)) {
      throw new RangeError("Private key and nonce must be integers from 1 to 18.");
    }
    const noncePoint = multiply(nonce);
    const r = mod(noncePoint.x, n);
    const s = mod(inverse(nonce, n) * (mod(hash, n) + r * privateKey), n);
    // A real signer retries with another securely generated nonce. This demo reports it explicitly.
    if (r === 0 || s === 0) throw new RangeError("This nonce produces a zero signature component; choose another nonce.");
    return { r, s };
  }

  function verifyDetails(hash, signature, publicKey) {
    const result = { valid: false, w: null, u1: null, u2: null, leftPoint: null,
      rightPoint: null, point: null, xModN: null, reason: "signature" };
    if (!signature || !validScalar(signature.r) || !validScalar(signature.s)) return result;
    if (!validHash(hash)) return { ...result, reason: "hash" };
    // This curve has prime order 19, so every finite curve point is in G's subgroup.
    if (publicKey === null || !isOnCurve(publicKey)) {
      return { ...result, reason: "public-key" };
    }
    const w = inverse(signature.s, n);
    const u1 = mod(mod(hash, n) * w, n), u2 = mod(signature.r * w, n);
    const leftPoint = multiply(u1), rightPoint = multiply(u2, publicKey);
    const point = add(leftPoint, rightPoint);
    const xModN = point === null ? null : mod(point.x, n);
    const valid = point !== null && xModN === signature.r;
    return { valid, w, u1, u2, leftPoint, rightPoint, point, xModN,
      reason: valid ? "valid" : point === null ? "infinity" : "mismatch" };
  }

  function verify(hash, signature, publicKey) {
    return verifyDetails(hash, signature, publicKey).valid;
  }

  function steps(scalar) {
    const result = [{ scalar: 0, point: null }];
    for (let index = 1; index <= scalar; index++) {
      result.push({ scalar: index, point: add(result[index - 1].point, G) });
    }
    return result;
  }

  function makeDemo({ privateKey = 7, nonce = 3, hash = 11 } = {}) {
    const signature = sign(hash, privateKey, nonce);
    const publicKey = multiply(privateKey), noncePoint = multiply(nonce);
    return { privateKey, nonce, hash, publicKey, noncePoint, nonceInverse: inverse(nonce, n),
      signature, verification: verifyDetails(hash, signature, publicKey),
      keySteps: steps(privateKey), nonceSteps: steps(nonce) };
  }

  const points = [];
  for (let x = 0; x < p; x++) {
    for (let y = 0; y < p; y++) {
      if (isOnCurve({ x, y })) points.push(Object.freeze({ x, y }));
    }
  }
  const POINTS = Object.freeze(points);
  const root = typeof window === "undefined" ? globalThis : window;
  root.PortfolioECDSA = Object.freeze({ CURVE, POINTS, mod, inverse, isOnCurve,
    add, multiply, sign, verify, verifyDetails, makeDemo });
})();
