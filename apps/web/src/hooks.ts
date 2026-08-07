import type { Reroute } from '@sveltejs/kit';

/**
 * `apple-app-site-association` has to live at that exact extensionless path and
 * be served as `application/json`. A static file cannot do both: the static
 * handler has no extension to infer a type from, and SvelteKit's router ignores
 * directories beginning with a dot, so it cannot be a route either.
 *
 * Rerouting it to a real endpoint solves both at once.
 */
export const reroute: Reroute = ({ url }) =>
  url.pathname === '/.well-known/apple-app-site-association' ? '/aasa' : undefined;
