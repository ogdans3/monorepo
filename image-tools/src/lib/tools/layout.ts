/** Combine-tool geometry: cells from splits, divider clamping, cover crops. */

export type CombineLayout = 'horizontal' | 'vertical' | 'grid';

export interface PxRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Divider positions for equally sized cells, e.g. 3 cells → [⅓, ⅔]. */
export function evenSplits(count: number): number[] {
	return Array.from({ length: Math.max(0, count - 1) }, (_, i) => (i + 1) / count);
}

/** Move one divider, keeping every cell at least `minFrac` wide. */
export function moveDivider(splits: number[], index: number, pos: number, minFrac = 0.08): number[] {
	const lo = (index === 0 ? 0 : splits[index - 1]) + minFrac;
	const hi = (index === splits.length - 1 ? 1 : splits[index + 1]) - minFrac;
	const next = [...splits];
	next[index] = clamp(pos, lo, hi);
	return next;
}

interface Segment {
	start: number;
	size: number;
}

/** One axis: fractions → pixel segments with the gap shaved off inner edges. */
function segments(splits: number[], total: number, gap: number): Segment[] {
	const bounds = [0, ...splits, 1];
	const n = bounds.length - 1;
	const out: Segment[] = [];
	for (let i = 0; i < n; i++) {
		const rawStart = bounds[i] * total + (i > 0 ? gap / 2 : 0);
		const rawEnd = bounds[i + 1] * total - (i < n - 1 ? gap / 2 : 0);
		const start = Math.round(rawStart);
		out.push({ start, size: Math.max(1, Math.round(rawEnd) - start) });
	}
	return out;
}

/**
 * Pixel rect per image cell. `splits` sizes the strip layouts. The grid is
 * 2 × 2 (four images), sized by `gridSplits` [vertical, horizontal] and
 * ordered row-major.
 */
export function cellRects(
	layout: CombineLayout,
	count: number,
	splits: number[],
	gridSplits: [number, number],
	W: number,
	H: number,
	gap: number
): PxRect[] {
	if (layout === 'grid') {
		const cols = segments([gridSplits[0]], W, gap);
		const rows = segments([gridSplits[1]], H, gap);
		return [
			{ x: cols[0].start, y: rows[0].start, w: cols[0].size, h: rows[0].size },
			{ x: cols[1].start, y: rows[0].start, w: cols[1].size, h: rows[0].size },
			{ x: cols[0].start, y: rows[1].start, w: cols[0].size, h: rows[1].size },
			{ x: cols[1].start, y: rows[1].start, w: cols[1].size, h: rows[1].size }
		].slice(0, count);
	}
	if (layout === 'horizontal') {
		return segments(splits, W, gap).map((s) => ({ x: s.start, y: 0, w: s.size, h: H }));
	}
	return segments(splits, H, gap).map((s) => ({ x: 0, y: s.start, w: W, h: s.size }));
}

/**
 * Source rect for drawing an iw × ih image into a cw × ch cell, cover style.
 * pan 0..1 picks which part of the overflow shows, 0.5 being centred.
 */
export function coverSource(
	iw: number,
	ih: number,
	cw: number,
	ch: number,
	panX: number,
	panY: number
): { sx: number; sy: number; sw: number; sh: number } {
	const scale = Math.max(cw / iw, ch / ih);
	const sw = cw / scale;
	const sh = ch / scale;
	return {
		sx: (iw - sw) * clamp(panX, 0, 1),
		sy: (ih - sh) * clamp(panY, 0, 1),
		sw,
		sh
	};
}

/** Which cell contains the point, or -1. */
export function cellAt(rects: PxRect[], x: number, y: number): number {
	return rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
