import { describe, expect, it } from 'vitest';
import {
	arrowHead,
	arrowLineEnd,
	clampToImage,
	dragBounds,
	isWorthKeeping,
	type Drawing
} from './draw';

const make = (over: Partial<Drawing> = {}): Drawing => ({
	kind: 'rect',
	x0: 10,
	y0: 20,
	x1: 60,
	y1: 80,
	colour: '#ff0000',
	width: 4,
	filled: false,
	...over
});

describe('dragBounds', () => {
	it('is the same box whichever corner the drag started from', () => {
		const forwards = dragBounds(make());
		const backwards = dragBounds(make({ x0: 60, y0: 80, x1: 10, y1: 20 }));
		expect(forwards).toEqual({ x: 10, y: 20, w: 50, h: 60 });
		expect(backwards).toEqual(forwards);
	});
});

describe('isWorthKeeping', () => {
	it('throws away a click that wobbled', () => {
		expect(isWorthKeeping(make({ x1: 11, y1: 21 }))).toBe(false);
		expect(isWorthKeeping(make({ kind: 'arrow', x1: 11, y1: 21 }))).toBe(false);
	});

	it('keeps a short but deliberate line, which has no width at all', () => {
		// A horizontal arrow covers no vertical distance, so a box test would
		// throw away every straight line anyone draws.
		expect(isWorthKeeping(make({ kind: 'arrow', x0: 0, y0: 50, x1: 40, y1: 50 }))).toBe(true);
		expect(isWorthKeeping(make({ kind: 'rect', x0: 0, y0: 50, x1: 40, y1: 50 }))).toBe(false);
	});
});

describe('clampToImage', () => {
	it('keeps a shape inside the picture', () => {
		const clamped = clampToImage(make({ x0: -30, y0: -10, x1: 500, y1: 400 }), 200, 100);
		expect(clamped).toMatchObject({ x0: 0, y0: 0, x1: 200, y1: 100 });
	});
});

describe('arrowHead', () => {
	const from = { x: 0, y: 0 };

	it('sits behind the tip, on both sides of the line', () => {
		const [a, b] = arrowHead(from, { x: 100, y: 0 }, 4);
		// pointing right: both barbs are left of the tip, one above and one below
		expect(a.x).toBeLessThan(100);
		expect(b.x).toBeLessThan(100);
		expect(Math.sign(a.y)).toBe(-Math.sign(b.y));
		expect(a.y).toBeCloseTo(-b.y, 6);
	});

	it('turns with the line', () => {
		const right = arrowHead(from, { x: 100, y: 0 }, 4);
		const down = arrowHead(from, { x: 0, y: 100 }, 4);
		// the same head, rotated a quarter turn: what was an x offset is now a y
		expect(down[0].y).toBeCloseTo(right[0].x, 6);
		expect(down[0].x).toBeCloseTo(-right[0].y, 6);
	});

	it('grows with the stroke, not with the length', () => {
		const thin = arrowHead(from, { x: 300, y: 0 }, 2);
		const thick = arrowHead(from, { x: 300, y: 0 }, 12);
		const spanOf = ([a, b]: [{ y: number }, { y: number }]) => Math.abs(a.y - b.y);
		expect(spanOf(thick)).toBeGreaterThan(spanOf(thin));

		const short = arrowHead(from, { x: 60, y: 0 }, 2);
		expect(spanOf(short)).toBeCloseTo(spanOf(thin), 6);
	});

	it('never eats a short arrow whole', () => {
		// a thick arrow over a short distance: the head stops at a third of it
		const [a] = arrowHead(from, { x: 12, y: 0 }, 20);
		expect(a.x).toBeGreaterThan(0);
	});
});

describe('arrowLineEnd', () => {
	it('stops the line short so the head makes the point', () => {
		const end = arrowLineEnd({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
		expect(end.x).toBeLessThan(100);
		expect(end.x).toBeGreaterThan(80);
		expect(end.y).toBeCloseTo(0, 6);
	});

	it('never doubles back past the start', () => {
		const end = arrowLineEnd({ x: 0, y: 0 }, { x: 4, y: 0 }, 40);
		expect(end.x).toBeGreaterThanOrEqual(0);
	});
});
