import { describe, expect, it } from 'vitest';
import {
  FIRST_KEY,
  isValidKey,
  keyBetween,
  keysBetween,
  OrderKeyError,
} from '../src/lib/fractional-index.js';

describe('fractional index', () => {
  it('starts at a known key', () => {
    expect(keyBetween(null, null)).toBe(FIRST_KEY);
  });

  it('appends and prepends without bound', () => {
    let last = keyBetween(null, null);
    const appended = [last];
    for (let i = 0; i < 200; i++) {
      last = keyBetween(last, null);
      appended.push(last);
    }
    expect([...appended].sort()).toEqual(appended);

    let first = FIRST_KEY;
    const prepended = [first];
    for (let i = 0; i < 200; i++) {
      first = keyBetween(null, first);
      prepended.push(first);
    }
    // Prepending walks downwards, so reversing it gives ascending order.
    expect([...prepended].reverse()).toEqual([...prepended].sort());
  });

  it('always finds room between two adjacent keys', () => {
    let low = keyBetween(null, null);
    let high = keyBetween(low, null);
    for (let i = 0; i < 300; i++) {
      const mid = keyBetween(low, high);
      expect(mid > low).toBe(true);
      expect(mid < high).toBe(true);
      // Alternate which side we squeeze, so both recursion paths get hammered.
      if (i % 2 === 0) high = mid;
      else low = mid;
    }
  });

  it('produces keys that sort byte-wise', () => {
    const keys = keysBetween(null, null, 64);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('spreads n keys between two bounds', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const middle = keysBetween(a, b, 10);
    expect(middle).toHaveLength(10);
    expect([a, ...middle, b]).toEqual([a, ...middle, b].slice().sort());
  });

  it('rejects reversed bounds and malformed keys', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    expect(() => keyBetween(b, a)).toThrow(OrderKeyError);
    expect(() => keyBetween(a, a)).toThrow(OrderKeyError);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('a')).toBe(false);
    expect(isValidKey('a00')).toBe(false); // trailing zero: two spellings, one spot
    expect(isValidKey('!!')).toBe(false);
    expect(isValidKey('a0')).toBe(true);
  });

  it('survives a randomised insert storm', () => {
    // Ten thousand inserts at random positions is roughly a decade of one
    // household's shopping list. Order must still hold exactly.
    const rng = mulberry32(0xc0ffee);
    const keys: string[] = [keyBetween(null, null)];
    for (let i = 0; i < 10_000; i++) {
      const at = Math.floor(rng() * (keys.length + 1));
      const before = at > 0 ? keys[at - 1]! : null;
      const after = at < keys.length ? keys[at]! : null;
      keys.splice(at, 0, keyBetween(before, after));
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
