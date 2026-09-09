/**
 * «Verdi 2 500 kr». Thousands are separated by a plain space, not a thin one —
 * read off the round 5 export rather than guessed, and written the same way in
 * `app/lib/design/tokens.dart`. The two have to agree, because the share text
 * the app draws in the sheet is the one the server puts on the link.
 */
export function kroner(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const digits = Math.round(value).toString()
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ' '
    out += digits[i]
  }
  return `${out} kr`
}

/** The line that travels with a shared listing, from the round 5 brief. */
export function shareText(title: string, valueNok: number | null): string {
  const value = kroner(valueNok)
  return value ? `Se denne på Swaply: ${title}, verdi ${value}.` : `Se denne på Swaply: ${title}.`
}

/** The line that travels with a bare invitation, where there is no listing. */
export function inviteText(inviterName: string | null): string {
  return inviterName
    ? `${inviterName} inviterer deg til Swaply. Si hva du vil ha — når ønskene lukker en sirkel, bytter dere.`
    : 'Du er invitert til Swaply. Si hva du vil ha — når ønskene lukker en sirkel, bytter dere.'
}
