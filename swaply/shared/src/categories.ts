import { z } from 'zod'

// Fixed list, in the order the interest picker shows them. Interests are stored
// on the user and are what Discover's rows are filtered by before a search, so
// adding one here changes onboarding and discovery at the same time.
//
// These are the twelve from the round 5 export, and they are the `category` enum
// in the database: the list here had drifted from the schema, which is a bug
// waiting for the first consumer. The Norwegian words live in the clients —
// `web/src/lib/labels.ts` and `app/lib/design/tokens.dart` — never here and
// never in the database.
export const CATEGORIES = [
  'sykling',
  'gaming',
  'verktoy',
  'klaer',
  'bat',
  'friluft',
  'barn',
  'hjem',
  'sport',
  'musikk',
  'boker',
  'diverse',
] as const

export const categorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof categorySchema>

// Any number of the twelve, none included, and each once. Round 5 held the
// picker to three to five; the product owner took that away on 30.09.2026.
export const interestsSchema = z
  .array(categorySchema)
  .refine((v) => new Set(v).size === v.length, 'interests must be distinct')

export const CONDITIONS = ['new', 'good', 'worn'] as const
export const conditionSchema = z.enum(CONDITIONS)
export type Condition = z.infer<typeof conditionSchema>
