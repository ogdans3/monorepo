import { describe, expect, it } from 'vitest';
import { floodErase } from './floodfill';

/** 4×4 image: left half red, right half blue, with one dark-red pixel at (1,1). */
function fixture() {
	const data = new Uint8ClampedArray(4 * 4 * 4);
	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 4; x++) {
			const p = (y * 4 + x) * 4;
			const red = x < 2;
			data[p] = red ? 200 : 0;
			data[p + 1] = 0;
			data[p + 2] = red ? 0 : 200;
			data[p + 3] = 255;
		}
	}
	const dark = (1 * 4 + 1) * 4;
	data[dark] = 160; // dark red, distance 40 from the plain red
	return data;
}

const alphaAt = (d: Uint8ClampedArray, x: number, y: number) => d[(y * 4 + x) * 4 + 3];

describe('floodErase', () => {
	it('erases the contiguous region and stops at other colours', () => {
		const d = fixture();
		const erased = floodErase(d, 4, 4, 0, 0, 0);
		expect(erased).toBe(7); // red half minus the dark-red pixel
		expect(alphaAt(d, 0, 0)).toBe(0);
		expect(alphaAt(d, 1, 1)).toBe(255); // outside zero tolerance
		expect(alphaAt(d, 2, 0)).toBe(255); // blue untouched
	});

	it('higher tolerance swallows nearby shades', () => {
		const d = fixture();
		const erased = floodErase(d, 4, 4, 0, 0, 15); // threshold ≈ 66 > 40
		expect(erased).toBe(8);
		expect(alphaAt(d, 1, 1)).toBe(0);
		expect(alphaAt(d, 3, 3)).toBe(255);
	});

	it('tolerance 100 erases everything reachable', () => {
		const d = fixture();
		expect(floodErase(d, 4, 4, 0, 0, 100)).toBe(16);
		expect(alphaAt(d, 3, 3)).toBe(0);
	});

	it('does not leak through a blocking colour', () => {
		// red | blue | red columns: fill from the left never reaches the right
		const d = new Uint8ClampedArray(3 * 1 * 4);
		[200, 0, 200].forEach((r, x) => {
			d[x * 4] = r;
			d[x * 4 + 2] = r === 0 ? 200 : 0;
			d[x * 4 + 3] = 255;
		});
		floodErase(d, 3, 1, 0, 0, 10);
		expect(d[3]).toBe(0);
		expect(d[7]).toBe(255);
		expect(d[11]).toBe(255);
	});

	it('ignores out-of-bounds seeds and keeps RGB intact', () => {
		const d = fixture();
		expect(floodErase(d, 4, 4, -1, 0, 50)).toBe(0);
		expect(floodErase(d, 4, 4, 0, 4, 50)).toBe(0);
		floodErase(d, 4, 4, 0, 0, 0);
		expect(d[0]).toBe(200); // RGB survives so ops can be replayed
	});
});
