import { describe, expect, it } from 'vitest';
import { encodeBmp } from './bmp';

const opaque2x2 = {
	width: 2,
	height: 2,
	// red, green / blue, white
	data: new Uint8ClampedArray([
		255, 0, 0, 255, 0, 255, 0, 255,
		0, 0, 255, 255, 255, 255, 255, 255
	])
};

describe('24-bit path (opaque)', () => {
	const v = new DataView(encodeBmp(opaque2x2));

	it('writes a valid BITMAPINFOHEADER file', () => {
		expect(String.fromCharCode(v.getUint8(0), v.getUint8(1))).toBe('BM');
		expect(v.getUint32(2, true)).toBe(v.byteLength);
		expect(v.getUint32(10, true)).toBe(54); // pixel data offset
		expect(v.getUint32(14, true)).toBe(40); // header size
		expect(v.getInt32(18, true)).toBe(2);
		expect(v.getInt32(22, true)).toBe(2);
		expect(v.getUint16(28, true)).toBe(24); // bpp
		expect(v.getUint32(30, true)).toBe(0); // BI_RGB
	});

	it('stores rows bottom-up as padded BGR', () => {
		// first stored row is the image's bottom row: blue, white
		expect([v.getUint8(54), v.getUint8(55), v.getUint8(56)]).toEqual([255, 0, 0]); // blue as BGR
		expect([v.getUint8(57), v.getUint8(58), v.getUint8(59)]).toEqual([255, 255, 255]);
		// row stride padded to 4 bytes: 2 px × 3 B = 6 → 8
		expect(v.byteLength).toBe(54 + 8 * 2);
		// second stored row starts with red as BGR
		expect([v.getUint8(62), v.getUint8(63), v.getUint8(64)]).toEqual([0, 0, 255]);
	});
});

describe('32-bit path (transparency)', () => {
	const translucent = {
		width: 1,
		height: 1,
		data: new Uint8ClampedArray([10, 20, 30, 128])
	};
	const v = new DataView(encodeBmp(translucent));

	it('writes a BITMAPV4HEADER with alpha mask', () => {
		expect(v.getUint32(14, true)).toBe(108); // V4 header size
		expect(v.getUint16(28, true)).toBe(32); // bpp
		expect(v.getUint32(30, true)).toBe(3); // BI_BITFIELDS
		expect(v.getUint32(54, true)).toBe(0x00ff0000); // R mask
		expect(v.getUint32(58, true)).toBe(0x0000ff00); // G mask
		expect(v.getUint32(62, true)).toBe(0x000000ff); // B mask
		expect(v.getUint32(66, true)).toBe(0xff000000); // A mask
	});

	it('stores BGRA pixels with alpha intact', () => {
		expect([v.getUint8(122), v.getUint8(123), v.getUint8(124), v.getUint8(125)]).toEqual([
			30, 20, 10, 128
		]);
	});
});
