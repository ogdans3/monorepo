// Placing things on the 16:9 stage. Every box is percent of the stage, and
// the editor's grid is square: 32 columns by 18 rows.

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const COLS = 32;
export const ROWS = 18;
export const STEP_X = 100 / COLS;
export const STEP_Y = 100 / ROWS;
/** The smallest a box can be made by dragging: one cell. */
export const MIN_W = STEP_X;
export const MIN_H = STEP_Y;

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The place and size of anything placed, and nothing else. What these
 * functions are given is often a whole answer or element, and what they give
 * back is spread into new ones: an id carried along with the box is a second
 * answer with the first one's id.
 */
const only = (b: Box): Box => ({ x: b.x, y: b.y, w: b.w, h: b.h });

/** Three decimals is far below a pixel on any screen, and keeps the JSON short. */
export const tidy = (v: number) => Math.round(v * 1000) / 1000;

const toGrid = (v: number, step: number) => Math.round(v / step) * step;

/**
 * How far to move a span starting at [start], [size] long, so that whichever
 * of its start, middle or end is nearest a grid line lands on it.
 */
export function snapShift(start: number, size: number, step: number): number {
	let best = Infinity;
	for (const at of [start, start + size / 2, start + size]) {
		const shift = toGrid(at, step) - at;
		if (Math.abs(shift) < Math.abs(best)) best = shift;
	}
	return best;
}

/** A box dragged by [dx], [dy], on the grid unless [free], and on the stage. */
export function moveBox(start: Box, dx: number, dy: number, free = false): Box {
	let x = start.x + dx;
	let y = start.y + dy;
	if (!free) {
		x += snapShift(x, start.w, STEP_X);
		y += snapShift(y, start.h, STEP_Y);
	}
	return {
		x: tidy(clamp(x, 0, 100 - start.w)),
		y: tidy(clamp(y, 0, 100 - start.h)),
		w: start.w,
		h: start.h
	};
}

/**
 * A box resized by one of its handles. The edges the handle holds follow the
 * pointer, on the grid unless [free]; the others stay. With [ratio], a corner
 * keeps the box's proportions.
 */
export function resizeBox(start: Box, handle: Handle, dx: number, dy: number, free = false, ratio?: number): Box {
	const sx = (v: number) => (free ? v : toGrid(v, STEP_X));
	const sy = (v: number) => (free ? v : toGrid(v, STEP_Y));
	let left = start.x;
	let top = start.y;
	let right = start.x + start.w;
	let bottom = start.y + start.h;
	if (handle.includes('w')) left = clamp(sx(left + dx), 0, right - MIN_W);
	if (handle.includes('e')) right = clamp(sx(right + dx), left + MIN_W, 100);
	if (handle.includes('n')) top = clamp(sy(top + dy), 0, bottom - MIN_H);
	if (handle.includes('s')) bottom = clamp(sy(bottom + dy), top + MIN_H, 100);
	if (ratio && handle.length === 2) {
		// The width leads; the height follows it, from the edge that moves.
		const h = clamp((right - left) / ratio, MIN_H, 100);
		if (handle.includes('n')) top = clamp(bottom - h, 0, bottom - MIN_H);
		else bottom = clamp(top + h, top + MIN_H, 100);
	}
	// The edges are what were placed, so they are what is rounded: the far
	// edge stays exactly where it was.
	const [l, t, r, b] = [left, top, right, bottom].map(tidy);
	return { x: l, y: t, w: tidy(r - l), h: tidy(b - t) };
}

/** A box nudged by the arrow keys: a cell at a time, or a fine step. */
export function nudgeBox(start: Box, cols: number, rows: number, fine = false): Box {
	const dx = cols * (fine ? 0.25 : STEP_X);
	const dy = rows * (fine ? 0.25 * (16 / 9) : STEP_Y);
	return moveBox(start, dx, dy, true);
}

export function bounds(boxes: Box[]): Box | null {
	if (boxes.length === 0) return null;
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.w));
	const bottom = Math.max(...boxes.map((b) => b.y + b.h));
	return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Where the answers go when the presenter has not placed any yet: below the
 * question, the width of the slide, clear of the code in the corner.
 */
export const ANSWER_AREA: Box = { x: 6.25, y: 38.889, w: 87.5, h: 50 };

/**
 * Lays [n] answers out evenly over [area]: in one row up to four, then in
 * rows of as many as make the cells nearest square.
 */
export function arrange(n: number, area: Box = ANSWER_AREA, gapX = 2.5, gapY = 4): Box[] {
	if (n <= 0) return [];
	let cols = n <= 4 ? n : Math.ceil(Math.sqrt(n * ((area.w * 16) / (area.h * 9))));
	cols = clamp(cols, 1, n);
	const rows = Math.ceil(n / cols);
	const w = (area.w - gapX * (cols - 1)) / cols;
	const h = (area.h - gapY * (rows - 1)) / rows;
	return Array.from({ length: n }, (_, i) => ({
		x: tidy(area.x + (i % cols) * (w + gapX)),
		y: tidy(area.y + Math.floor(i / cols) * (h + gapY)),
		w: tidy(w),
		h: tidy(h)
	}));
}

/**
 * Where a new answer goes: beside the last one, the same size, if there is
 * room on its row; under the first one on a new row if not; and if neither
 * fits, a little down and right of the last, for the presenter to move.
 */
export function nextAnswer(existing: Box[]): Box {
	if (existing.length === 0) return arrange(1)[0];
	const last = only(existing[existing.length - 1]);
	const gap = 2.5;
	const beside = { ...last, x: tidy(last.x + last.w + gap) };
	if (beside.x + beside.w <= 100 - 2) return beside;
	const first = existing.reduce((a, b) => (b.x < a.x ? b : a));
	const below = { ...last, x: first.x, y: tidy(last.y + last.h + 4) };
	if (below.y + below.h <= 100 - 2) return below;
	return moveBox(last, STEP_X, STEP_Y, true);
}
