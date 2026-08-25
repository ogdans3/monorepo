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

/**
 * How many columns a layout puts an image row into.
 *
 * The three layouts are one geometry wearing three hats: a strip is a grid one
 * row deep, a stack is a grid one column wide, and the grid is whatever number
 * of columns was asked for. Everything below works in rows and columns only.
 */
export function columnsFor(layout: CombineLayout, count: number, gridColumns: number): number {
	if (count < 1) return 1;
	if (layout === 'horizontal') return count;
	if (layout === 'vertical') return 1;
	return Math.min(Math.max(1, Math.round(gridColumns)), count);
}

/** Rows needed to hold `count` images at `columns` across. */
export function rowsFor(count: number, columns: number): number {
	return Math.max(1, Math.ceil(Math.max(0, count) / Math.max(1, columns)));
}

/** Row-major chunks: 5 images, 2 columns → [[a, b], [c, d], [e]]. */
export function chunk<T>(items: T[], columns: number): T[][] {
	const size = Math.max(1, Math.round(columns));
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/**
 * Where the dividers sit. `rows` divides the canvas top to bottom, and `cols`
 * holds one set of fractions per row.
 *
 * Columns are per row rather than shared down the grid, which is what lets a
 * last row of two images fill the width instead of leaving a hole where the
 * third would have been, and what lets every cell keep the shape of the image
 * in it whatever its neighbours are doing.
 */
export interface GridSplits {
	rows: number[];
	cols: number[][];
}

export interface NaturalCanvas {
	width: number;
	height: number;
	splits: GridSplits;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const EMPTY: NaturalCanvas = { width: 16, height: 16, splits: { rows: [], cols: [] } };

/**
 * A strip: every image at its own shape, laid end to end.
 *
 * Each row is its images at a common height, the canvas is as wide as the row
 * that wants the most, and any other row is stretched to match rather than
 * squeezed, so nothing is ever scaled down to make the arithmetic work. Every
 * cell ends up the shape of the image in it, which is what makes side by side
 * and stacked come out flush with no letterboxing anywhere.
 */
export function justifiedCanvas(
	sizes: ImageSize[],
	columns: number,
	spacing: number
): NaturalCanvas {
	if (sizes.length === 0) return EMPTY;

	const rows = chunk(sizes, columns).map(matchedRow);
	const width = Math.max(
		...rows.map((row) => sum(row.extents) + spacing * (row.extents.length - 1) + spacing * 2)
	);
	const heights = rows.map((row) => {
		const content = width - spacing * 2 - spacing * (row.extents.length - 1);
		return Math.max(1, Math.round((row.cross * content) / sum(row.extents)));
	});

	return {
		width,
		height: sum(heights) + spacing * (heights.length - 1) + spacing * 2,
		splits: {
			rows: splitsFromExtents(heights),
			cols: rows.map((row) => splitsFromExtents(row.extents))
		}
	};
}

/**
 * A grid: columns that line up down the page and rows that line up across it.
 *
 * That alignment is the whole point of calling it a grid, and it is also the
 * one thing a strip cannot give you, since a row of its own shapes never lands
 * on the same boundaries as the row above. The price is that a cell is not
 * always the shape of its image: each column is as wide as the widest image in
 * it and each row as tall as the tallest, so nothing is ever scaled down and
 * anything shorter or narrower than its cell sits centred with the background
 * showing. Press Fill on an image to crop it into its cell instead.
 *
 * A last row with fewer images than columns leaves the remaining cells empty,
 * rather than stretching one image across the gap.
 */
export function alignedCanvas(
	sizes: ImageSize[],
	columns: number,
	spacing: number
): NaturalCanvas {
	if (sizes.length === 0) return EMPTY;

	const cols = Math.max(1, Math.min(Math.round(columns), sizes.length));
	const rows = chunk(sizes, cols);
	const colWidths = Array.from({ length: cols }, (_, c) =>
		Math.max(1, ...rows.map((row) => row[c]?.w ?? 1))
	);
	const rowHeights = rows.map((row) => Math.max(1, ...row.map((image) => image.h)));
	// One set of column fractions, handed to every row, is what keeps them
	// aligned. Dragging one moves it in every row at once.
	const colSplits = splitsFromExtents(colWidths);

	return {
		width: sum(colWidths) + spacing * (cols - 1) + spacing * 2,
		height: sum(rowHeights) + spacing * (rows.length - 1) + spacing * 2,
		splits: { rows: splitsFromExtents(rowHeights), cols: rows.map(() => colSplits) }
	};
}

/** The canvas a layout asks for, which is the two above under one name. */
export function naturalCanvas(
	layout: CombineLayout,
	sizes: ImageSize[],
	columns: number,
	spacing: number
): NaturalCanvas {
	return layout === 'grid'
		? alignedCanvas(sizes, columns, spacing)
		: justifiedCanvas(sizes, columns, spacing);
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
 * output pixels, back to the content fraction that the splits are made of.
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
 * Pixel rect per image cell, row-major. `gap` sits between cells, `pad` frames
 * the lot. Rows are laid down the canvas and each row divides the full width
 * between its own images, so a short last row shares out the whole width.
 */
export function cellRects(
	splits: GridSplits,
	count: number,
	W: number,
	H: number,
	gap: number,
	pad = 0
): PxRect[] {
	const rows = segments(splits.rows, H, gap, pad);
	const out: PxRect[] = [];
	for (let r = 0; r < rows.length && out.length < count; r++) {
		for (const col of segments(splits.cols[r] ?? [], W, gap, pad)) {
			out.push({ x: col.start, y: rows[r].start, w: col.size, h: rows[r].size });
		}
	}
	return out.slice(0, count);
}

/** Index of the cell at row `r`, column `c`, given each row's cell count. */
export function cellIndex(splits: GridSplits, r: number, c: number): number {
	let index = 0;
	for (let i = 0; i < r; i++) index += (splits.cols[i]?.length ?? 0) + 1;
	return index + c;
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
