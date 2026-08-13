import { describe, expect, it } from 'vitest';
import { flattenPartialAlpha, hasTransparency, hexToRgb, WHITE } from './flatten';

describe('hexToRgb', () => {
	it('reads hex with or without the hash', () => {
		expect(hexToRgb('#ff0080')).toEqual({ r: 255, g: 0, b: 128 });
		expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
		expect(hexToRgb('#FFFFFF')).toEqual(WHITE);
	});

	it('falls back to white rather than throwing', () => {
		expect(hexToRgb('nope')).toEqual(WHITE);
		expect(hexToRgb('#fff')).toEqual(WHITE); // short form is not supported
		expect(hexToRgb('')).toEqual(WHITE);
	});
});

describe('hasTransparency', () => {
	it('spots any pixel below full opacity', () => {
		expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255]))).toBe(false);
		expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 254]))).toBe(true);
		expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 0]))).toBe(true);
		expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 128]))).toBe(true);
	});
});

describe('flattenPartialAlpha', () => {
	const black = { r: 0, g: 0, b: 0 };

	it('blends a half-transparent pixel halfway to the background', () => {
		const out = flattenPartialAlpha(new Uint8ClampedArray([255, 255, 255, 128]), black);
		// 255 * (128/255) + 0 = 128
		expect([...out]).toEqual([128, 128, 128, 255]);
	});

	it('leaves fully transparent pixels alone, so the format can keep them', () => {
		const out = flattenPartialAlpha(new Uint8ClampedArray([10, 20, 30, 0]), WHITE);
		expect(out[3]).toBe(0);
		expect([...out.slice(0, 3)]).toEqual([10, 20, 30]);
	});

	it('leaves fully opaque pixels untouched', () => {
		const out = flattenPartialAlpha(new Uint8ClampedArray([10, 20, 30, 255]), black);
		expect([...out]).toEqual([10, 20, 30, 255]);
	});

	it('blends towards whatever colour is given', () => {
		const red = { r: 255, g: 0, b: 0 };
		const out = flattenPartialAlpha(new Uint8ClampedArray([0, 0, 0, 128]), red);
		expect(out[0]).toBe(127); // most of the red shows through
		expect(out[1]).toBe(0);
		expect(out[3]).toBe(255);
	});

	it('does not modify the input', () => {
		const input = new Uint8ClampedArray([255, 255, 255, 128]);
		flattenPartialAlpha(input, black);
		expect(input[3]).toBe(128);
	});
});
