import { error } from '@sveltejs/kit';
import { SHARE_TOKEN_PATTERN, shareDeepLink } from '@checkpost/contract';
import type { PageLoad } from './$types';

/**
 * This page never talks to the API. If someone opens a share link in a browser
 * they get a handoff, not the list: the list belongs to the app, and the web
 * server has no business holding a copy of anyone's checklist.
 *
 * The token is checked for shape only, which is free and keeps obvious
 * typos from reaching the handoff screen.
 */
export const load: PageLoad = ({ params, url }) => {
  if (!SHARE_TOKEN_PATTERN.test(params.token)) {
    error(404, 'That does not look like a Checkpost link.');
  }
  return {
    token: params.token,
    deepLink: shareDeepLink(params.token),
    fullLink: url.href,
  };
};
