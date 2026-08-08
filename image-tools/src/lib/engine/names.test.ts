import { describe, expect, it } from 'vitest';
import { formatBytes, outputFileName } from './names';

describe('outputFileName', () => {
	it('keeps the base name and swaps the extension', () => {
		expect(outputFileName('IMG_1234.HEIC', '.jpg')).toBe('IMG_1234.jpg');
		expect(outputFileName('photo.png', '.webp')).toBe('photo.webp');
	});

	it('only touches the last extension', () => {
		expect(outputFileName('site.logo.v2.png', '.avif')).toBe('site.logo.v2.avif');
	});

	it('handles names without an extension', () => {
		expect(outputFileName('scan', '.png')).toBe('scan.png');
	});

	it('handles dotfiles and spaces', () => {
		expect(outputFileName('.hidden', '.png')).toBe('.hidden.png');
		expect(outputFileName('my holiday photo.jpeg', '.png')).toBe('my holiday photo.png');
	});
});

describe('formatBytes', () => {
	it('picks sensible units', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 KB');
		expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
		expect(formatBytes(123 * 1024)).toBe('123 KB');
	});
});
