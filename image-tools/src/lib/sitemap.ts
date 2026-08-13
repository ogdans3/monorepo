import { allPairSlugs } from './engine';
import { TOOLS, toolPath } from './tools/registry';
import { PRESETS, presetPath } from './tools/presets';
import { convertPath } from './site';

/**
 * Every indexable path on the site, in sitemap order. Derived from the format
 * and tool registries, so a new format or tool appears here on its own.
 */
export function sitemapPaths(): string[] {
	return [
		'/',
		'/convert',
		'/tools',
		'/pdf',
		'/make',
		'/privacy',
		'/terms',
		...TOOLS.map((tool) => toolPath(tool)),
		...PRESETS.map((preset) => presetPath(preset)),
		...allPairSlugs().map((slug) => convertPath(slug))
	];
}
