import { describe, expect, it } from 'vitest';
import {
	cellAt,
	cellRects,
	containRect,
	coverSource,
	evenSplits,
	matchedColumn,
	matchedRow,
	moveDivider,
	naturalCanvas,
	splitsFromExtents
} from './layout';

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

describe('splitsFromExtents', () => {
	it('turns extents into cumulative fractions', () => {
		expect(splitsFromExtents([2, 1, 1])).toEqual([0.5, 0.75]);
		expect(splitsFromExtents([1])).toEqual([]);
	});

	it('falls back to even splits when there is nothing to divide', () => {
		expect(splitsFromExtents([0, 0])).toEqual([0.5]);
	});
});

describe('matching images onto one axis', () => {
	it('scales a row up to the tallest, never down', () => {
		const { extents, cross } = matchedRow([
			{ w: 100, h: 50 },
			{ w: 200, h: 200 }
		]);
		expect(cross).toBe(200);
		expect(extents).toEqual([400, 200]);
	});

	it('scales a column to the widest', () => {
		const { extents, cross } = matchedColumn([
			{ w: 50, h: 100 },
			{ w: 200, h: 200 }
		]);
		expect(cross).toBe(200);
		expect(extents).toEqual([400, 200]);
	});
});

describe('naturalCanvas', () => {
	it('is as long as the images laid end to end, plus the spacing', () => {
		const c = naturalCanvas('horizontal', [
			{ w: 400, h: 200 },
			{ w: 100, h: 200 }
		], 20);
		// 20 frame + 400 + 20 gutter + 100 + 20 frame
		expect(c.width).toBe(560);
		expect(c.height).toBe(240);
		expect(c.splits).toEqual([0.8]);
	});

	it('gives every cell the shape of its own image, so nothing is cropped', () => {
		const sizes = [
			{ w: 400, h: 200 },
			{ w: 100, h: 200 }
		];
		const c = naturalCanvas('horizontal', sizes, 20);
		const [a, b] = cellRects('horizontal', 2, c.splits, c.gridSplits, c.width, c.height, 20, 20);
		expect(a).toEqual({ x: 20, y: 20, w: 400, h: 200 });
		expect(b).toEqual({ x: 440, y: 20, w: 100, h: 200 });
	});

	it('stacks the same way down a column', () => {
		const c = naturalCanvas('vertical', [
			{ w: 200, h: 100 },
			{ w: 200, h: 300 }
		], 10);
		expect(c.width).toBe(220);
		expect(c.height).toBe(430);
		expect(c.splits).toEqual([0.25]);
	});

	it('gives the grid four cells big enough for the largest image', () => {
		const c = naturalCanvas(
			'grid',
			[
				{ w: 100, h: 100 },
				{ w: 200, h: 100 },
				{ w: 100, h: 100 },
				{ w: 100, h: 100 }
			],
			10
		);
		expect(c.width).toBe(200 * 2 + 30);
		expect(c.height).toBe(100 * 2 + 30);
		expect(c.gridSplits).toEqual([0.5, 0.5]);
	});

	it('survives having no images at all', () => {
		expect(naturalCanvas('horizontal', [], 8).width).toBe(16);
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

	it('takes the gutters out of the content, not out of the cells', () => {
		// Three equal cells in 1000px with a 20px gutter: 960 of content, so the
		// middle cell is exactly as wide as the outer ones.
		const cells = cellRects('horizontal', 3, [1 / 3, 2 / 3], [0.5, 0.5], 1000, 400, 20);
		expect(cells.map((c) => c.w)).toEqual([320, 320, 320]);
		expect(cells.map((c) => c.x)).toEqual([0, 340, 680]);
	});

	it('frames the whole thing when there is padding', () => {
		const [a, b] = cellRects('horizontal', 2, [0.5], [0.5, 0.5], 1000, 400, 20, 20);
		expect(a).toEqual({ x: 20, y: 20, w: 470, h: 360 });
		expect(b).toEqual({ x: 510, y: 20, w: 470, h: 360 });
		expect(b.x + b.w).toBe(980);
	});

	it('pads a vertical strip on both axes', () => {
		const [a] = cellRects('vertical', 2, [0.5], [0.5, 0.5], 300, 900, 0, 10);
		expect(a).toEqual({ x: 10, y: 10, w: 280, h: 440 });
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

describe('containRect', () => {
	it('shows the whole image, centred, letterboxing the rest', () => {
		// a 2:1 image in a square cell: full width, bars above and below
		expect(containRect(200, 100, { x: 0, y: 0, w: 100, h: 100 })).toEqual({
			x: 0,
			y: 25,
			w: 100,
			h: 50
		});
	});

	it('fills exactly when the aspects match, which is the default case', () => {
		expect(containRect(400, 200, { x: 20, y: 20, w: 400, h: 200 })).toEqual({
			x: 20,
			y: 20,
			w: 400,
			h: 200
		});
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
