import { describe, expect, it } from 'vitest';
import { grayscale, luma, replaceColor, sepia, trimBounds } from './pixels';

const px = (...values: number[]) => new Uint8ClampedArray(values);

describe('grayscale', () => {
	it('gives every channel the same luma and keeps alpha', () => {
		const out = grayscale(px(255, 0, 0, 200));
		expect(out[0]).toBe(out[1]);
		expect(out[1]).toBe(out[2]);
		expect(out[0]).toBe(Math.round(luma(255, 0, 0)));
		expect(out[3]).toBe(200);
	});

	it('weights green most, as eyes do', () => {
		const red = grayscale(px(255, 0, 0, 255))[0];
		const green = grayscale(px(0, 255, 0, 255))[0];
		const blue = grayscale(px(0, 0, 255, 255))[0];
		expect(green).toBeGreaterThan(red);
		expect(red).toBeGreaterThan(blue);
	});

	it('leaves grey alone', () => {
		expect([...grayscale(px(128, 128, 128, 255))]).toEqual([128, 128, 128, 255]);
	});
});

describe('sepia', () => {
	it('warms the image, so red beats blue', () => {
		const out = sepia(px(128, 128, 128, 255));
		expect(out[0]).toBeGreaterThan(out[1]);
		expect(out[1]).toBeGreaterThan(out[2]);
		expect(out[3]).toBe(255);
	});

	it('clamps rather than wrapping around', () => {
		const out = sepia(px(255, 255, 255, 255));
		expect(out[0]).toBe(255);
		expect([...out].every((v) => v >= 0 && v <= 255)).toBe(true);
	});
});

describe('replaceColor', () => {
	const red = { r: 255, g: 0, b: 0 };
	const blue = { r: 0, g: 0, b: 255 };

	it('swaps matching pixels and counts them', () => {
		const data = px(255, 0, 0, 255, 0, 255, 0, 255);
		const { data: out, changed } = replaceColor(data, red, blue, 0);
		expect(changed).toBe(1);
		expect([...out.slice(0, 4)]).toEqual([0, 0, 255, 255]);
		expect([...out.slice(4)]).toEqual([0, 255, 0, 255]);
	});

	it('tolerance widens the match', () => {
		const nearlyRed = px(245, 10, 10, 255);
		expect(replaceColor(nearlyRed, red, blue, 0).changed).toBe(0);
		expect(replaceColor(nearlyRed, red, blue, 10).changed).toBe(1);
	});

	it('keeps alpha untouched', () => {
		const { data: out } = replaceColor(px(255, 0, 0, 77), red, blue, 5);
		expect(out[3]).toBe(77);
	});
});

describe('trimBounds', () => {
	/** width × height image with a border colour and an inner rect of content. */
	function framed(width: number, height: number, inner: { x: number; y: number; w: number; h: number }) {
		const data = new Uint8ClampedArray(width * height * 4);
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 255;
			data[i + 1] = 255;
			data[i + 2] = 255;
			data[i + 3] = 255;
		}
		for (let y = inner.y; y < inner.y + inner.h; y++) {
			for (let x = inner.x; x < inner.x + inner.w; x++) {
				const i = (y * width + x) * 4;
				data[i] = 10;
				data[i + 1] = 20;
				data[i + 2] = 30;
			}
		}
		return data;
	}

	it('finds the content inside a flat border', () => {
		const inner = { x: 2, y: 3, w: 4, h: 2 };
		expect(trimBounds(framed(10, 8, inner), 10, 8, 5)).toEqual(inner);
	});

	it('returns null when everything is border', () => {
		const blank = new Uint8ClampedArray(4 * 4 * 4).fill(255);
		expect(trimBounds(blank, 4, 4, 5)).toBeNull();
	});

	it('treats transparent pixels as border', () => {
		const data = new Uint8ClampedArray(3 * 1 * 4);
		// transparent, opaque red, transparent
		data[4] = 255;
		data[7] = 255;
		expect(trimBounds(data, 3, 1, 0)).toEqual({ x: 1, y: 0, w: 1, h: 1 });
	});

	it('returns null for a uniform image, since it is all border by definition', () => {
		// the corner pixel defines the border colour, so a single-colour image
		// cannot be told apart from an empty one. Callers treat null as
		// "nothing to trim" and leave the image alone.
		const uniform = framed(4, 4, { x: 0, y: 0, w: 4, h: 4 });
		expect(trimBounds(uniform, 4, 4, 5)).toBeNull();
	});

	it('keeps content that runs right up to an edge', () => {
		// 3 wide, 3 tall, white with a dark middle column touching top and bottom
		const data = new Uint8ClampedArray(3 * 3 * 4).fill(255);
		for (let y = 0; y < 3; y++) {
			const i = (y * 3 + 1) * 4;
			data[i] = 10;
			data[i + 1] = 20;
			data[i + 2] = 30;
		}
		expect(trimBounds(data, 3, 3, 5)).toEqual({ x: 1, y: 0, w: 1, h: 3 });
	});
});
