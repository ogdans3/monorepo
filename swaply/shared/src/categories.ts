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

// The picker demands at least three and stops at five. Both numbers are product
// decisions from round 5, not arbitrary limits: below three the interest rows
// are too thin to fill a screen, and above five they stop being a signal.
export const MIN_INTERESTS = 3
export const MAX_INTERESTS = 5

export const interestsSchema = z
  .array(categorySchema)
  .min(MIN_INTERESTS)
  .max(MAX_INTERESTS)
  .refine((v) => new Set(v).size === v.length, 'interests must be distinct')

export const CONDITIONS = ['new', 'good', 'worn'] as const
export const conditionSchema = z.enum(CONDITIONS)
export type Condition = z.infer<typeof conditionSchema>
