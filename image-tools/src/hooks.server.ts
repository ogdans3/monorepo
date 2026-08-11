import { redirect, type Handle } from '@sveltejs/kit';
import { parsePairSlug } from '$lib/engine';

// The first three tools shipped at the root before /tools/ existed.
const MOVED: Record<string, string> = {
	'/crop-image': '/tools/crop-image',
	'/transparent-background': '/tools/transparent-background',
	'/combine-images': '/tools/combine-images'
};

export const handle: Handle = ({ event, resolve }) => {
	const path = event.url.pathname;

	const target = MOVED[path];
	if (target) redirect(301, target);

	// Conversion pages lived at the root before /convert/ existed. Any valid
	// pair slug, alias spellings included, redirects to its new home.
	const slug = path.slice(1);
	if (!slug.includes('/') && parsePairSlug(slug)) redirect(301, `/convert/${slug}`);

	return resolve(event);
};
