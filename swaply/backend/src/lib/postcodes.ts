import { POSTCODE_REGISTER } from './postcode-register.js'

// Where a thing is matters to somebody deciding whether to swap for it, and an
// address is more than they need: 10b asks for a postcode and says «Kun by
// vises for andre», so the postcode is looked up and only the town is kept.
//
// The register is Bring's, carried in the build rather than asked for while
// somebody lists a thing: a lookup per listing would tell a third party where
// a person lives, and would be one more thing that can be down. `pnpm
// postcodes` rewrites it when Bring changes a postcode.
const towns = new Map(
  POSTCODE_REGISTER.trim()
    .split('\n')
    .map((line) => [line.slice(0, 4), line.slice(5)] as const),
)

/** The town a Norwegian postcode belongs to, or null when it is not one. */
export function townFor(postalCode: string | null | undefined): string | null {
  return postalCode ? (towns.get(postalCode) ?? null) : null
}
