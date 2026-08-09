import { redirect, type Handle } from '@sveltejs/kit';

// The first three tools shipped at the root before /tools/ existed.
const MOVED: Record<string, string> = {
	'/crop-image': '/tools/crop-image',
	'/transparent-background': '/tools/transparent-background',
	'/combine-images': '/tools/combine-images'
};

export const handle: Handle = ({ event, resolve }) => {
	const target = MOVED[event.url.pathname];
	if (target) redirect(301, target);
	return resolve(event);
};
