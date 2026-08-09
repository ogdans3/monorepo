import { describe, expect, it } from 'vitest';
import { cellAt, cellRects, coverSource, evenSplits, moveDivider } from './layout';

describe('evenSplits', () => {
	it('divides evenly', () => {
		expect(evenSplits(2)).toEqual([0.5]);
		expect(evenSplits(3)).toEqual([1 / 3, 2 / 3]);
		expect(evenSplits(1)).toEqual([]);
	});
});

describe('moveDivider', () => {
	it('clamps between neighbours with a minimum cell size', () => {
		expect(moveDivider([0.5], 0, 0.7)[0]).toBeCloseTo(0.7);
		expect(moveDivider([0.5], 0, 0.99)[0]).toBeCloseTo(0.92);
		expect(moveDivider([1 / 3, 2 / 3], 0, 0.65)[0]).toBeCloseTo(2 / 3 - 0.08);
	});
});

describe('cellRects', () => {
	it('splits a horizontal strip and accounts for the gap', () => {
		const [a, b] = cellRects('horizontal', 2, [0.5], [0.5, 0.5], 1000, 400, 20);
		expect(a).toEqual({ x: 0, y: 0, w: 490, h: 400 });
		expect(b).toEqual({ x: 510, y: 0, w: 490, h: 400 });
	});

	it('splits vertically', () => {
		const [a, b, c] = cellRects('vertical', 3, [0.25, 0.5], [0.5, 0.5], 300, 900, 0);
		expect(a.h).toBe(225);
		expect(b).toEqual({ x: 0, y: 225, w: 300, h: 225 });
		expect(c.h).toBe(450);
	});

	it('builds a 2×2 grid row-major', () => {
		const cells = cellRects('grid', 4, [], [0.5, 0.5], 400, 400, 0);
		expect(cells).toHaveLength(4);
		expect(cells[0]).toEqual({ x: 0, y: 0, w: 200, h: 200 });
		expect(cells[1].x).toBe(200);
		expect(cells[2].y).toBe(200);
		expect(cells[3]).toEqual({ x: 200, y: 200, w: 200, h: 200 });
	});
});

describe('coverSource', () => {
	it('crops the overflow axis and pans across it', () => {
		// wide image into a square cell: horizontal overflow
		const centre = coverSource(200, 100, 100, 100, 0.5, 0.5);
		expect(centre).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
		expect(coverSource(200, 100, 100, 100, 0, 0.5).sx).toBe(0);
		expect(coverSource(200, 100, 100, 100, 1, 0.5).sx).toBe(100);
	});

	it('fills exactly when aspects match', () => {
		expect(coverSource(200, 100, 100, 50, 0.5, 0.5)).toEqual({ sx: 0, sy: 0, sw: 200, sh: 100 });
	});
});

describe('cellAt', () => {
	it('hit-tests cells', () => {
		const rects = cellRects('horizontal', 2, [0.5], [0.5, 0.5], 100, 100, 0);
		expect(cellAt(rects, 10, 10)).toBe(0);
		expect(cellAt(rects, 60, 10)).toBe(1);
		expect(cellAt(rects, 200, 10)).toBe(-1);
	});
});
