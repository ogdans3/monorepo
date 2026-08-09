/** Colour formatting and palette extraction for the colour picker. */

export interface PickedColor {
	r: number;
	g: number;
	b: number;
}

export function rgbToHex({ r, g, b }: PickedColor): string {
	const part = (v: number) => v.toString(16).padStart(2, '0');
	return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbString({ r, g, b }: PickedColor): string {
	return `rgb(${r}, ${g}, ${b})`;
}

export function hslString({ r, g, b }: PickedColor): string {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
		else if (max === gn) h = ((bn - rn) / d + 2) / 6;
		else h = ((rn - gn) / d + 4) / 6;
	}
	return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/**
 * Dominant colours via the same quantiser GIF encoding uses. Expects RGBA
 * bytes (ideally from a downscaled copy) and returns up to `count` colours,
 * most dominant first as produced by the quantiser. gifenc is CJS, so it is
 * imported lazily to keep SSR prerendering happy.
 */
export async function extractPalette(
	rgba: Uint8Array | Uint8ClampedArray,
	count = 6
): Promise<PickedColor[]> {
	const { quantize } = await import('gifenc');
	const data = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
	const palette = quantize(data, Math.max(2, Math.min(32, count * 2)), { format: 'rgb565' });
	const seen = new Set<string>();
	const out: PickedColor[] = [];
	for (const entry of palette) {
		const color = { r: entry[0], g: entry[1], b: entry[2] };
		const key = rgbToHex(color);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(color);
		if (out.length >= count) break;
	}
	return out;
}
