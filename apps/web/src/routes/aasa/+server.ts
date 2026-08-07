import association from '$lib/apple-app-site-association.json';
import type { RequestHandler } from './$types';

/**
 * Served at `/.well-known/apple-app-site-association` (see `src/hooks.ts`).
 *
 * iOS fetches this through Apple's CDN and insists on `application/json` with
 * no extension in the path. Get either wrong and Universal Links silently never
 * work. There is no error. Links just keep opening the browser.
 */
export const GET: RequestHandler = () =>
  new Response(JSON.stringify(association), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });

// Not prerendered: a prerendered page is written to disk under `/aasa` and
// served by the static handler, which the reroute never reaches. Rendering a
// 200-byte constant on demand costs nothing and actually works.
export const prerender = false;
