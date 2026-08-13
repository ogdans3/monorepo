import { describe, expect, it } from 'vitest';
import { sitemapPaths } from './sitemap';
import { TOOLS, toolPath } from './tools/registry';
import { PRESETS } from './tools/presets';
import { allPairSlugs } from './engine';

describe('sitemapPaths', () => {
	const paths = sitemapPaths();

	it('lists every tool, preset and conversion, plus the fixed pages', () => {
		expect(paths.length).toBe(7 + TOOLS.length + PRESETS.length + allPairSlugs().length);
		for (const tool of TOOLS) expect(paths).toContain(toolPath(tool));
		for (const preset of PRESETS) expect(paths).toContain(`/make/${preset.slug}`);
		expect(paths).toContain('/convert/heic-to-jpg');
		expect(paths).toContain('/convert/heif-to-jpeg'); // alias spellings too
		for (const fixed of ['/', '/convert', '/tools', '/pdf', '/make', '/privacy', '/terms']) {
			expect(paths).toContain(fixed);
		}
	});

	it('puts PDF tools under /pdf and never under /tools', () => {
		const pdfPaths = paths.filter((p) => p.startsWith('/pdf/'));
		expect(pdfPaths.length).toBeGreaterThan(8);
		expect(paths.filter((p) => p.startsWith('/tools/') && p.includes('pdf'))).toEqual([]);
	});

	it('has no duplicates and every path is root-relative', () => {
		expect(new Set(paths).size).toBe(paths.length);
		for (const path of paths) {
			expect(path.startsWith('/'), path).toBe(true);
			expect(path).not.toContain('//');
			expect(path.trim()).toBe(path);
		}
	});

	it('never lists a conversion at the old root level', () => {
		// those URLs 301 to /convert/… and a sitemap must only hold final URLs.
		// tool slugs like /tools/image-to-pdf also read as "x-to-y", so match
		// the root-level shape rather than the words.
		expect(paths).not.toContain('/heic-to-jpg');
		const rootLevelPair = /^\/[a-z0-9]+-to-[a-z0-9]+$/;
		expect(paths.filter((p) => rootLevelPair.test(p))).toEqual([]);
	});
});
