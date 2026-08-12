import { describe, expect, it } from 'vitest';
import { invertPixels } from './invert';

describe('invertPixels', () => {
	it('flips every channel and keeps alpha', () => {
		const out = invertPixels(new Uint8ClampedArray([255, 0, 0, 255, 10, 200, 30, 128]));
		expect([...out]).toEqual([0, 255, 255, 255, 245, 55, 225, 128]);
	});

	it('inverting twice is the identity', () => {
		const original = new Uint8ClampedArray([1, 2, 3, 4, 250, 251, 252, 253]);
		expect([...invertPixels(invertPixels(original))]).toEqual([...original]);
	});
});
