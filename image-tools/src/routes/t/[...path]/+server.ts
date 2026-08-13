import type { RequestHandler } from './$types';

/**
 * First-party reverse proxy for PostHog, so content blockers do not silently
 * delete our analytics. Blocklists match hostnames, and this rides on the
 * site's own origin, so blocking it means blocking the site.
 *
 * A live passthrough, so never prerendered.
 */
export const prerender = false;

/**
 * PostHog posts to paths that end in a slash, like /i/v0/e/. Without this the
 * router answers every event with a 308 to the slashless path, doubling each
 * request for no reason.
 */
export const trailingSlash = 'ignore';

const API_UPSTREAM = 'https://eu.i.posthog.com';
const ASSET_UPSTREAM = 'https://eu-assets.i.posthog.com';

/** Static bundles and the remote config come from the assets host. */
function upstreamFor(path: string): string {
	return path.startsWith('static/') || path.startsWith('array/') ? ASSET_UPSTREAM : API_UPSTREAM;
}

const handle: RequestHandler = async ({ request, params, url, getClientAddress }) => {
	const path = params.path ?? '';
	const target = `${upstreamFor(path)}/${path}${url.search}`;

	const headers = new Headers();
	// In cookieless mode PostHog counts unique visitors by hashing the
	// visitor's IP and user agent server-side. Both have to survive this hop,
	// or every visitor would hash to this server and collapse into one person.
	const forwardedFor = request.headers.get('x-forwarded-for');
	headers.set('x-forwarded-for', forwardedFor ?? getClientAddress());
	for (const name of ['user-agent', 'content-type', 'accept-language', 'referer']) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}

	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetch(target, {
			method: request.method,
			headers,
			body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer()
		});
	} catch {
		// Analytics is never worth an error in the visitor's console.
		return new Response(null, { status: 204 });
	}

	// Rebuild the response with only the headers a browser needs. Passing
	// content-encoding through would lie, since fetch already decompressed it.
	const outHeaders = new Headers();
	for (const name of ['content-type', 'cache-control']) {
		const value = upstreamResponse.headers.get(name);
		if (value) outHeaders.set(name, value);
	}
	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		headers: outHeaders
	});
};

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
