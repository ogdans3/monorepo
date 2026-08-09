import { describe, expect, it } from 'vitest';
import { applyAspect, fullRect, moveRect, resizeRect, setSize, MIN_CROP } from './cropmath';

describe('fullRect', () => {
	it('covers the image when free', () => {
		expect(fullRect(100, 80, null)).toEqual({ x: 0, y: 0, w: 100, h: 80 });
	});

	it('fits and centres an aspect', () => {
		expect(fullRect(100, 80, 1)).toEqual({ x: 10, y: 0, w: 80, h: 80 });
		expect(fullRect(100, 80, 16 / 9)).toEqual({ x: 0, y: 12, w: 100, h: 56 });
	});
});

describe('moveRect', () => {
	it('translates and clamps to the image', () => {
		const r = { x: 10, y: 10, w: 50, h: 40 };
		expect(moveRect(r, 20, -5, 100, 80)).toEqual({ x: 30, y: 5, w: 50, h: 40 });
		expect(moveRect(r, 999, 999, 100, 80)).toEqual({ x: 50, y: 40, w: 50, h: 40 });
	});
});

describe('resizeRect (free)', () => {
	const start = { x: 10, y: 10, w: 50, h: 40 };

	it('moves only the dragged edges', () => {
		expect(resizeRect(start, 'se', 20, 10, 100, 80, null)).toEqual({ x: 10, y: 10, w: 70, h: 50 });
		expect(resizeRect(start, 'nw', 5, 5, 100, 80, null)).toEqual({ x: 15, y: 15, w: 45, h: 35 });
		expect(resizeRect(start, 'e', -10, 99, 100, 80, null)).toEqual({ x: 10, y: 10, w: 40, h: 40 });
	});

	it('respects the minimum size and image bounds', () => {
		const tiny = resizeRect(start, 'se', -999, -999, 100, 80, null);
		expect(tiny.w).toBe(MIN_CROP);
		expect(tiny.h).toBe(MIN_CROP);
		const big = resizeRect(start, 'se', 999, 999, 100, 80, null);
		expect(big).toEqual({ x: 10, y: 10, w: 90, h: 70 });
	});
});

describe('resizeRect (aspect locked)', () => {
	const start = { x: 10, y: 10, w: 40, h: 40 };

	it('keeps the ratio on corner drags, anchored at the opposite corner', () => {
		const r = resizeRect(start, 'se', 20, 4, 200, 200, 1);
		expect(r).toEqual({ x: 10, y: 10, w: 60, h: 60 });
	});

	it('keeps the other axis centred on edge drags', () => {
		const r = resizeRect(start, 'e', 20, 0, 200, 200, 1);
		expect(r.w).toBe(60);
		expect(r.h).toBe(60);
		expect(r.y).toBe(0); // centre was 30, so 30 - 30 = 0
	});

	it('shrinks toward the anchor at image bounds without breaking the ratio', () => {
		const r = resizeRect(start, 'se', 999, 999, 100, 80, 1);
		expect(r.w).toBe(r.h);
		expect(r.x + r.w).toBeLessThanOrEqual(100);
		expect(r.y + r.h).toBeLessThanOrEqual(80);
		expect(r.h).toBe(70); // limited by the 80px height from y=10
	});
});

describe('applyAspect', () => {
	it('reshapes around the centre and clamps', () => {
		const r = applyAspect({ x: 0, y: 0, w: 100, h: 80 }, 1, 100, 80);
		expect(r.w).toBe(r.h);
		expect(r.x).toBeGreaterThanOrEqual(0);
		expect(r.x + r.w).toBeLessThanOrEqual(100);
	});

	it('is a no-op when free', () => {
		const r = { x: 5, y: 5, w: 20, h: 30 };
		expect(applyAspect(r, null, 100, 80)).toBe(r);
	});
});

describe('setSize', () => {
	it('applies typed sizes, clamped to the image', () => {
		const r = setSize({ x: 90, y: 70, w: 10, h: 10 }, 50, 40, 100, 80, null);
		expect(r).toEqual({ x: 50, y: 40, w: 50, h: 40 });
	});

	it('derives the other axis when aspect locked', () => {
		const r = setSize({ x: 0, y: 0, w: 10, h: 10 }, 60, 10, 100, 80, 2);
		expect(r.w).toBe(60);
		expect(r.h).toBe(30);
	});
});
