import { describe, expect, it } from 'vitest';
import { sniffFormat } from './sniff';

function bytes(...parts: (string | number[])[]): Uint8Array {
	const out: number[] = [];
	for (const part of parts) {
		if (typeof part === 'string') for (const ch of part) out.push(ch.charCodeAt(0));
		else out.push(...part);
	}
	// pad so every sniffer has enough to look at
	while (out.length < 32) out.push(0);
	return new Uint8Array(out);
}

describe('magic bytes', () => {
	it('recognises the classic formats', () => {
		expect(sniffFormat(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))?.id).toBe('png');
		expect(sniffFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))?.id).toBe('jpg');
		expect(sniffFormat(bytes('GIF89a'))?.id).toBe('gif');
		expect(sniffFormat(bytes('GIF87a'))?.id).toBe('gif');
		expect(sniffFormat(bytes('RIFF', [1, 2, 3, 4], 'WEBP'))?.id).toBe('webp');
		expect(sniffFormat(bytes('BM'))?.id).toBe('bmp');
		expect(sniffFormat(bytes([0, 0, 1, 0, 1, 0]))?.id).toBe('ico');
		expect(sniffFormat(bytes('II', [0x2a, 0x00]))?.id).toBe('tiff');
		expect(sniffFormat(bytes('MM', [0x00, 0x2a]))?.id).toBe('tiff');
	});

	it('tells HEIC and AVIF apart by ftyp brands', () => {
		expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypheic', [0, 0, 0, 0], 'mif1heic'))?.id).toBe('heic');
		expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypavif', [0, 0, 0, 0], 'avifmiaf'))?.id).toBe('avif');
		// AVIF that hides behind a generic major brand
		expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypmif1', [0, 0, 0, 0], 'miafavif'))?.id).toBe('avif');
		// generic major brand with only HEIC-ish compatibles
		expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypmif1', [0, 0, 0, 0], 'miafheic'))?.id).toBe('heic');
	});

	it('recognises SVG as text', () => {
		expect(sniffFormat(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))?.id).toBe('svg');
		expect(sniffFormat(bytes('<?xml version="1.0"?>\n<svg width="10">'))?.id).toBe('svg');
		expect(sniffFormat(bytes('<html><body>svg</body>'))).toBeUndefined();
	});

	it('falls back to the extension only when bytes say nothing', () => {
		expect(sniffFormat(bytes([1, 2, 3, 4]), 'photo.png')?.id).toBe('png');
		expect(sniffFormat(bytes([1, 2, 3, 4]), 'photo.HEIF')?.id).toBe('heic');
		expect(sniffFormat(bytes([1, 2, 3, 4]), 'notes.txt')).toBeUndefined();
		expect(sniffFormat(bytes([1, 2, 3, 4]))).toBeUndefined();
		// a PNG renamed to .jpg is still a PNG
		expect(sniffFormat(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]), 'photo.jpg')?.id).toBe('png');
	});
});
