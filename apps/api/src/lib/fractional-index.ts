/**
 * Fractional indexing — ordering keys that can always be inserted between.
 *
 * Two people adding an item to the same spot at the same time must not have to
 * agree on an integer. Instead every item carries an opaque string key, and
 * "insert between X and Y" produces a new key that sorts strictly between them
 * without touching any other row. One INSERT, no renumbering, no lock beyond
 * the row itself.
 *
 * Keys are base62 (`0-9A-Za-z`, which is already in ASCII order) so the
 * ordering that Postgres produces with `COLLATE "C"` is byte-identical to the
 * one JavaScript and Dart produce with a plain `<` comparison. That equality is
 * load-bearing: the server sorts, the clients re-sort locally, and they must
 * never disagree.
 *
 * This is a TypeScript port of the algorithm described in David Greenspan's
 * "Implementing Fractional Indexing" (the `fractional-indexing` reference
 * implementation), kept here rather than added as a dependency because the
 * Dart client needs a line-by-line twin of it.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0]!;
const LAST = DIGITS[DIGITS.length - 1]!;

/** The key used for the very first item in an empty list. */
export const FIRST_KEY = 'a0';

export class OrderKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderKeyError';
  }
}

/**
 * The integer part of a key is self-delimiting: its first character encodes how
 * many digits follow. `a`-`z` are positive magnitudes (2..27 chars total),
 * `A`-`Z` are negative ones. That is what lets `a0` sit next to `Zz` and still
 * compare correctly as plain text.
 */
function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new OrderKeyError(`invalid order key head: ${head}`);
}

function integerPart(key: string): string {
  const len = integerLength(key[0]!);
  if (len > key.length) throw new OrderKeyError(`invalid order key: ${key}`);
  return key.slice(0, len);
}

function assertValidInteger(int: string): void {
  if (int.length !== integerLength(int[0]!)) {
    throw new OrderKeyError(`invalid integer part of order key: ${int}`);
  }
}

/** Throws unless `key` is something this module could have produced. */
export function assertValidKey(key: string): void {
  if (key === '') throw new OrderKeyError('empty order key');
  if (key === `A${ZERO.repeat(26)}`) throw new OrderKeyError(`invalid order key: ${key}`);
  const int = integerPart(key);
  const frac = key.slice(int.length);
  // A trailing zero would give two distinct spellings of the same position.
  if (frac.endsWith(ZERO)) throw new OrderKeyError(`invalid order key: ${key}`);
}

export function isValidKey(key: string): boolean {
  try {
    assertValidKey(key);
    return true;
  } catch {
    return false;
  }
}

function incrementInteger(x: string): string | null {
  assertValidInteger(x);
  const head = x[0]!;
  const digs = x.slice(1).split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]!) + 1;
    if (d === DIGITS.length) {
      digs[i] = ZERO;
    } else {
      digs[i] = DIGITS[d]!;
      carry = false;
    }
  }
  if (!carry) return head + digs.join('');
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null; // Ran out of magnitudes; caller falls back.
  const next = String.fromCharCode(head.charCodeAt(0) + 1);
  if (next > 'a') digs.push(ZERO);
  else digs.pop();
  return next + digs.join('');
}

function decrementInteger(x: string): string | null {
  assertValidInteger(x);
  const head = x[0]!;
  const digs = x.slice(1).split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]!) - 1;
    if (d === -1) {
      digs[i] = LAST;
    } else {
      digs[i] = DIGITS[d]!;
      borrow = false;
    }
  }
  if (!borrow) return head + digs.join('');
  if (head === 'a') return `Z${LAST}`;
  if (head === 'A') return null;
  const prev = String.fromCharCode(head.charCodeAt(0) - 1);
  if (prev < 'Z') digs.push(LAST);
  else digs.pop();
  return prev + digs.join('');
}

/** A fractional string strictly between `a` and `b`, both fractional parts. */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new OrderKeyError(`${a} >= ${b}`);
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new OrderKeyError('trailing zero in fractional part');
  }
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a === '' ? 0 : DIGITS.indexOf(a[0]!);
  const digitB = b === null ? DIGITS.length : DIGITS.indexOf(b[0]!);
  if (digitB - digitA > 1) {
    return DIGITS[Math.round(0.5 * (digitA + digitB))]!;
  }
  // The leading digits are adjacent, so we have to descend a level.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

/**
 * Returns a key that sorts strictly after `a` and strictly before `b`.
 * Pass `null` for either bound to mean "the start" or "the end" of the list.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) assertValidKey(a);
  if (b !== null) assertValidKey(b);
  if (a !== null && b !== null && a >= b) throw new OrderKeyError(`${a} >= ${b}`);

  if (a === null) {
    if (b === null) return FIRST_KEY;
    const intB = integerPart(b);
    const fracB = b.slice(intB.length);
    if (intB === `A${ZERO.repeat(26)}`) return intB + midpoint('', fracB);
    if (intB < b) return intB;
    const dec = decrementInteger(intB);
    if (dec === null) throw new OrderKeyError('cannot decrement any further');
    return dec;
  }

  if (b === null) {
    const intA = integerPart(a);
    const fracA = a.slice(intA.length);
    const inc = incrementInteger(intA);
    return inc === null ? intA + midpoint(fracA, null) : inc;
  }

  const intA = integerPart(a);
  const fracA = a.slice(intA.length);
  const intB = integerPart(b);
  const fracB = b.slice(intB.length);
  if (intA === intB) return intA + midpoint(fracA, fracB);
  const inc = incrementInteger(intA);
  if (inc === null) throw new OrderKeyError('cannot increment any further');
  if (inc < b) return inc;
  return intA + midpoint(fracA, null);
}

/** `n` evenly-spread keys between the two bounds, in order. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [keyBetween(a, b)];
  if (b === null) {
    let cur = keyBetween(a, b);
    const out = [cur];
    for (let i = 1; i < n; i++) {
      cur = keyBetween(cur, b);
      out.push(cur);
    }
    return out;
  }
  if (a === null) {
    let cur = keyBetween(a, b);
    const out = [cur];
    for (let i = 1; i < n; i++) {
      cur = keyBetween(a, cur);
      out.push(cur);
    }
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = keyBetween(a, b);
  return [...keysBetween(a, c, mid), c, ...keysBetween(c, b, n - mid - 1)];
}
