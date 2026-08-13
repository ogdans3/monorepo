import { SITE_URL } from '$lib/site';
import { sitemapPaths } from '$lib/sitemap';

export const prerender = true;

export function GET() {
	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		sitemapPaths()
			.map((path) => `\t<url><loc>${SITE_URL}${path}</loc></url>`)
			.join('\n') +
		`\n</urlset>\n`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
