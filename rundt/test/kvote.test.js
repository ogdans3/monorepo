import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kvote } from '../src/kvote.js';

test('slipper gjennom opp til grensa, og så ikke', () => {
  const k = new Kvote({ maks: 3, vinduMs: 1000 });
  assert.deepEqual([k.slippGjennom('a'), k.slippGjennom('a'), k.slippGjennom('a'), k.slippGjennom('a')],
    [true, true, true, false]);
});

test('bøttene er per avsender', () => {
  const k = new Kvote({ maks: 1, vinduMs: 1000 });
  assert.equal(k.slippGjennom('a'), true);
  assert.equal(k.slippGjennom('b'), true);
  assert.equal(k.slippGjennom('a'), false);
});

test('bøtta tømmes når vinduet er over', () => {
  const k = new Kvote({ maks: 1, vinduMs: 1000 });
  assert.equal(k.slippGjennom('a', 0), true);
  assert.equal(k.slippGjennom('a', 999), false);
  assert.equal(k.slippGjennom('a', 1001), true);
});
