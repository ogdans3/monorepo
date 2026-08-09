/** Pure geometry for the resize and rotate tools. */

const clampPx = (v: number) => Math.min(10000, Math.max(1, Math.round(v) || 1));

/** Derive the missing side from the original aspect when the lock is on. */
export function lockedDims(
	origW: number,
	origH: number,
	input: { w?: number; h?: number }
): { w: number; h: number } {
	if (input.w !== undefined) {
		const w = clampPx(input.w);
		return { w, h: clampPx((w * origH) / origW) };
	}
	if (input.h !== undefined) {
		const h = clampPx(input.h);
		return { w: clampPx((h * origW) / origH), h };
	}
	return { w: clampPx(origW), h: clampPx(origH) };
}

const clampAdj = (v: number) => Math.min(100, Math.max(-100, v || 0));

/**
 * Canvas filter string for the adjust tool. Sliders run -100..100 where 0 is
 * the untouched image, mapping linearly onto the CSS filter functions.
 */
export function adjustFilter(brightness: number, contrast: number, saturation: number): string {
	const f = (v: number) => ((100 + clampAdj(v)) / 100).toFixed(2);
	return `brightness(${f(brightness)}) contrast(${f(contrast)}) saturate(${f(saturation)})`;
}

export interface Orientation {
	/** Quarter turns clockwise, 0 to 3, applied before the flips. */
	turns: number;
	flipH: boolean;
	flipV: boolean;
}

export const IDENTITY: Orientation = { turns: 0, flipH: false, flipV: false };

/**
 * Rotate what the user currently SEES by a quarter turn. The view transform
 * is flip ∘ rotate, so with exactly one flip active a visual turn runs the
 * stored rotation the other way.
 */
export function rotateView(o: Orientation, dir: 1 | -1): Orientation {
	const effective = o.flipH !== o.flipV ? -dir : dir;
	return { ...o, turns: (o.turns + effective + 4) % 4 };
}

/** Mirror what the user currently sees across the given axis. */
export function flipView(o: Orientation, axis: 'h' | 'v'): Orientation {
	return axis === 'h' ? { ...o, flipH: !o.flipH } : { ...o, flipV: !o.flipV };
}

/** Output dimensions after the orientation is applied. */
export function orientedDims(w: number, h: number, o: Orientation): { w: number; h: number } {
	return o.turns % 2 === 1 ? { w: h, h: w } : { w, h };
}
