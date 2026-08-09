import { describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS, toolBySlug, toolPath, toolsInCategory } from './registry';
import { parsePairSlug } from '$lib/engine';

describe('tools registry', () => {
	it('sorts every tool into a defined category, and none stays empty', () => {
		const ids = CATEGORIES.map((c) => c.id);
		for (const t of TOOLS) expect(ids, t.slug).toContain(t.category);
		for (const id of ids) expect(toolsInCategory(id).length, id).toBeGreaterThan(0);
	});

	it('builds /tools/ paths', () => {
		expect(toolPath(TOOLS[0])).toBe(`/tools/${TOOLS[0].slug}`);
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
