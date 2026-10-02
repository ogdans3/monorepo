import { describe, expect, it } from 'vitest';
import { arrange, bounds, moveBox, nextAnswer, nudgeBox, resizeBox, snapShift, STEP_X, STEP_Y } from './geometry';

const onGrid = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-3;

describe('moving a box', () => {
	it('lands whichever edge is nearest a grid line on it', () => {
		const b = moveBox({ x: 10, y: 10, w: 20, h: 20 }, 1.2, 0.3);
		expect(onGrid(b.x, STEP_X) || onGrid(b.x + b.w, STEP_X) || onGrid(b.x + b.w / 2, STEP_X)).toBe(true);
		expect(onGrid(b.y, STEP_Y) || onGrid(b.y + b.h, STEP_Y) || onGrid(b.y + b.h / 2, STEP_Y)).toBe(true);
	});

	it('centres on the middle of the stage when the middle is nearest', () => {
		const b = moveBox({ x: 0, y: 0, w: 30, h: 20 }, 35.2, 0);
		expect(b.x + b.w / 2).toBeCloseTo(50, 3);
	});

	it('goes exactly where it is dragged with the grid let go', () => {
		expect(moveBox({ x: 10, y: 10, w: 20, h: 20 }, 1.2345, 2.3456, true)).toMatchObject({ x: 11.235, y: 12.346 });
	});

	it('never leaves the stage', () => {
		expect(moveBox({ x: 10, y: 10, w: 20, h: 20 }, -50, 500)).toMatchObject({ x: 0, y: 80 });
	});
});

describe('resizing a box', () => {
	it('moves only the edges the handle holds', () => {
		const b = resizeBox({ x: 12.5, y: 11.11, w: 25, h: 22.22 }, 'e', 6.25, 40);
		expect(b.x).toBe(12.5);
		expect(b.y).toBe(11.11);
		expect(b.h).toBe(22.22);
		expect(b.x + b.w).toBeCloseTo(43.75, 2);
	});

	it('keeps at least a cell, and the far edge where it was', () => {
		const b = resizeBox({ x: 20, y: 20, w: 20, h: 20 }, 'nw', 80, 80);
		expect(b.w).toBeCloseTo(STEP_X, 2);
		expect(b.h).toBeCloseTo(STEP_Y, 2);
		expect(b.x + b.w).toBeCloseTo(40, 6);
		expect(b.y + b.h).toBeCloseTo(40, 6);
	});

	it('keeps a corner in proportion when asked', () => {
		const b = resizeBox({ x: 10, y: 10, w: 20, h: 10 }, 'se', 10, 0, true, 2);
		expect(b.w).toBe(30);
		expect(b.h).toBe(15);
	});

	it('stops at the edge of the stage', () => {
		expect(resizeBox({ x: 80, y: 80, w: 10, h: 10 }, 'se', 50, 50)).toMatchObject({ w: 20, h: 20 });
	});
});

it('nudges a cell at a time, or a fine step', () => {
	expect(nudgeBox({ x: 10, y: 10, w: 10, h: 10 }, 1, 0).x).toBe(13.125);
	expect(nudgeBox({ x: 10, y: 10, w: 10, h: 10 }, 0, -1, true).y).toBeCloseTo(10 - 0.444, 3);
});

it('snaps by the smallest shift', () => {
	expect(snapShift(STEP_X * 3 + 0.2, 10, STEP_X)).toBeCloseTo(-0.2, 5);
});

describe('placing answers', () => {
	it('puts up to four in one row, evenly', () => {
		const boxes = arrange(4);
		expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
		expect(new Set(boxes.map((b) => b.w)).size).toBe(1);
		const area = bounds(boxes)!;
		expect(area.x).toBeCloseTo(6.25, 2);
		expect(area.x + area.w).toBeCloseTo(93.75, 2);
	});

	it('puts more in rows, inside the area', () => {
		const boxes = arrange(9, { x: 0, y: 0, w: 100, h: 100 });
		expect(new Set(boxes.map((b) => b.y)).size).toBeGreaterThan(1);
		for (const b of boxes) {
			expect(b.x + b.w).toBeLessThanOrEqual(100.01);
			expect(b.y + b.h).toBeLessThanOrEqual(100.01);
		}
	});

	it('puts a new answer beside the last, then on a new row', () => {
		const first = { x: 6, y: 42, w: 32, h: 44 };
		expect(nextAnswer([first])).toMatchObject({ x: 40.5, y: 42, w: 32 });
		const second = { x: 60, y: 10, w: 32, h: 30 };
		expect(nextAnswer([first, second])).toMatchObject({ x: 6, y: 44 });
	});
});
