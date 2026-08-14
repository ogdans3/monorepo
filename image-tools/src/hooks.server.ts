import { redirect, type Handle } from '@sveltejs/kit';
import { parsePairSlug } from '$lib/engine';
import { PDF_TOOLS } from '$lib/tools/registry';

// The first three tools shipped at the root before /tools/ existed.
const MOVED: Record<string, string> = {
	'/crop-image': '/tools/crop-image',
	'/transparent-background': '/tools/transparent-background',
	'/combine-images': '/tools/combine-images'
};

// PDF tools were under /tools before they earned their own section.
const PDF_SLUGS = new Set(PDF_TOOLS.map((t) => t.slug));

export const handle: Handle = ({ event, resolve }) => {
	const path = event.url.pathname;

	const target = MOVED[path];
	if (target) redirect(301, target);

	if (path.startsWith('/tools/')) {
		const slug = path.slice('/tools/'.length);
		if (PDF_SLUGS.has(slug)) redirect(301, `/pdf/${slug}`);
	}

	// The alias spellings (png-to-jpeg, heif-to-jpg, tif-to-png) used to be
	// pages of their own that pointed rel=canonical at the primary spelling.
	// Google was always going to index the primary one anyway, so they were 31
	// near-copies earning nothing, and once they left the sitemap nothing linked
	// to them at all. A redirect does the same job with none of the ambiguity.
	// The primary page now says in its own words that the spellings are
	// interchangeable, which is what covers the query.
	if (path.startsWith('/convert/')) {
		const page = parsePairSlug(path.slice('/convert/'.length));
		if (page && page.slug !== page.canonicalSlug) {
			redirect(301, `/convert/${page.canonicalSlug}`);
		}
	}

	// Conversion pages lived at the root before /convert/ existed. Any valid
	// pair slug redirects to its new home, resolved to the canonical spelling
	// in one hop rather than bouncing through the alias rule above.
	const rootSlug = path.slice(1);
	if (!rootSlug.includes('/')) {
		const page = parsePairSlug(rootSlug);
		if (page) redirect(301, `/convert/${page.canonicalSlug}`);
	}

	return resolve(event);
};
