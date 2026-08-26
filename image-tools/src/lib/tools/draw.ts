/** Shapes drawn on top of an image: boxes, ellipses, lines and arrows. */

export type DrawKind = 'rect' | 'ellipse' | 'line' | 'arrow';

export interface Drawing {
	kind: DrawKind;
	/** Where the drag started and ended, in image pixels. Not normalised: an
	 *  arrow points from the first to the second, so the order is the meaning. */
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	colour: string;
	/** Line thickness in image pixels. Also sets the arrow head's size. */
	width: number;
	/** Boxes and ellipses only. An outline when false. */
	filled: boolean;
}

export interface Point {
	x: number;
	y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The box a drag covers, whichever corner it started from. */
export function dragBounds(drawing: Drawing): { x: number; y: number; w: number; h: number } {
	return {
		x: Math.min(drawing.x0, drawing.x1),
		y: Math.min(drawing.y0, drawing.y1),
		w: Math.abs(drawing.x1 - drawing.x0),
		h: Math.abs(drawing.y1 - drawing.y0)
	};
}

/** Long enough to have been meant. A click that wobbles is not a shape. */
export function isWorthKeeping(drawing: Drawing, minSize = 3): boolean {
	if (drawing.kind === 'line' || drawing.kind === 'arrow') {
		return Math.hypot(drawing.x1 - drawing.x0, drawing.y1 - drawing.y0) >= minSize;
	}
	const { w, h } = dragBounds(drawing);
	return w >= minSize && h >= minSize;
}

/** Keeps a drawing inside the image it is drawn on. */
export function clampToImage(drawing: Drawing, width: number, height: number): Drawing {
	return {
		...drawing,
		x0: clamp(drawing.x0, 0, width),
		y0: clamp(drawing.y0, 0, height),
		x1: clamp(drawing.x1, 0, width),
		y1: clamp(drawing.y1, 0, height)
	};
}

/**
 * The two barbs of an arrow head, given the line it finishes.
 *
 * Returned rather than drawn so the shape can be tested without a canvas, which
 * matters here: an arrow head that points the wrong way, or that grows with the
 * line's length instead of its thickness, is the kind of thing you only notice
 * once it is in somebody's screenshot.
 *
 * The head is sized from the stroke width, so a thick arrow gets a head in
 * proportion, and it is capped at a third of the line so a short arrow is still
 * a line with a head rather than a triangle.
 */
export function arrowHead(
	from: Point,
	to: Point,
	strokeWidth: number,
	spread = Math.PI / 7
): [Point, Point] {
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	const size = Math.min(Math.max(strokeWidth * 3.5, strokeWidth + 2), length / 3 || strokeWidth);
	return [
		{ x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
		{ x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) }
	];
}

/**
 * Where the line should stop so the arrow head's point is the arrow's point.
 *
 * Running the line all the way to the tip and drawing a filled head on top of
 * it leaves the stroke poking through the barbs at anything but a hairline
 * width, so the line stops a little short of where it appears to end.
 */
export function arrowLineEnd(from: Point, to: Point, strokeWidth: number): Point {
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	const back = Math.min(strokeWidth * 1.6, length / 2);
	return { x: to.x - back * Math.cos(angle), y: to.y - back * Math.sin(angle) };
}
