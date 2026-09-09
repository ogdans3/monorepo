import { error, redirect } from '@sveltejs/kit'

import type { PageServerLoad } from './$types'

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

/**
 * Where the paste box on the landing page posts when there is no JavaScript to
 * catch it. The page does the same thing in the browser, so this is what makes
 * that an enhancement rather than a requirement.
 */
export const load: PageServerLoad = ({ url }) => {
  const pasted = (url.searchParams.get('lenke') ?? '').trim()
  // A whole URL, or the token on its own if somebody read it off a screen.
  const token = pasted.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''

  if (!TOKEN.test(token)) {
    error(400, 'Det ser ikke ut som en Swaply-lenke. Lim inn hele lenken du fikk.')
  }

  redirect(303, `/i/${token}`)
}
