import { describe, expect, it } from 'vitest';
import {
	CATEGORIES,
	IMAGE_TOOLS,
	PDF_TOOLS,
	TOOLS,
	nextTools,
	toolBySlug,
	toolMatches,
	toolPath,
	toolsInCategory
} from './registry';
import { parsePairSlug } from '$lib/engine';

describe('tools registry', () => {
	it('sorts every tool into a defined category, and none is lonely', () => {
		const ids = CATEGORIES.map((c) => c.id);
		for (const t of TOOLS) expect(ids, t.slug).toContain(t.category);
		for (const id of ids) {
			// a category with one tool is just a heading with a line under it
			expect(toolsInCategory(id).length, id).toBeGreaterThan(1);
		}
	});

	it('routes PDF tools to /pdf and the rest to /tools', () => {
		expect(IMAGE_TOOLS.length + PDF_TOOLS.length).toBe(TOOLS.length);
		for (const t of PDF_TOOLS) expect(toolPath(t)).toBe(`/pdf/${t.slug}`);
		for (const t of IMAGE_TOOLS) expect(toolPath(t)).toBe(`/tools/${t.slug}`);
	});

	it('every next step points at a tool that exists, and never at itself', () => {
		for (const t of TOOLS) {
			expect(nextTools(t).length, `${t.slug} has resolvable next steps`).toBe(
				(t.next ?? []).length
			);
			expect(t.next ?? [], t.slug).not.toContain(t.slug);
		}
	});

	it('search finds tools by plain words people actually use', () => {
		const find = (q: string) => TOOLS.filter((t) => toolMatches(t, q)).map((t) => t.slug);
		expect(find('mirror')).toContain('flip-image');
		expect(find('metadata')).toContain('remove-exif');
		expect(find('black and white')).toContain('grayscale-image');
		expect(find('remove background')).toContain('transparent-background');
		expect(find('combine pdf')).toContain('merge-pdf');
		// every word must match, so two words narrow the list
		expect(find('pdf page').every((s) => s.includes('pdf'))).toBe(true);
		expect(find('')).toHaveLength(TOOLS.length);
		expect(find('zzzz')).toHaveLength(0);
	});

	it('has unique, kebab-case slugs that never collide with pair pages', () => {
		const slugs = TOOLS.map((t) => t.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const slug of slugs) {
			expect(slug).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
			expect(parsePairSlug(slug), slug).toBeNull();
		}
	});

	it('keeps titles and descriptions inside sensible SEO lengths', () => {
		for (const t of TOOLS) {
			expect(t.title.length, t.slug).toBeLessThanOrEqual(60);
			expect(t.description.length, t.slug).toBeGreaterThanOrEqual(100);
			expect(t.description.length, t.slug).toBeLessThanOrEqual(165);
			expect(t.steps.length).toBeGreaterThanOrEqual(3);
			expect(t.about.length).toBeGreaterThanOrEqual(2);
		}
	});

	it('respects the copy style: no em dashes, no semicolons', () => {
		for (const t of TOOLS) {
			const copy = [t.h1, t.title, t.description, t.lede, t.blurb, ...t.steps, ...t.about].join(' ');
			expect(copy, t.slug).not.toContain('—');
			expect(copy, t.slug).not.toContain(';');
		}
	});

	it('resolves by slug', () => {
		expect(toolBySlug('crop-image')?.name).toBe('Crop');
		expect(toolBySlug('nope')).toBeUndefined();
	});
});
