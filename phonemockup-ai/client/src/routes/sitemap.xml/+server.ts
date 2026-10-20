import { SITE, guidePath, guides, hubs } from "$lib/guides/guides";
import type { RequestHandler } from "./$types";

// The pages worth indexing. The studio (/platform/*) renders in the browser
// only, so it isn't listed.
export const GET: RequestHandler = () => {
  const paths = [
    "/",
    ...hubs.map((hub) => `/${hub.section}`),
    ...guides.map(guidePath),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${SITE}${path}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
