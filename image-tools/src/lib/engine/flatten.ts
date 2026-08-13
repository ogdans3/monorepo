/**
 * Compositing helpers for formats that cannot carry full transparency.
 * Pure, so the blending maths is tested without a browser.
 */

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** "#ff0080" or "ff0080" to channels. Falls back to white on nonsense. */
export function hexToRgb(hex: string): Rgb {
	const h = hex.trim().replace(/^#/, '');
	if (!/^[0-9a-f]{6}$/i.test(h)) return WHITE;
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	};
}

/** Does any pixel carry less than full opacity? */
export function hasTransparency(data: Uint8ClampedArray): boolean {
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] !== 255) return true;
	}
	return false;
}

/**
 * Blend part-transparent pixels onto a solid colour while leaving fully
 * transparent ones alone. This is what a format with on-or-off transparency
 * needs: GIF can only say "transparent" or "not", so a soft edge left as is
 * would keep its own colour at full strength and show up as a halo. Blending
 * it against the background first makes the edge sit correctly instead.
 */
export function flattenPartialAlpha(
	data: Uint8ClampedArray,
	background: Rgb
): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(data);
	for (let i = 0; i < out.length; i += 4) {
		const a = out[i + 3];
		if (a === 0 || a === 255) continue;
		const t = a / 255;
		out[i] = out[i] * t + background.r * (1 - t);
		out[i + 1] = out[i + 1] * t + background.g * (1 - t);
		out[i + 2] = out[i + 2] * t + background.b * (1 - t);
		out[i + 3] = 255;
	}
	return out;
}
