/**
 * What every response is allowed to be cached for.
 *
 * Two classes, and every URL on the site falls into one of them.
 *
 * A URL that changes whenever its bytes change can be held forever, because
 * there is no such thing as a stale copy of it: a new build means a new URL.
 * Vite hashes everything under `/_app/immutable/`, and the ffmpeg core carries
 * its version in the path for the same reason.
 *
 * Everything else is `no-cache`, which does not mean "do not store". It means
 * "ask before you use it", and since the server already sends an ETag, almost
 * every one of those questions is answered with a 304 and no body. That is the
 * whole trick: a deploy is live for everyone the moment it is deployed, and it
 * still costs one small request rather than a re-download.
 *
 * The alternative, which is what this site did before, is to send no
 * `cache-control` at all and let the browser apply heuristic freshness. That
 * silently reuses a page for a fraction of its age with no request at all, so
 * the older a deployment gets the longer visitors keep seeing the last one.
 */

/** A year, the longest anything is worth asking for. */
export const IMMUTABLE_MAX_AGE = 31_536_000;

/**
 * URLs whose content cannot change without the URL changing with it.
 * The ffmpeg pattern needs the version segment, so a stray file left directly
 * in `/ffmpeg/` by an older build is never treated as fingerprinted.
 */
const FINGERPRINTED = [/^\/_app\/immutable\//, /^\/ffmpeg\/[^/]+\//];

/**
 * @param {string} url a request URL or path, query string and all
 * @returns {string} the `cache-control` value it should be served with
 */
export function cacheControlFor(url) {
	const path = url.split('?')[0].split('#')[0];
	if (FINGERPRINTED.some((pattern) => pattern.test(path))) {
		return `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`;
	}
	return 'no-cache';
}
