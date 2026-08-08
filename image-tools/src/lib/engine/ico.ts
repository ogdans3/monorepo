/**
 * ICO container around a PNG payload — valid since Windows Vista and what
 * favicon generators emit. The caller is responsible for scaling the image
 * to 256 × 256 or below first.
 */
export function wrapPngAsIco(png: Uint8Array, width: number, height: number): ArrayBuffer {
	if (width > 256 || height > 256) {
		throw new Error(`ICO entries are limited to 256 × 256, got ${width} × ${height}`);
	}
	const out = new Uint8Array(22 + png.length);
	const v = new DataView(out.buffer);
	v.setUint16(0, 0, true); // reserved
	v.setUint16(2, 1, true); // type: icon
	v.setUint16(4, 1, true); // one image
	out[6] = width === 256 ? 0 : width; // 0 means 256
	out[7] = height === 256 ? 0 : height;
	v.setUint16(10, 1, true); // colour planes
	v.setUint16(12, 32, true); // bits per pixel
	v.setUint32(14, png.length, true);
	v.setUint32(18, 22, true); // payload offset
	out.set(png, 22);
	return out.buffer;
}
