import { describe, expect, it } from 'vitest';
import { looksLikePdf, parsePageRange, pdfName } from './pdf';

describe('looksLikePdf', () => {
	it('matches the %PDF header only', () => {
		expect(looksLikePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
		expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
		expect(looksLikePdf(new Uint8Array([]))).toBe(false);
	});
});

describe('pdfName', () => {
	it('swaps the suffix in before the extension', () => {
		expect(pdfName('report.pdf', '-merged')).toBe('report-merged.pdf');
		expect(pdfName('report.PDF', '-split')).toBe('report-split.pdf');
		expect(pdfName('scan', '-rotated')).toBe('scan-rotated.pdf');
	});
});

describe('parsePageRange', () => {
	it('reads single pages, ranges and open ends', () => {
		expect(parsePageRange('1-3, 5', 10)).toEqual([1, 2, 3, 5]);
		expect(parsePageRange('8-', 10)).toEqual([8, 9, 10]);
		expect(parsePageRange('-3', 10)).toEqual([1, 2, 3]);
		expect(parsePageRange('4', 10)).toEqual([4]);
	});

	it('treats empty input as the whole document', () => {
		expect(parsePageRange('', 3)).toEqual([1, 2, 3]);
		expect(parsePageRange('   ', 2)).toEqual([1, 2]);
	});

	it('sorts, deduplicates and clamps to the document', () => {
		expect(parsePageRange('5, 1, 5, 2-3', 10)).toEqual([1, 2, 3, 5]);
		expect(parsePageRange('9-99', 10)).toEqual([9, 10]);
		expect(parsePageRange('0, 11', 10)).toEqual([]);
	});

	it('ignores nonsense without throwing', () => {
		expect(parsePageRange('abc, , 2', 5)).toEqual([2]);
		expect(parsePageRange(',,,', 5)).toEqual([]);
	});
});
