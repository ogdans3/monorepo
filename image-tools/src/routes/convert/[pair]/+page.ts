import { error } from '@sveltejs/kit';
import { allPairs, parsePairSlug, relatedPairs } from '$lib/engine';
import type { EntryGenerator, PageLoad } from './$types';

/**
 * One page per conversion, in the primary spelling only. The alias spellings
 * are 301s in hooks.server.ts rather than pages, because a page that points
 * rel=canonical somewhere else was never going to be the one Google indexed.
 */
export const entries: EntryGenerator = () => allPairs().map((pair) => ({ pair: pair.slug }));

export const load: PageLoad = ({ params }) => {
	const page = parsePairSlug(params.pair);
	if (!page) error(404, 'No such conversion');
	return { page, related: relatedPairs(page) };
};
