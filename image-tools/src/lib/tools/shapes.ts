/** Shape model for the blur and redact tools: boxes drawn over the image. */

export interface Shape {
	kind: 'rect' | 'ellipse';
	x: number;
	y: number;
	w: number;
	h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Normalise a drag (any direction) into a shape, clamped to the image.
 * Returns null while the drag is too small to mean anything.
 */
export function dragToShape(
	kind: Shape['kind'],
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	iw: number,
	ih: number,
	minSize = 4
): Shape | null {
	const left = clamp(Math.min(x0, x1), 0, iw);
	const right = clamp(Math.max(x0, x1), 0, iw);
	const top = clamp(Math.min(y0, y1), 0, ih);
	const bottom = clamp(Math.max(y0, y1), 0, ih);
	const w = Math.round(right - left);
	const h = Math.round(bottom - top);
	if (w < minSize || h < minSize) return null;
	return { kind, x: Math.round(left), y: Math.round(top), w, h };
}
