import { describe, expect, it } from 'vitest';
import { allPairSlugs, allPairs, parsePairSlug, resolveFormat, SOURCES, TARGETS } from './formats';

describe('registry', () => {
	it('resolves ids, aliases and extensions', () => {
		expect(resolveFormat('jpg')?.id).toBe('jpg');
		expect(resolveFormat('jpeg')?.id).toBe('jpg');
		expect(resolveFormat('.JPEG')?.id).toBe('jpg');
		expect(resolveFormat('heif')?.id).toBe('heic');
		expect(resolveFormat('tif')?.id).toBe('tiff');
		expect(resolveFormat('exr')).toBeUndefined();
	});

	it('never offers un-encodable targets', () => {
		const targetIds = TARGETS.map((f) => f.id);
		expect(targetIds).not.toContain('heic');
		expect(targetIds).not.toContain('svg');
		expect(targetIds).not.toContain('tiff');
	});
});

describe('pairs and slugs', () => {
	it('builds the full canonical matrix without identity pairs', () => {
		const pairs = allPairs();
		expect(pairs.length).toBe(SOURCES.length * TARGETS.length - TARGETS.length);
		expect(pairs.some((p) => p.source.id === p.target.id)).toBe(false);
		expect(pairs.map((p) => p.slug)).toContain('heic-to-jpg');
		expect(pairs.map((p) => p.slug)).toContain('png-to-webp');
	});

	it('every generated slug parses back', () => {
		for (const slug of allPairSlugs()) {
			expect(parsePairSlug(slug), slug).not.toBeNull();
		}
	});

	it('includes alias spellings as their own pages', () => {
		const slugs = allPairSlugs();
		expect(slugs).toContain('heif-to-jpeg');
		expect(slugs).toContain('jpeg-to-png');
		expect(slugs).toContain('tif-to-png');
		expect(slugs).not.toContain('png-to-png');
		expect(slugs).not.toContain('jpeg-to-jpg'); // same codec, not a conversion
		expect(slugs).not.toContain('png-to-heic'); // HEIC can't be encoded
	});

	it('parses alias slugs with page-specific naming and canonical link', () => {
		const page = parsePairSlug('heif-to-jpeg');
		expect(page?.source.id).toBe('heic');
		expect(page?.target.id).toBe('jpg');
		expect(page?.sourceName).toBe('HEIF');
		expect(page?.targetName).toBe('JPEG');
		expect(page?.canonicalSlug).toBe('heic-to-jpg');
		expect(page?.targetExt).toBe('.jpeg');
	});

	it('rejects nonsense slugs', () => {
		expect(parsePairSlug('about')).toBeNull();
		expect(parsePairSlug('png-to-png')).toBeNull();
		expect(parsePairSlug('png-to-heic')).toBeNull();
		expect(parsePairSlug('exr-to-png')).toBeNull();
		expect(parsePairSlug('-to-png')).toBeNull();
		expect(parsePairSlug('png-to-')).toBeNull();
		// extensions resolve as formats, but they are not page slugs
		expect(parsePairSlug('png-to-jpg.jpg')).toBeNull();
	});
});
