import { error } from '@sveltejs/kit'
import { env as publicEnv } from '$env/dynamic/public'

import { apiOrigin, type Invite } from '$lib/server/api'
import type { PageServerLoad } from './$types'

/** What `mint` in the API makes: base64url, and not short. */
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

const UNKNOWN = 'Vi kjenner ikke igjen denne invitasjonen.'
const UNREACHABLE = 'Vi får ikke kontakt med Swaply akkurat nå. Prøv igjen om litt.'

/**
 * The page a shared link opens, rendered on the server so the thing is in the
 * HTML: this URL is read by chat clients building a preview as often as it is
 * read by people, and neither of them runs our JavaScript.
 */
export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  // Only something that could be a token goes into the API's path. The
  // parameter arrives decoded, so `..%2Fdiscover` was `../discover` and the
  // page drew whatever another endpoint answered as an invitation. A token
  // that cannot be one is a link we never made, and is answered as one.
  if (!TOKEN.test(params.token)) error(404, UNKNOWN)

  let response: Response
  try {
    response = await fetch(`${apiOrigin}/invites/${encodeURIComponent(params.token)}`)
  } catch {
    // An API that is down refuses the connection rather than answering, so
    // this is the ordinary way of not reaching it.
    error(502, UNREACHABLE)
  }

  if (response.status === 404) error(404, UNKNOWN)
  if (!response.ok) error(502, UNREACHABLE)

  // Short, and private: the state of an invitation changes the moment somebody
  // takes it, and it is nobody's business but the holder's.
  setHeaders({ 'cache-control': 'private, max-age=30' })

  const invite = (await response.json()) as Invite

  return {
    invite,
    // Where «Åpne i Swaply» goes. The app is a separate deployment on its own
    // hostname, so the web server has to be told which one.
    appOrigin: publicEnv.PUBLIC_APP_ORIGIN || 'http://localhost:5175',
  }
}
