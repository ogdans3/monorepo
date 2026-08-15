/** The product name. The monorepo folder and dashboard slug stay image-tools. */
export const SITE_NAME = 'imagetoolbox';

/** Canonicals, OG URLs and the sitemap all build on this. */
export const SITE_URL = 'https://imagetoolbox.org';

/**
 * Who is behind the site, in one place so the privacy policy, the terms, the
 * footer and the structured data can never drift apart.
 *
 * This is the data controller under the GDPR, and article 13(1)(a) wants an
 * identity rather than a vague gesture at a country. The Norwegian
 * ehandelslov wants the same from any service provider: legal name, a real
 * geographic address, the organisation number and a way to reach a person.
 * All of it is already public in Enhetsregisteret, which is where these
 * values came from.
 */
export const OPERATOR = {
	name: 'Teorimester AS',
	/** As registered in Enhetsregisteret. */
	orgNumber: '930 860 301',
	street: 'Bueråsen 4',
	postalCode: '3234',
	city: 'Sandefjord',
	country: 'Norway',
	email: 'hello@imagetoolbox.org'
} as const;

/** One line, for the footer and anywhere else a full address would be noise. */
export const OPERATOR_LINE = `${OPERATOR.name}, org. no. ${OPERATOR.orgNumber}, ${OPERATOR.city}, ${OPERATOR.country}`;

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
