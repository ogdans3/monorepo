/**
 * ICO containers around PNG payloads — valid since Windows Vista and what
 * favicon generators emit. Callers are responsible for scaling images to
 * 256 × 256 or below first.
 */

export interface IcoEntry {
	png: Uint8Array;
	width: number;
	height: number;
}

/** Multi-image ICO, e.g. 16 + 32 + 48 in one favicon.ico. */
export function icoFromPngs(entries: IcoEntry[]): ArrayBuffer {
	if (!entries.length) throw new Error('An ICO needs at least one image');
	for (const e of entries) {
		if (e.width > 256 || e.height > 256) {
			throw new Error(`ICO entries are limited to 256 × 256, got ${e.width} × ${e.height}`);
		}
	}
	const headerSize = 6 + entries.length * 16;
	const total = headerSize + entries.reduce((sum, e) => sum + e.png.length, 0);
	const out = new Uint8Array(total);
	const v = new DataView(out.buffer);
	v.setUint16(0, 0, true); // reserved
	v.setUint16(2, 1, true); // type: icon
	v.setUint16(4, entries.length, true);

	let offset = headerSize;
	entries.forEach((e, i) => {
		const at = 6 + i * 16;
		out[at] = e.width === 256 ? 0 : e.width; // 0 means 256
		out[at + 1] = e.height === 256 ? 0 : e.height;
		out[at + 2] = 0; // palette colours
		out[at + 3] = 0; // reserved
		v.setUint16(at + 4, 1, true); // colour planes
		v.setUint16(at + 6, 32, true); // bits per pixel
		v.setUint32(at + 8, e.png.length, true);
		v.setUint32(at + 12, offset, true);
		out.set(e.png, offset);
		offset += e.png.length;
	});
	return out.buffer;
}

/** Single-image convenience — the converter's ICO target uses this. */
export function wrapPngAsIco(png: Uint8Array, width: number, height: number): ArrayBuffer {
	return icoFromPngs([{ png, width, height }]);
}
