import { ApiError } from './errors.js'
import { POSTCODE_REGISTER } from './postcode-register.js'

// Where a thing is matters to somebody deciding whether to swap for it, and an
// address is more than they need: 10b asks for a postcode and says «Kun by
// vises for andre», so the postcode is looked up and only the town is kept.
//
// The register is Bring's, carried in the build rather than asked for while
// somebody lists a thing: a lookup per listing would tell a third party where
// a person lives, and would be one more thing that can be down. `pnpm
// postcodes` rewrites it when Bring changes a postcode. Posten Bring AS
// publishes it under the Norwegian licence for Open Government data (NLOD
// 2.0), which asks for the attribution the generated file carries.
const towns = new Map(
  POSTCODE_REGISTER.trim()
    .split('\n')
    .map((line) => [line.slice(0, 4), line.slice(5)] as const),
)

/** The town a Norwegian postcode belongs to, or null when it is not one. */
export function townFor(postalCode: string | null | undefined): string | null {
  return postalCode ? (towns.get(postalCode) ?? null) : null
}

/**
 * The refusal for a postcode that belongs to no town, in one wording wherever
 * one is typed. 400 where it is part of a form, 404 where it is the thing
 * asked for.
 */
export function unknownPostalCode(postalCode: string, status: 400 | 404 = 400) {
  return new ApiError(
    status,
    'unknown_postal_code',
    `Fant ikke postnummer ${postalCode}. Sjekk det, eller la feltet stå tomt.`,
  )
}

/**
 * The town a typed postcode belongs to, which is all of it anybody else sees.
 * A postcode that belongs to none is refused rather than passed over: passing
 * over it is how a listing went out with no town at all while 10b said the
 * town would show, and a typo is the likeliest reason for one.
 */
export function townOf(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null
  const town = townFor(postalCode)
  if (!town) throw unknownPostalCode(postalCode)
  return town
}
