import { describe, expect, it } from 'vitest';
import { icoFromPngs, wrapPngAsIco } from './ico';

describe('wrapPngAsIco', () => {
	const png = new Uint8Array([1, 2, 3, 4, 5]);

	it('writes a one-entry icon directory around the payload', () => {
		const v = new DataView(wrapPngAsIco(png, 32, 48));
		expect(v.getUint16(0, true)).toBe(0); // reserved
		expect(v.getUint16(2, true)).toBe(1); // type: icon
		expect(v.getUint16(4, true)).toBe(1); // count
		expect(v.getUint8(6)).toBe(32);
		expect(v.getUint8(7)).toBe(48);
		expect(v.getUint16(12, true)).toBe(32); // bpp
		expect(v.getUint32(14, true)).toBe(png.length);
		expect(v.getUint32(18, true)).toBe(22);
		expect(v.byteLength).toBe(22 + png.length);
		expect(new Uint8Array(v.buffer).slice(22)).toEqual(png);
	});

	it('encodes 256 as 0 per the format', () => {
		const v = new DataView(wrapPngAsIco(png, 256, 256));
		expect(v.getUint8(6)).toBe(0);
		expect(v.getUint8(7)).toBe(0);
	});

	it('refuses oversized entries', () => {
		expect(() => wrapPngAsIco(png, 257, 100)).toThrow();
	});
});

describe('icoFromPngs (multi-size)', () => {
	const a = new Uint8Array([1, 1, 1]);
	const b = new Uint8Array([2, 2, 2, 2]);
	const c = new Uint8Array([3]);

	it('packs several images with correct directory entries and offsets', () => {
		const buf = icoFromPngs([
			{ png: a, width: 16, height: 16 },
			{ png: b, width: 32, height: 32 },
			{ png: c, width: 48, height: 48 }
		]);
		const v = new DataView(buf);
		const bytes = new Uint8Array(buf);
		expect(v.getUint16(4, true)).toBe(3); // count
		const headerSize = 6 + 3 * 16;
		expect(v.getUint32(6 + 12, true)).toBe(headerSize); // first payload offset
		expect(v.getUint32(6 + 16 + 12, true)).toBe(headerSize + a.length);
		expect(v.getUint32(6 + 32 + 12, true)).toBe(headerSize + a.length + b.length);
		expect(v.getUint8(6 + 16)).toBe(32); // second entry width
		expect(bytes.slice(headerSize + a.length, headerSize + a.length + b.length)).toEqual(b);
		expect(buf.byteLength).toBe(headerSize + 8);
	});

	it('refuses an empty set', () => {
		expect(() => icoFromPngs([])).toThrow();
	});
});
