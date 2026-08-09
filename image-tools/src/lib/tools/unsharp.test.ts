import { describe, expect, it } from 'vitest';
import { unsharpMask } from './unsharp';

describe('unsharpMask', () => {
	it('leaves uniform areas alone', () => {
		const base = new Uint8ClampedArray([100, 100, 100, 255]);
		const blurred = new Uint8ClampedArray([100, 100, 100, 255]);
		expect([...unsharpMask(base, blurred, 1.5)]).toEqual([100, 100, 100, 255]);
	});

	it('amplifies edges and clamps to byte range', () => {
		const base = new Uint8ClampedArray([200, 10, 128, 200]);
		const blurred = new Uint8ClampedArray([150, 60, 128, 200]);
		const out = unsharpMask(base, blurred, 1);
		expect(out[0]).toBe(250); // 200 + 50
		expect(out[1]).toBe(0); // 10 − 50 clamps
		expect(out[2]).toBe(128); // no edge, no change
		expect(out[3]).toBe(200); // alpha untouched
	});

	it('k of zero is a no-op', () => {
		const base = new Uint8ClampedArray([1, 2, 3, 4]);
		const blurred = new Uint8ClampedArray([200, 200, 200, 4]);
		expect([...unsharpMask(base, blurred, 0)]).toEqual([1, 2, 3, 4]);
	});
});
