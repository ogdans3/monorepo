import { SITE_URL } from '$lib/site';

// A route rather than a static file so the sitemap line and the canonical
// domain come from one place. Prerendered, so it is a plain file in the build.
export const prerender = true;

export function GET() {
	const body = [
		'# Every page here is public, free and safe to index.',
		'# AI crawlers are welcome too: being quoted is the point.',
		'User-agent: *',
		'Allow: /',
		'# /t is the analytics relay, not a page.',
		'Disallow: /t/',
		'',
		`Sitemap: ${SITE_URL}/sitemap.xml`,
		''
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}
