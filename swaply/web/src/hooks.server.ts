import type { HandleServerError } from '@sveltejs/kit'

/**
 * What a person reads when something went wrong that nobody wrote words for.
 *
 * SvelteKit's own are English — «Internal Error», «Not Found» — and
 * `+error.svelte` prints the message under its heading, so without this a
 * visitor who followed a link got the one English sentence on the site. An
 * error thrown with `error()` carries its own Norwegian words and does not
 * come through here.
 */
export const handleError: HandleServerError = ({ error, event, status }) => {
  if (status === 404) return { message: 'Vi har ingen side på denne adressen.' }
  console.error(`${event.request.method} ${event.url.pathname}`, error)
  return { message: 'Prøv igjen om litt.' }
}
