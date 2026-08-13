import { allPairSlugs } from './engine';
import { TOOLS, toolPath } from './tools/registry';
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
		'/privacy',
		'/terms',
		...TOOLS.map((tool) => toolPath(tool)),
		...allPairSlugs().map((slug) => convertPath(slug))
	];
}
