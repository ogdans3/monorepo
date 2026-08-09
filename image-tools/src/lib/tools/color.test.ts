import { describe, expect, it } from 'vitest';
import { extractPalette, hslString, rgbString, rgbToHex } from './color';

describe('colour formatting', () => {
	it('formats hex, rgb and hsl', () => {
		expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
		expect(rgbToHex({ r: 7, g: 8, b: 9 })).toBe('#070809');
		expect(rgbString({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
		expect(hslString({ r: 255, g: 0, b: 0 })).toBe('hsl(0, 100%, 50%)');
		expect(hslString({ r: 128, g: 128, b: 128 })).toBe('hsl(0, 0%, 50%)');
		expect(hslString({ r: 0, g: 0, b: 255 })).toBe('hsl(240, 100%, 50%)');
	});
});

describe('extractPalette', () => {
	it('finds the dominant colours of a two-colour image', async () => {
		// 8×1: six red pixels, two blue
		const px: number[] = [];
		for (let i = 0; i < 6; i++) px.push(200, 0, 0, 255);
		for (let i = 0; i < 2; i++) px.push(0, 0, 200, 255);
		const palette = await extractPalette(new Uint8Array(px), 4);
		expect(palette.length).toBeGreaterThanOrEqual(2);
		const hexes = palette.map(rgbToHex);
		expect(hexes.some((h) => h.startsWith('#c') || h.startsWith('#b'))).toBe(true); // red-ish present
	});

	it('deduplicates and respects the count', async () => {
		const px: number[] = [];
		for (let i = 0; i < 16; i++) px.push(50, 100, 150, 255);
		const palette = await extractPalette(new Uint8Array(px), 6);
		expect(palette.length).toBeLessThanOrEqual(6);
		expect(new Set(palette.map(rgbToHex)).size).toBe(palette.length);
	});
});
