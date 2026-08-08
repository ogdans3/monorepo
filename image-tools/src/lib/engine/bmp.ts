import type { RawImage } from './raw';

/**
 * BMP encoder. Fully opaque images get the classic 24-bit BITMAPINFOHEADER
 * that anything can open; images with transparency get a 32-bit
 * BITMAPV4HEADER with an alpha mask, which every modern viewer understands.
 */
export function encodeBmp(img: RawImage): ArrayBuffer {
	for (let i = 3; i < img.data.length; i += 4) {
		if (img.data[i] !== 255) return encode32(img);
	}
	return encode24(img);
}

function encode24({ width, height, data }: RawImage): ArrayBuffer {
	const rowSize = (width * 3 + 3) & ~3; // rows pad to 4 bytes
	const pixelBytes = rowSize * height;
	const buffer = new ArrayBuffer(14 + 40 + pixelBytes);
	const v = new DataView(buffer);
	const out = new Uint8Array(buffer);

	writeFileHeader(v, buffer.byteLength, 14 + 40);
	v.setUint32(14, 40, true); // BITMAPINFOHEADER
	v.setInt32(18, width, true);
	v.setInt32(22, height, true); // positive height = bottom-up
	v.setUint16(26, 1, true);
	v.setUint16(28, 24, true);
	v.setUint32(30, 0, true); // BI_RGB
	v.setUint32(34, pixelBytes, true);
	v.setInt32(38, 2835, true); // 72 dpi
	v.setInt32(42, 2835, true);

	for (let y = 0; y < height; y++) {
		const src = (height - 1 - y) * width * 4;
		const dst = 54 + y * rowSize;
		for (let x = 0; x < width; x++) {
			out[dst + x * 3] = data[src + x * 4 + 2]; // B
			out[dst + x * 3 + 1] = data[src + x * 4 + 1]; // G
			out[dst + x * 3 + 2] = data[src + x * 4]; // R
		}
	}
	return buffer;
}

function encode32({ width, height, data }: RawImage): ArrayBuffer {
	const pixelBytes = width * height * 4;
	const buffer = new ArrayBuffer(14 + 108 + pixelBytes);
	const v = new DataView(buffer);
	const out = new Uint8Array(buffer);

	writeFileHeader(v, buffer.byteLength, 14 + 108);
	v.setUint32(14, 108, true); // BITMAPV4HEADER
	v.setInt32(18, width, true);
	v.setInt32(22, height, true);
	v.setUint16(26, 1, true);
	v.setUint16(28, 32, true);
	v.setUint32(30, 3, true); // BI_BITFIELDS
	v.setUint32(34, pixelBytes, true);
	v.setInt32(38, 2835, true);
	v.setInt32(42, 2835, true);
	v.setUint32(54, 0x00ff0000, true); // R
	v.setUint32(58, 0x0000ff00, true); // G
	v.setUint32(62, 0x000000ff, true); // B
	v.setUint32(66, 0xff000000, true); // A
	v.setUint32(70, 0x73524742, true); // 'sRGB'

	for (let y = 0; y < height; y++) {
		const src = (height - 1 - y) * width * 4;
		const dst = 122 + y * width * 4;
		for (let x = 0; x < width; x++) {
			out[dst + x * 4] = data[src + x * 4 + 2]; // B
			out[dst + x * 4 + 1] = data[src + x * 4 + 1]; // G
			out[dst + x * 4 + 2] = data[src + x * 4]; // R
			out[dst + x * 4 + 3] = data[src + x * 4 + 3]; // A
		}
	}
	return buffer;
}

function writeFileHeader(v: DataView, fileSize: number, dataOffset: number) {
	v.setUint8(0, 0x42); // 'B'
	v.setUint8(1, 0x4d); // 'M'
	v.setUint32(2, fileSize, true);
	v.setUint32(10, dataOffset, true);
}
