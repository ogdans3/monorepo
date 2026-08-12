/**
 * Flip every colour to its opposite, like a film negative. Alpha stays
 * untouched, and running it twice gives the original back exactly.
 */
export function invertPixels(data: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		out[i] = 255 - data[i];
		out[i + 1] = 255 - data[i + 1];
		out[i + 2] = 255 - data[i + 2];
		out[i + 3] = data[i + 3];
	}
	return out;
}
