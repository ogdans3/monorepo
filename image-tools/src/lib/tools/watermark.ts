/** Placement math for the watermark tool. */

export type AnchorPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export const ANCHORS: { id: AnchorPosition; label: string }[] = [
	{ id: 'tl', label: 'Top left' },
	{ id: 'tc', label: 'Top centre' },
	{ id: 'tr', label: 'Top right' },
	{ id: 'ml', label: 'Middle left' },
	{ id: 'mc', label: 'Centre' },
	{ id: 'mr', label: 'Middle right' },
	{ id: 'bl', label: 'Bottom left' },
	{ id: 'bc', label: 'Bottom centre' },
	{ id: 'br', label: 'Bottom right' }
];

/**
 * Top-left corner for a w × h mark inside a W × H image at the given anchor,
 * inset by a margin (a fraction of the smaller image side).
 */
export function anchorPoint(
	position: AnchorPosition,
	W: number,
	H: number,
	w: number,
	h: number,
	marginFrac = 0.03
): { x: number; y: number } {
	const m = Math.round(Math.min(W, H) * marginFrac);
	const xs: Record<string, number> = { l: m, c: (W - w) / 2, r: W - w - m };
	const ys: Record<string, number> = { t: m, m: (H - h) / 2, b: H - h - m };
	return { x: Math.round(xs[position[1]]), y: Math.round(ys[position[0]]) };
}
