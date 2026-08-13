import { error } from '@sveltejs/kit';
import { PRESETS, presetBySlug } from '$lib/tools/presets';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => PRESETS.map((p) => ({ preset: p.slug }));

export const load: PageLoad = ({ params }) => {
	const preset = presetBySlug(params.preset);
	if (!preset) error(404, 'No such preset');
	return { preset };
};
