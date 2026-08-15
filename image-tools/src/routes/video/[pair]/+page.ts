import { error } from '@sveltejs/kit';
import { allVideoPairs, parseVideoSlug, relatedVideoPairs } from '$lib/video/formats';
import type { EntryGenerator, PageLoad } from './$types';

/**
 * One page per conversion, primary spelling only. Alias spellings are 301s in
 * hooks.server.ts, the same as the image section, so no two URLs ever hold the
 * same page.
 */
export const entries: EntryGenerator = () => allVideoPairs().map((pair) => ({ pair: pair.slug }));

export const load: PageLoad = ({ params }) => {
	const page = parseVideoSlug(params.pair);
	if (!page) error(404, 'No such video conversion');
	return { page, related: relatedVideoPairs(page) };
};
