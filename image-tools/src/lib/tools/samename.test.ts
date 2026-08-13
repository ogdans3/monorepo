import { describe, expect, it } from 'vitest';
import { SAME_NAME_PAGES, sameNameBySlug } from './samename';
import { parsePairSlug } from '$lib/engine';
import { sitemapPaths } from '$lib/sitemap';

describe('same name pages', () => {
	it('covers the two spellings people search for', () => {
		expect(SAME_NAME_PAGES.map((p) => p.slug)).toEqual(['jpeg-to-jpg', 'jpg-to-jpeg']);
		expect(sameNameBySlug('jpeg-to-jpg')?.ext).toBe('.jpg');
		expect(sameNameBySlug('jpg-to-jpeg')?.ext).toBe('.jpeg');
		expect(sameNameBySlug('png-to-jpg')).toBeUndefined();
	});

	it('takes slugs the pair route will never claim', () => {
		// same format both sides, so parsePairSlug refuses them. That is why
		// they need routes of their own rather than a row in the format table.
		for (const page of SAME_NAME_PAGES) {
			expect(parsePairSlug(page.slug), page.slug).toBeNull();
			expect(sitemapPaths()).toContain(`/convert/${page.slug}`);
		}
	});

	it('says plainly that the two are the same format', () => {
		for (const page of SAME_NAME_PAGES) {
			const copy = [
				page.title,
				page.description,
				page.lede,
				...page.about,
				...page.faq.flatMap((f) => [f.q, f.a])
			].join(' ');
			expect(copy, page.slug).not.toContain('—');
			expect(copy, page.slug).not.toContain(';');
			expect(page.title.length, page.slug).toBeLessThanOrEqual(60);
			expect(page.description.length, page.slug).toBeGreaterThanOrEqual(100);
			expect(page.description.length, page.slug).toBeLessThanOrEqual(165);
			expect(/same format/i.test(copy), page.slug).toBe(true);
			expect(page.faq.length, page.slug).toBeGreaterThanOrEqual(3);
		}
	});
});
