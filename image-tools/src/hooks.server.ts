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

	// Conversion pages lived at the root before /convert/ existed. Any valid
	// pair slug, alias spellings included, redirects to its new home.
	const rootSlug = path.slice(1);
	if (!rootSlug.includes('/') && parsePairSlug(rootSlug)) redirect(301, `/convert/${rootSlug}`);

	return resolve(event);
};
