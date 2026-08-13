import { describe, expect, it } from 'vitest';
import { pairFaq } from './pairfaq';
import { allPairs, parsePairSlug } from './formats';

const faqFor = (slug: string) => pairFaq(parsePairSlug(slug)!);
const questions = (slug: string) => faqFor(slug).map((f) => f.q);

describe('pairFaq', () => {
	it('gives every conversion three questions', () => {
		for (const pair of allPairs()) {
			const items = pairFaq(parsePairSlug(pair.slug)!);
			expect(items.length, pair.slug).toBe(3);
			for (const { q, a } of items) {
				expect(q.endsWith('?'), `${pair.slug}: ${q}`).toBe(true);
				expect(a.length, `${pair.slug}: ${q}`).toBeGreaterThan(140);
				expect(a, pair.slug).not.toContain('—');
				expect(a, pair.slug).not.toContain(';');
			}
		}
	});

	it('names the formats of the page it is on', () => {
		for (const q of questions('heic-to-jpg')) expect(q).not.toContain('PNG');
		expect(questions('png-to-jpg').join(' ')).toContain('PNG to JPG');
		// alias spellings are the words in the URL, so the copy has to follow
		expect(questions('png-to-jpeg').join(' ')).toContain('JPEG');
	});

	it('answers the quality question according to the two formats', () => {
		const answer = (slug: string) =>
			faqFor(slug).find((f) => /lose quality|improve quality/.test(f.q))!.a;
		// lossless to lossy: yes, a little
		expect(answer('png-to-jpg')).toContain('throwing away detail');
		// lossy to lossless: no, and it cannot repair anything either
		expect(answer('jpg-to-png')).toContain('nothing can bring it back');
		// lossless to lossless: nothing changes at all
		expect(answer('png-to-bmp')).toContain('identical to the one that went in');
	});

	it('only raises transparency where something is really at stake', () => {
		const asks = (slug: string) => questions(slug).some((q) => /transparen/i.test(q));
		expect(asks('png-to-jpg')).toBe(true); // full alpha into a format with none
		expect(asks('png-to-gif')).toBe(true); // full alpha into on or off
		expect(asks('jpg-to-png')).toBe(false); // a JPG never had any to lose
	});

	it('leads with the hand written question where there is one', () => {
		expect(questions('heic-to-jpg')[0]).toBe('Why will Windows not open my HEIC photos?');
		expect(questions('bmp-to-webp')[0]).toMatch(/^Does converting/);
	});

	it('says which way the file size goes', () => {
		const sizeAnswer = (slug: string) => faqFor(slug).find((f) => /smaller than/.test(f.q))?.a;
		expect(sizeAnswer('bmp-to-webp')).toContain('much smaller');
		expect(sizeAnswer('webp-to-bmp')).toContain('good deal bigger');
	});

	it('never asks the same question twice on one page', () => {
		for (const pair of allPairs()) {
			const qs = pairFaq(parsePairSlug(pair.slug)!).map((f) => f.q);
			expect(new Set(qs).size, pair.slug).toBe(qs.length);
		}
	});
});
