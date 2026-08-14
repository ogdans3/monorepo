import { describe, expect, it } from 'vitest';

import { pairFacts, spellingNote } from './pairfacts';
import { FORMATS, allPairSlugs, parsePairSlug } from './formats';

const facts = (slug: string) => pairFacts(parsePairSlug(slug)!);

describe('pairFacts', () => {
	it('says something for every conversion the site offers', () => {
		for (const slug of allPairSlugs()) {
			const lines = pairFacts(parsePairSlug(slug)!);
			expect(lines.length, slug).toBeGreaterThanOrEqual(2);
			for (const line of lines) expect(line.trim(), slug).not.toBe('');
		}
	});

	it('warns about losing transparency, but only when there is some to lose', () => {
		expect(facts('png-to-jpg').join(' ')).toContain('cannot store transparency');
		// a JPG has no transparency to begin with, so the warning would be noise
		expect(facts('jpg-to-png').join(' ')).not.toContain('cannot store transparency');
	});

	it('explains the on-or-off transparency of GIF', () => {
		expect(facts('png-to-gif').join(' ')).toContain('on or off');
	});

	it('is honest that lossless cannot undo lossy', () => {
		expect(facts('jpg-to-png').join(' ')).toContain('cannot bring back detail');
		expect(facts('png-to-jpg').join(' ')).toContain('throws some detail away');
	});

	it('gets the direction of the file size right', () => {
		expect(facts('png-to-webp').join(' ')).toContain('smaller');
		expect(facts('webp-to-bmp').join(' ')).toContain('bigger');
	});

	it('gives different pairs genuinely different text', () => {
		const a = facts('heic-to-jpg').join(' ');
		const b = facts('png-to-webp').join(' ');
		const c = facts('svg-to-png').join(' ');
		expect(a).not.toBe(b);
		expect(b).not.toBe(c);
		// and the opening sentence, the one most likely to be quoted, is unique
		expect(facts('heic-to-jpg')[0]).not.toBe(facts('png-to-jpg')[0]);
	});

	it('reads the same for an alias spelling, since it is the same conversion', () => {
		expect(facts('heif-to-jpeg').length).toBe(facts('heic-to-jpg').length);
	});
});

describe('how many conversions there really are', () => {
	it('counts pages, not spellings', () => {
		// The hub copy once said 93 because it had counted the alias spellings
		// as separate conversions. They are 301s now, so the number a visitor
		// is told has to be the number of pages that exist.
		const encodable = allPairSlugs().filter((slug) => {
			const page = parsePairSlug(slug)!;
			return page.slug === page.canonicalSlug;
		});
		expect(encodable.length).toBe(63);
		expect(allPairSlugs().length).toBe(94); // 63 plus 31 alias spellings
	});
});

describe('spellingNote', () => {
	it('names the other spelling for the three formats that have one', () => {
		expect(spellingNote(FORMATS.jpg)).toContain('JPG and JPEG are the same format');
		expect(spellingNote(FORMATS.heic)).toContain('HEIC and HEIF are the same format');
		expect(spellingNote(FORMATS.tiff)).toContain('TIFF and TIF are the same format');
	});

	it('says nothing about formats with only one spelling', () => {
		for (const id of ['png', 'webp', 'avif', 'gif', 'bmp', 'ico', 'svg'] as const) {
			expect(spellingNote(FORMATS[id]), id).toBeNull();
		}
	});

	it('keeps the copy style', () => {
		for (const format of Object.values(FORMATS)) {
			const note = spellingNote(format);
			if (!note) continue;
			expect(note).not.toContain('—');
			expect(note).not.toContain(';');
		}
	});
});
