/** The product name. The monorepo folder and dashboard slug stay image-tools. */
export const SITE_NAME = 'imagetoolbox';

/** Canonicals, OG URLs and the sitemap all build on this. */
export const SITE_URL = 'https://imagetoolbox.org';

/** Conversion pages live under /convert, mirroring /tools. */
export function convertPath(slug: string): string {
	return `/convert/${slug}`;
}
