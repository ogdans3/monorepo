/**
 * A tiny path model, so an outline can be mirrored and traversed backwards.
 *
 * The first attempt drew each half of the body as its own closed shape, which
 * left a stroked seam straight down the middle of every torso and made the
 * legs read as one column. The fix is to walk a single continuous outline:
 * down the right side, round the right foot, up between the legs, down the
 * left, round the left foot and back up to the neck. That needs the right
 * half reversed and mirrored, which needs the path to be data rather than a
 * string.
 */

export interface Point {
	x: number;
	y: number;
}

/** One cubic segment. The start is wherever the previous segment ended. */
export interface Seg {
	c1: Point;
	c2: Point;
	to: Point;
}

export interface Outline {
	from: Point;
	segs: Seg[];
}

const r = (n: number) => Math.round(n * 100) / 100;
const pt = (x: number, y: number): Point => ({ x, y });

export function outline(from: Point, segs: Seg[]): Outline {
	return { from, segs };
}

/** `c(c1x, c1y, c2x, c2y, toX, toY)`, for brevity in the anatomy files. */
export function c(x1: number, y1: number, x2: number, y2: number, x: number, y: number): Seg {
	return { c1: pt(x1, y1), c2: pt(x2, y2), to: pt(x, y) };
}

/** A straight run, written as a cubic so everything stays one shape of thing. */
export function line(from: Point, to: Point): Seg {
	return {
		c1: pt(from.x + (to.x - from.x) / 3, from.y + (to.y - from.y) / 3),
		c2: pt(from.x + (2 * (to.x - from.x)) / 3, from.y + (2 * (to.y - from.y)) / 3),
		to
	};
}

/** Walk the same outline backwards: control points swap, ends run in reverse. */
export function reverse(o: Outline): Outline {
	const points = [o.from, ...o.segs.map((s) => s.to)];
	const segs: Seg[] = [];
	for (let i = o.segs.length - 1; i >= 0; i--) {
		segs.push({ c1: o.segs[i].c2, c2: o.segs[i].c1, to: points[i] });
	}
	return { from: points[points.length - 1], segs };
}

export function mirrorOutline(o: Outline, axis: number): Outline {
	const m = (q: Point): Point => pt(2 * axis - q.x, q.y);
	return {
		from: m(o.from),
		segs: o.segs.map((s) => ({ c1: m(s.c1), c2: m(s.c2), to: m(s.to) }))
	};
}

/** Join outlines end to end. Any gap between them is closed with a line. */
export function join(...parts: Outline[]): Outline {
	const first = parts[0];
	const segs = [...first.segs];
	let at = first.segs.length ? first.segs[first.segs.length - 1].to : first.from;
	for (const part of parts.slice(1)) {
		if (part.from.x !== at.x || part.from.y !== at.y) segs.push(line(at, part.from));
		segs.push(...part.segs);
		at = part.segs.length ? part.segs[part.segs.length - 1].to : part.from;
	}
	return { from: first.from, segs };
}

export function toPath(o: Outline, close = true): string {
	const d = [`M${r(o.from.x)},${r(o.from.y)}`];
	for (const s of o.segs) {
		d.push(`C${r(s.c1.x)},${r(s.c1.y)} ${r(s.c2.x)},${r(s.c2.y)} ${r(s.to.x)},${r(s.to.y)}`);
	}
	if (close) d.push('Z');
	return d.join(' ');
}

/**
 * The whole body from one half: walk the half down, mirror it, and walk the
 * mirror back up. No seam, because the midline is never stroked.
 */
export function mirrorAndClose(half: Outline, axis: number): Outline {
	return join(half, reverse(mirrorOutline(half, axis)));
}

export { pt as point };
