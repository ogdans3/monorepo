import { error } from '@sveltejs/kit';
import { allPairSlugs, parsePairSlug, relatedPairs } from '$lib/engine';
import type { EntryGenerator, PageLoad } from './$types';

/** Prerender every conversion page, alias spellings included. */
export const entries: EntryGenerator = () => allPairSlugs().map((pair) => ({ pair }));

export const load: PageLoad = ({ params }) => {
	const page = parsePairSlug(params.pair);
	if (!page) error(404, 'No such conversion');
	return { page, related: relatedPairs(page) };
};
