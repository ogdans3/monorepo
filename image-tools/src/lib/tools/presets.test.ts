import { describe, expect, it } from 'vitest';
import { PRESETS, PRESET_GROUPS, presetBySlug, presetPath, presetsInGroup } from './presets';
import { TOOLS } from './registry';
import { parsePairSlug } from '$lib/engine';

describe('presets', () => {
	it('every preset carries a real setting, so no page is a doorway', () => {
		// this is the line between useful programmatic pages and spam: each one
		// has to arrive with the tool already configured for it
		for (const p of PRESETS) {
			if (p.kind === 'compress') {
				expect(p.bytes, p.slug).toBeGreaterThan(0);
			} else {
				expect(p.width, p.slug).toBeGreaterThan(0);
				expect(p.height, p.slug).toBeGreaterThan(0);
			}
		}
	});

	it('has unique slugs that clash with nothing else on the site', () => {
		const slugs = PRESETS.map((p) => p.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		const toolSlugs = new Set(TOOLS.map((t) => t.slug));
		for (const slug of slugs) {
			expect(slug, slug).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
			expect(toolSlugs.has(slug), slug).toBe(false);
			expect(parsePairSlug(slug), slug).toBeNull();
		}
	});

	it('keeps titles and descriptions inside sensible SEO lengths', () => {
		for (const p of PRESETS) {
			expect(p.title.length, p.slug).toBeLessThanOrEqual(60);
			expect(p.description.length, p.slug).toBeGreaterThanOrEqual(90);
			expect(p.description.length, p.slug).toBeLessThanOrEqual(165);
			expect(p.about.length, p.slug).toBeGreaterThanOrEqual(2);
		}
	});

	it('gives every preset its own words rather than one template', () => {
		const openings = PRESETS.map((p) => p.about[0]);
		expect(new Set(openings).size).toBe(openings.length);
		const ledes = PRESETS.map((p) => p.lede);
		expect(new Set(ledes).size).toBe(ledes.length);
	});

	it('respects the copy style: no em dashes, no semicolons', () => {
		for (const p of PRESETS) {
			const copy = [p.h1, p.title, p.description, p.lede, p.blurb, ...p.about].join(' ');
			expect(copy, p.slug).not.toContain('—');
			expect(copy, p.slug).not.toContain(';');
		}
	});

	it('sorts every preset into a group, and none is empty', () => {
		const ids = PRESET_GROUPS.map((g) => g.id);
		for (const p of PRESETS) expect(ids, p.slug).toContain(p.group);
		for (const id of ids) expect(presetsInGroup(id).length, id).toBeGreaterThan(1);
	});

	it('resolves by slug and builds /make paths', () => {
		expect(presetBySlug('compress-image-to-200kb')?.bytes).toBe(200 * 1024);
		expect(presetBySlug('youtube-thumbnail-size')?.width).toBe(1280);
		expect(presetPath(PRESETS[0])).toBe(`/make/${PRESETS[0].slug}`);
		expect(presetBySlug('nope')).toBeUndefined();
	});

	it('names the size in the title, since that is what people type', () => {
		for (const p of PRESETS) {
			if (p.kind === 'compress') continue;
			expect(p.title, p.slug).toContain(`${p.width}x${p.height}`);
		}
	});
});
