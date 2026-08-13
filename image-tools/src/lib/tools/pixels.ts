/**
 * Whole-image pixel transforms. Each takes RGBA in and returns fresh RGBA,
 * leaving alpha alone unless the effect is about alpha. Pure and testable, so
 * the maths is checked without a browser.
 */

/** Rec. 709 luma, the weighting that matches how eyes see brightness. */
export function luma(r: number, g: number, b: number): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function grayscale(data: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		const y = luma(data[i], data[i + 1], data[i + 2]);
		out[i] = y;
		out[i + 1] = y;
		out[i + 2] = y;
		out[i + 3] = data[i + 3];
	}
	return out;
}

/** The classic warm brown of an old photograph. */
export function sepia(data: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		out[i] = 0.393 * r + 0.769 * g + 0.189 * b;
		out[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
		out[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
		out[i + 3] = data[i + 3];
	}
	return out;
}

/**
 * Replace every pixel close to `from` with `to`, keeping alpha. Tolerance is
 * 0 to 100 over the same RGB distance the flood fill uses, so the two tools
 * feel the same.
 */
export function replaceColor(
	data: Uint8ClampedArray,
	from: { r: number; g: number; b: number },
	to: { r: number; g: number; b: number },
	tolerance: number
): { data: Uint8ClampedArray<ArrayBuffer>; changed: number } {
	const out = new Uint8ClampedArray(data);
	const threshold = (tolerance / 100) * 441.673;
	const t2 = threshold * threshold;
	let changed = 0;
	for (let i = 0; i < data.length; i += 4) {
		const dr = data[i] - from.r;
		const dg = data[i + 1] - from.g;
		const db = data[i + 2] - from.b;
		if (dr * dr + dg * dg + db * db > t2) continue;
		out[i] = to.r;
		out[i + 1] = to.g;
		out[i + 2] = to.b;
		changed++;
	}
	return { data: out, changed };
}

/**
 * The tightest box that still holds everything worth keeping, for trimming a
 * flat or transparent border. Returns null when the whole image would go.
 */
export function trimBounds(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	tolerance: number
): { x: number; y: number; w: number; h: number } | null {
	// the corner pixel is the border colour by convention
	const cr = data[0];
	const cg = data[1];
	const cb = data[2];
	const ca = data[3];
	const threshold = (tolerance / 100) * 441.673;
	const t2 = threshold * threshold;

	const isBorder = (i: number) => {
		// fully transparent pixels count as border whatever their colour is
		if (ca === 0) return data[i + 3] === 0;
		if (data[i + 3] === 0) return true;
		const dr = data[i] - cr;
		const dg = data[i + 1] - cg;
		const db = data[i + 2] - cb;
		return dr * dr + dg * dg + db * db <= t2;
	};

	let top = 0;
	let bottom = height - 1;
	let left = 0;
	let right = width - 1;

	const rowIsBorder = (y: number) => {
		for (let x = 0; x < width; x++) if (!isBorder((y * width + x) * 4)) return false;
		return true;
	};
	const colIsBorder = (x: number) => {
		for (let y = top; y <= bottom; y++) if (!isBorder((y * width + x) * 4)) return false;
		return true;
	};

	while (top <= bottom && rowIsBorder(top)) top++;
	if (top > bottom) return null;
	while (bottom > top && rowIsBorder(bottom)) bottom--;
	while (left <= right && colIsBorder(left)) left++;
	if (left > right) return null;
	while (right > left && colIsBorder(right)) right--;

	return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
