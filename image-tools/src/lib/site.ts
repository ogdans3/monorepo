/** The product name. The monorepo folder and dashboard slug stay image-tools. */
export const SITE_NAME = 'imagetoolbox';

/** Canonicals, OG URLs and the sitemap all build on this. */
export const SITE_URL = 'https://imagetoolbox.org';

/**
 * The date the page copy last really changed, as the sitemap's lastmod.
 *
 * Deliberately a hand-set constant rather than the build date. Search engines
 * only lean on lastmod while it stays honest, and stamping every page with
 * "today" on a build that only moved a border colour is how it stops being
 * honest. Bump this when the words on the pages change, which for a
 * registry-driven site means edits to the format table, pairfacts, the tool
 * registry or the presets. Leave it alone for styling and plumbing.
 */
export const CONTENT_UPDATED = '2026-08-13';

/** Conversion pages live under /convert, mirroring /tools. */
export function convertPath(slug: string): string {
	return `/convert/${slug}`;
}
