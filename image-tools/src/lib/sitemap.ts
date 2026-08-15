import { allPairs } from './engine';
import { TOOLS, toolPath } from './tools/registry';
import { PRESETS, presetPath } from './tools/presets';
import { SAME_NAME_PAGES } from './tools/samename';
import { allVideoPairs, videoPath } from './video/formats';
import { convertPath } from './site';

/**
 * Every indexable path on the site, in sitemap order. Derived from the format
 * and tool registries, so a new format or tool appears here on its own.
 *
 * Canonical URLs only. The alias spellings (/convert/png-to-jpeg and the
 * heif and tif pages) still exist and still rank, but each one points its
 * rel=canonical at the primary spelling. Listing a page here is a hint that
 * it is the canonical version, so including both spellings would have us
 * arguing with ourselves about which URL to index.
 */
export function sitemapPaths(): string[] {
	return [
		'/',
		'/convert',
		'/tools',
		'/pdf',
		'/video',
		'/make',
		'/feedback',
		'/privacy',
		'/terms',
		...TOOLS.map((tool) => toolPath(tool)),
		...PRESETS.map((preset) => presetPath(preset)),
		...allPairs().map((pair) => convertPath(pair.slug)),
		...SAME_NAME_PAGES.map((page) => convertPath(page.slug)),
		...allVideoPairs().map((pair) => videoPath(pair.slug))
	];
}
