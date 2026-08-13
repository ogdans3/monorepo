import { describe, expect, it } from 'vitest';
import { pairFacts } from './pairfacts';
import { allPairSlugs, parsePairSlug } from './formats';

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
