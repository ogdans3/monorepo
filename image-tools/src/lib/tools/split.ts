/** Tiling math for the split tool. */

export interface Tile {
	row: number;
	col: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Even tiles covering the whole image. The last row and column absorb the
 * remainder pixels so nothing is dropped and tiles never overlap.
 */
export function tileRects(width: number, height: number, rows: number, cols: number): Tile[] {
	const r = Math.max(1, Math.min(24, Math.round(rows)));
	const c = Math.max(1, Math.min(24, Math.round(cols)));
	const baseW = Math.floor(width / c);
	const baseH = Math.floor(height / r);
	const tiles: Tile[] = [];
	for (let row = 0; row < r; row++) {
		for (let col = 0; col < c; col++) {
			const x = col * baseW;
			const y = row * baseH;
			tiles.push({
				row,
				col,
				x,
				y,
				w: col === c - 1 ? width - x : baseW,
				h: row === r - 1 ? height - y : baseH
			});
		}
	}
	return tiles;
}
