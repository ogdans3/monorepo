/** Combine-tool geometry: natural canvas sizes, cells from splits, fit and crop rects. */

export type CombineLayout = 'horizontal' | 'vertical' | 'grid';

export interface PxRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface ImageSize {
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

/** Cumulative fractions from a list of extents: [2, 1, 1] → [0.5, 0.75]. */
export function splitsFromExtents(extents: number[]): number[] {
	const total = extents.reduce((a, b) => a + b, 0);
	if (total <= 0) return evenSplits(extents.length);
	const out: number[] = [];
	let acc = 0;
	for (let i = 0; i < extents.length - 1; i++) {
		acc += extents[i];
		out.push(acc / total);
	}
	return out;
}

/**
 * Every image scaled to the tallest one's height, so a row sits flush with no
 * letterboxing. Matching upwards rather than downwards on purpose: enlarging
 * costs a little sharpness, shrinking throws away detail that cannot come back.
 */
export function matchedRow(sizes: ImageSize[]): { extents: number[]; cross: number } {
	const cross = Math.max(1, ...sizes.map((s) => s.h));
	return { cross, extents: sizes.map((s) => Math.max(1, Math.round((s.w * cross) / s.h))) };
}

/** The same, down a column: every image scaled to the widest one's width. */
export function matchedColumn(sizes: ImageSize[]): { extents: number[]; cross: number } {
	const cross = Math.max(1, ...sizes.map((s) => s.w));
	return { cross, extents: sizes.map((s) => Math.max(1, Math.round((s.h * cross) / s.w))) };
}

export interface NaturalCanvas {
	width: number;
	height: number;
	splits: number[];
	gridSplits: [number, number];
}

/**
 * The canvas the images ask for: each one at its own shape, spacing added
 * around and between them rather than taken out of them.
 *
 * This is the whole answer to "what size should the output be". A strip is as
 * long as its images laid end to end, and as thick as the thickest, plus a
 * frame of `spacing` and a gutter of `spacing` between each pair. The splits
 * come back with it, so every cell matches the shape of the image in it and
 * nothing has to be cropped to fit.
 */
export function naturalCanvas(
	layout: CombineLayout,
	sizes: ImageSize[],
	spacing: number
): NaturalCanvas {
	const n = sizes.length;
	if (n === 0) return { width: 16, height: 16, splits: [], gridSplits: [0.5, 0.5] };

	if (layout === 'grid') {
		// Four cells of one size, big enough for the largest image once they are
		// all matched on height. Even splits, because a shared divider cannot
		// follow two rows of different proportions at once.
		const { extents, cross } = matchedRow(sizes);
		const cellW = Math.max(...extents);
		return {
			width: cellW * 2 + spacing * 3,
			height: cross * 2 + spacing * 3,
			splits: evenSplits(n),
			gridSplits: [0.5, 0.5]
		};
	}

	const { extents, cross } = layout === 'horizontal' ? matchedRow(sizes) : matchedColumn(sizes);
	const along = extents.reduce((a, b) => a + b, 0) + spacing * (n + 1);
	const across = cross + spacing * 2;
	return {
		width: layout === 'horizontal' ? along : across,
		height: layout === 'horizontal' ? across : along,
		splits: splitsFromExtents(extents),
		gridSplits: [0.5, 0.5]
	};
}

/**
 * Shrinks a canvas to an export limit without changing its shape.
 *
 * Both axes by the same factor, always from the size that was asked for rather
 * than from a size already shrunk once. Applying it to its own output compounds:
 * each extra bit of spacing then gets taken out of a canvas that cannot grow,
 * and the images give up a little more room every time.
 */
export function fitWithin(
	width: number,
	height: number,
	max: number
): { width: number; height: number } {
	const over = Math.max(width / max, height / max, 1);
	return { width: Math.round(width / over), height: Math.round(height / over) };
}

interface Segment {
	start: number;
	size: number;
}

/**
 * One axis: fractions → pixel segments, with the frame and the gutters taken
 * out first so the fractions divide what is left. Spacing is space the images
 * sit inside, never space carved out of them.
 */
function segments(splits: number[], total: number, gap: number, pad: number): Segment[] {
	const bounds = [0, ...splits, 1];
	const n = bounds.length - 1;
	const content = Math.max(n, total - pad * 2 - gap * (n - 1));
	const out: Segment[] = [];
	let cursor = pad;
	for (let i = 0; i < n; i++) {
		const extent = content * (bounds[i + 1] - bounds[i]);
		const start = Math.round(cursor);
		out.push({ start, size: Math.max(1, Math.round(cursor + extent) - start) });
		cursor += extent + gap;
	}
	return out;
}

/**
 * Inverse of the above for one divider: a pointer position along the axis, in
 * output pixels, back to the content fraction that `splits` is made of.
 *
 * Without it a dragged handle drifts away from the pointer as the spacing goes
 * up, because the frame and the gutters are pixels the fractions know nothing
 * about. `index` is which divider is moving, and therefore how many gutters lie
 * behind it.
 */
export function splitFractionAt(
	px: number,
	total: number,
	gap: number,
	pad: number,
	count: number,
	index: number
): number {
	const content = Math.max(1, total - pad * 2 - gap * (count - 1));
	return (px - pad - index * gap) / content;
}

/**
 * Pixel rect per image cell. `splits` sizes the strip layouts. The grid is
 * 2 × 2 (four images), sized by `gridSplits` [vertical, horizontal] and
 * ordered row-major. `gap` sits between cells, `pad` frames the lot.
 */
export function cellRects(
	layout: CombineLayout,
	count: number,
	splits: number[],
	gridSplits: [number, number],
	W: number,
	H: number,
	gap: number,
	pad = 0
): PxRect[] {
	if (layout === 'grid') {
		const cols = segments([gridSplits[0]], W, gap, pad);
		const rows = segments([gridSplits[1]], H, gap, pad);
		return [
			{ x: cols[0].start, y: rows[0].start, w: cols[0].size, h: rows[0].size },
			{ x: cols[1].start, y: rows[0].start, w: cols[1].size, h: rows[0].size },
			{ x: cols[0].start, y: rows[1].start, w: cols[0].size, h: rows[1].size },
			{ x: cols[1].start, y: rows[1].start, w: cols[1].size, h: rows[1].size }
		].slice(0, count);
	}
	if (layout === 'horizontal') {
		const h = Math.max(1, H - pad * 2);
		return segments(splits, W, gap, pad).map((s) => ({ x: s.start, y: pad, w: s.size, h }));
	}
	const w = Math.max(1, W - pad * 2);
	return segments(splits, H, gap, pad).map((s) => ({ x: pad, y: s.start, w, h: s.size }));
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

/**
 * Destination rect for showing the whole of an iw × ih image inside a cell,
 * centred. Where `coverSource` decides what to throw away, this one throws
 * nothing away and lets the background show instead.
 */
export function containRect(iw: number, ih: number, cell: PxRect): PxRect {
	const scale = Math.min(cell.w / iw, cell.h / ih);
	const w = Math.max(1, Math.round(iw * scale));
	const h = Math.max(1, Math.round(ih * scale));
	return {
		x: cell.x + Math.round((cell.w - w) / 2),
		y: cell.y + Math.round((cell.h - h) / 2),
		w,
		h
	};
}

/** Which cell contains the point, or -1. */
export function cellAt(rects: PxRect[], x: number, y: number): number {
	return rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
