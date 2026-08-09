import { describe, expect, it } from 'vitest';
import { flipView, IDENTITY, lockedDims, orientedDims, rotateView } from './transforms';

describe('lockedDims', () => {
	it('derives the other side from the original aspect', () => {
		expect(lockedDims(200, 100, { w: 50 })).toEqual({ w: 50, h: 25 });
		expect(lockedDims(200, 100, { h: 50 })).toEqual({ w: 100, h: 50 });
	});

	it('rounds and clamps', () => {
		expect(lockedDims(3, 2, { w: 100000 })).toEqual({ w: 10000, h: 6667 });
		expect(lockedDims(200, 100, { w: 0 })).toEqual({ w: 1, h: 1 });
	});
});

describe('orientation', () => {
	it('quarter turns wrap around', () => {
		let o = IDENTITY;
		for (let i = 0; i < 4; i++) o = rotateView(o, 1);
		expect(o.turns).toBe(0);
		expect(rotateView(IDENTITY, -1).turns).toBe(3);
	});

	it('flips toggle in view space', () => {
		const o = flipView(flipView(IDENTITY, 'h'), 'h');
		expect(o.flipH).toBe(false);
	});

	it('a visual turn with one flip active runs the stored rotation backwards', () => {
		const flipped = flipView(IDENTITY, 'h');
		expect(rotateView(flipped, 1).turns).toBe(3);
		// with both flips (a 180) the parity cancels out again
		const both = flipView(flipped, 'v');
		expect(rotateView(both, 1).turns).toBe(1);
	});

	it('swaps output dimensions on odd turns', () => {
		expect(orientedDims(320, 240, { turns: 1, flipH: false, flipV: false })).toEqual({
			w: 240,
			h: 320
		});
		expect(orientedDims(320, 240, { turns: 2, flipH: true, flipV: false })).toEqual({
			w: 320,
			h: 240
		});
	});
});
