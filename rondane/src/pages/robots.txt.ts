import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => new Response(`User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap-index.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
