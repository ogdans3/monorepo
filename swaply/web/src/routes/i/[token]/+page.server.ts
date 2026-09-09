import { error } from '@sveltejs/kit'
import { env as publicEnv } from '$env/dynamic/public'

import { apiOrigin, type Invite } from '$lib/server/api'
import type { PageServerLoad } from './$types'

/**
 * The page a shared link opens, rendered on the server so the thing is in the
 * HTML: this URL is read by chat clients building a preview as often as it is
 * read by people, and neither of them runs our JavaScript.
 */
export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const response = await fetch(`${apiOrigin}/invites/${params.token}`)

  if (response.status === 404) {
    error(404, 'Vi kjenner ikke igjen denne invitasjonen.')
  }
  if (!response.ok) {
    error(502, 'Vi får ikke kontakt med Swaply akkurat nå. Prøv igjen om litt.')
  }

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
