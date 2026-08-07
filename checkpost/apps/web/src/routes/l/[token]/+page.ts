import { error } from '@sveltejs/kit';
import { SHARE_TOKEN_PATTERN, shareDeepLink } from '@checkpost/contract';
import type { PageLoad } from './$types';

/**
 * Rendered in the browser only.
 *
 * The list is fetched with the share token from the address bar, and that
 * request goes straight from the browser to the API. This server never holds a
 * copy of anyone's checklist and never sees a response, which is the whole
 * reason the page is client-rendered rather than server-rendered.
 *
 * The token still arrives here in the URL path, which is the one leak the app
 * cannot close. See the README for what is done about it.
 */
export const ssr = false;

export const load: PageLoad = ({ params, url }) => {
  if (!SHARE_TOKEN_PATTERN.test(params.token)) {
    error(404, 'That does not look like a Checkpost link.');
  }
  return {
    token: params.token,
    deepLink: shareDeepLink(params.token),
    shareUrl: `${url.origin}/l/${params.token}`,
  };
};
