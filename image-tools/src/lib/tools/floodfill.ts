/**
 * Erase a contiguous colour region, magic-wand style. Starts at (sx, sy),
 * spreads across 4-connected neighbours whose colour stays within the
 * tolerance of the seed colour, and sets their alpha to 0. RGB values are
 * left untouched so operations can be replayed from the original pixels.
 *
 * tolerance: 0 to 100, where 0 erases only the exact seed colour and 100
 * erases everything reachable. Returns the number of erased pixels.
 */
export function floodErase(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	sx: number,
	sy: number,
	tolerance: number
): number {
	if (sx < 0 || sy < 0 || sx >= width || sy >= height) return 0;

	const seed = (sy * width + sx) * 4;
	const sr = data[seed];
	const sg = data[seed + 1];
	const sb = data[seed + 2];
	// max RGB distance is √(3 · 255²) ≈ 441.7
	const threshold = (tolerance / 100) * 441.673;
	const t2 = threshold * threshold;

	const visited = new Uint8Array(width * height);
	// marked visited at push time, so each pixel enters the stack at most once
	const stack = new Int32Array(width * height);
	let top = 0;
	const start = sy * width + sx;
	visited[start] = 1;
	stack[top++] = start;

	let erased = 0;
	while (top > 0) {
		const i = stack[--top];
		const p = i * 4;
		const dr = data[p] - sr;
		const dg = data[p + 1] - sg;
		const db = data[p + 2] - sb;
		if (dr * dr + dg * dg + db * db > t2) continue;

		data[p + 3] = 0;
		erased++;

		const x = i - ((i / width) | 0) * width;
		if (x > 0 && !visited[i - 1]) {
			visited[i - 1] = 1;
			stack[top++] = i - 1;
		}
		if (x < width - 1 && !visited[i + 1]) {
			visited[i + 1] = 1;
			stack[top++] = i + 1;
		}
		if (i >= width && !visited[i - width]) {
			visited[i - width] = 1;
			stack[top++] = i - width;
		}
		if (i < width * (height - 1) && !visited[i + width]) {
			visited[i + width] = 1;
			stack[top++] = i + width;
		}
	}
	return erased;
}
