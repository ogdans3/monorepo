import type { Handle } from '@sveltejs/kit';

/**
 * A share link in a log line is a leaked list, and this server is the one
 * place a token travels in a URL path. Nothing here writes the path anywhere,
 * and these headers stop it leaking sideways: out through a `Referer` to a
 * store, or into a shared cache.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  if (event.url.pathname.startsWith('/l/')) {
    response.headers.set('Cache-Control', 'no-store, private');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  // The index of saved lists is built in the browser and this server renders
  // nothing for it, so there is no secret in the response. It is still nobody
  // else's page, and a crawler following it would only find an empty shell.
  if (event.url.pathname === '/lists') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
};
