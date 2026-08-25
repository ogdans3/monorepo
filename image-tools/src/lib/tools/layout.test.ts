import { describe, expect, it } from 'vitest';
import {
	cellAt,
	cellIndex,
	cellRects,
	chunk,
	columnsFor,
	containRect,
	coverSource,
	evenSplits,
	fitWithin,
	matchedRow,
	moveDivider,
	alignedCanvas,
	justifiedCanvas,
	naturalCanvas,
	rowsFor,
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
});

describe('rows and columns', () => {
	it('gives each layout its column count', () => {
		expect(columnsFor('horizontal', 5, 2)).toBe(5);
		expect(columnsFor('vertical', 5, 2)).toBe(1);
		expect(columnsFor('grid', 5, 3)).toBe(3);
		// Never more columns than images, which would be a row with holes in it.
		expect(columnsFor('grid', 2, 4)).toBe(2);
	});

	it('works out the rows those columns need', () => {
		expect(rowsFor(5, 2)).toBe(3);
		expect(rowsFor(4, 2)).toBe(2);
		expect(rowsFor(3, 3)).toBe(1);
	});

	it('chunks row-major, short last row and all', () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});
});

describe('justifiedCanvas, which is what the strips use', () => {
	it('is as long as one row of images laid end to end, plus the spacing', () => {
		const c = justifiedCanvas(
			[
				{ w: 400, h: 200 },
				{ w: 100, h: 200 }
			],
			2,
			20
		);
		// 20 frame + 400 + 20 gutter + 100 + 20 frame
		expect(c.width).toBe(560);
		expect(c.height).toBe(240);
		expect(c.splits.rows).toEqual([]);
		expect(c.splits.cols).toEqual([[0.8]]);
	});

	it('gives every cell the shape of its own image, so nothing is cropped', () => {
		const sizes = [
			{ w: 400, h: 200 },
			{ w: 100, h: 200 }
		];
		const c = justifiedCanvas(sizes, 2, 20);
		const [a, b] = cellRects(c.splits, 2, c.width, c.height, 20, 20);
		expect(a).toEqual({ x: 20, y: 20, w: 400, h: 200 });
		expect(b).toEqual({ x: 440, y: 20, w: 100, h: 200 });
	});

	it('stacks the same way down a single column', () => {
		const c = justifiedCanvas(
			[
				{ w: 200, h: 100 },
				{ w: 200, h: 300 }
			],
			1,
			10
		);
		expect(c.width).toBe(220);
		expect(c.height).toBe(430);
		expect(c.splits.rows).toEqual([0.25]);
	});

	it('stretches a narrow row up to the widest rather than shrinking anything', () => {
		// Two 200 wide images, then one 100 wide square on its own. The square is
		// stretched to the full width, so its row ends up 400 tall.
		const c = justifiedCanvas(
			[
				{ w: 200, h: 100 },
				{ w: 200, h: 100 },
				{ w: 100, h: 100 }
			],
			2,
			0
		);
		expect(c.width).toBe(400);
		expect(c.height).toBe(500);
	});

	it('lets a short last row have the whole width to itself', () => {
		const sizes = [
			{ w: 100, h: 100 },
			{ w: 100, h: 100 },
			{ w: 100, h: 100 }
		];
		const c = justifiedCanvas(sizes, 2, 0);
		const cells = cellRects(c.splits, 3, c.width, c.height, 0, 0);
		expect(cells[2].w).toBe(c.width);
		expect(cells[0].w + cells[1].w).toBe(c.width);
	});

	it('survives having no images at all', () => {
		expect(justifiedCanvas([], 2, 8).width).toBe(16);
	});
});

describe('alignedCanvas, which is what the grid uses', () => {
	const sizes = [
		{ w: 200, h: 100 },
		{ w: 100, h: 300 },
		{ w: 400, h: 200 }
	];

	it('makes each column as wide as its widest image and each row as tall as its tallest', () => {
		// 2 columns: col 0 holds the 200 and the 400 wide, col 1 holds the 100.
		// Row 0 is 300 tall because of the second image, row 1 is 200.
		const c = alignedCanvas(sizes, 2, 0);
		expect(c.width).toBe(400 + 100);
		expect(c.height).toBe(300 + 200);
	});

	it('lines the columns up in every row, which is the point of a grid', () => {
		const c = alignedCanvas(sizes, 2, 0);
		const cells = cellRects(c.splits, 3, c.width, c.height, 0, 0);
		expect(cells[2].x).toBe(cells[0].x);
		expect(cells[2].w).toBe(cells[0].w);
	});

	it('leaves the missing cells of a short last row empty rather than filling them', () => {
		const c = alignedCanvas(sizes, 2, 0);
		const cells = cellRects(c.splits, 3, c.width, c.height, 0, 0);
		// Three images in a 2 x 2 grid: the third keeps its column, and nothing
		// is stretched across the hole where a fourth would have gone.
		expect(cells).toHaveLength(3);
		expect(cells[2].w).toBeLessThan(c.width);
	});

	it('never asks an image to be smaller than it is', () => {
		const c = alignedCanvas(sizes, 2, 0);
		const cells = cellRects(c.splits, 3, c.width, c.height, 0, 0);
		for (const [i, cell] of cells.entries()) {
			expect(cell.w).toBeGreaterThanOrEqual(sizes[i].w);
			expect(cell.h).toBeGreaterThanOrEqual(sizes[i].h);
		}
	});

	it('adds the spacing around and between, like everything else', () => {
		const tight = alignedCanvas(sizes, 2, 0);
		const roomy = alignedCanvas(sizes, 2, 10);
		expect(roomy.width).toBe(tight.width + 30);
		expect(roomy.height).toBe(tight.height + 30);
	});
});

describe('naturalCanvas', () => {
	it('sends each layout to the geometry it wants', () => {
		const sizes = [
			{ w: 200, h: 100 },
			{ w: 100, h: 300 }
		];
		expect(naturalCanvas('horizontal', sizes, 2, 0)).toEqual(justifiedCanvas(sizes, 2, 0));
		expect(naturalCanvas('grid', sizes, 2, 0)).toEqual(alignedCanvas(sizes, 2, 0));
	});
});

describe('cellRects', () => {
	/** One row of `n` evenly split cells. */
	const oneRow = (n: number) => ({ rows: [], cols: [evenSplits(n)] });

	it('splits a row and accounts for the gap', () => {
		const [a, b] = cellRects(oneRow(2), 2, 1000, 400, 20);
		expect(a).toEqual({ x: 0, y: 0, w: 490, h: 400 });
		expect(b).toEqual({ x: 510, y: 0, w: 490, h: 400 });
	});

	it('splits a single column down the canvas', () => {
		const splits = { rows: [0.25, 0.5], cols: [[], [], []] };
		const [a, b, c] = cellRects(splits, 3, 300, 900, 0);
		expect(a.h).toBe(225);
		expect(b).toEqual({ x: 0, y: 225, w: 300, h: 225 });
		expect(c.h).toBe(450);
	});

	it('takes the gutters out of the content, not out of the cells', () => {
		// Three equal cells in 1000px with a 20px gutter: 960 of content, so the
		// middle cell is exactly as wide as the outer ones.
		const cells = cellRects(oneRow(3), 3, 1000, 400, 20);
		expect(cells.map((c) => c.w)).toEqual([320, 320, 320]);
		expect(cells.map((c) => c.x)).toEqual([0, 340, 680]);
	});

	it('frames the whole thing when there is padding', () => {
		const [a, b] = cellRects(oneRow(2), 2, 1000, 400, 20, 20);
		expect(a).toEqual({ x: 20, y: 20, w: 470, h: 360 });
		expect(b).toEqual({ x: 510, y: 20, w: 470, h: 360 });
		expect(b.x + b.w).toBe(980);
	});

	it('pads a column on both axes', () => {
		const [a] = cellRects({ rows: [0.5], cols: [[], []] }, 2, 300, 900, 0, 10);
		expect(a).toEqual({ x: 10, y: 10, w: 280, h: 440 });
	});

	it('builds a 2 by 2 grid row-major', () => {
		const splits = { rows: [0.5], cols: [[0.5], [0.5]] };
		const cells = cellRects(splits, 4, 400, 400, 0);
		expect(cells).toHaveLength(4);
		expect(cells[0]).toEqual({ x: 0, y: 0, w: 200, h: 200 });
		expect(cells[1].x).toBe(200);
		expect(cells[2].y).toBe(200);
		expect(cells[3]).toEqual({ x: 200, y: 200, w: 200, h: 200 });
	});

	it('numbers cells row-major, whatever each row holds', () => {
		const splits = { rows: [0.5], cols: [[0.5], []] };
		expect(cellIndex(splits, 0, 0)).toBe(0);
		expect(cellIndex(splits, 0, 1)).toBe(1);
		expect(cellIndex(splits, 1, 0)).toBe(2);
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

describe('fitWithin', () => {
	it('leaves a canvas that already fits alone', () => {
		expect(fitWithin(1500, 600, 8000)).toEqual({ width: 1500, height: 600 });
	});

	it('scales both axes by the same factor', () => {
		expect(fitWithin(9000, 2000, 8000)).toEqual({ width: 8000, height: 1778 });
		expect(fitWithin(2000, 16000, 8000)).toEqual({ width: 1000, height: 8000 });
	});

	it('keeps the shape of the size that was asked for, however often it changes', () => {
		// Feeding a clamped size back in is what squeezed the images: the width
		// could not grow, so every extra gutter came out of the pictures instead,
		// and the canvas drifted taller with each nudge of the spacing.
		const once = fitWithin(9000, 2000, 8000);
		const compounded = fitWithin(once.width + 800, once.height + 400, 8000);
		const asked = fitWithin(9800, 2400, 8000);
		expect(asked.width / asked.height).toBeCloseTo(9800 / 2400, 2);
		expect(compounded.width / compounded.height).not.toBeCloseTo(9800 / 2400, 2);
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
		const rects = cellRects({ rows: [], cols: [[0.5]] }, 2, 100, 100, 0);
		expect(cellAt(rects, 10, 10)).toBe(0);
		expect(cellAt(rects, 60, 10)).toBe(1);
		expect(cellAt(rects, 200, 10)).toBe(-1);
	});
});
