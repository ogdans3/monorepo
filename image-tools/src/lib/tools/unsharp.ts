/**
 * Unsharp mask: out = base + (base − blurred) · k, per RGB channel, alpha
 * untouched. The blurred copy comes from a canvas blur upstream. k of 0 is a
 * no-op, 1 is strong, 2 is deliberately too much.
 */
export function unsharpMask(
	base: Uint8ClampedArray,
	blurred: Uint8ClampedArray,
	k: number
): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(base.length);
	for (let i = 0; i < base.length; i += 4) {
		out[i] = base[i] + (base[i] - blurred[i]) * k;
		out[i + 1] = base[i + 1] + (base[i + 1] - blurred[i + 1]) * k;
		out[i + 2] = base[i + 2] + (base[i + 2] - blurred[i + 2]) * k;
		out[i + 3] = base[i + 3];
	}
	return out;
}
