import { allPairSlugs } from '$lib/engine';
import { TOOLS, toolPath } from '$lib/tools/registry';
import { SITE_URL } from '$lib/site';

export const prerender = true;

export function GET() {
	const urls = [
		'/',
		'/tools',
		...TOOLS.map((tool) => toolPath(tool)),
		...allPairSlugs().map((slug) => `/${slug}`)
	];
	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls.map((u) => `\t<url><loc>${SITE_URL}${u}</loc></url>`).join('\n') +
		`\n</urlset>\n`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
