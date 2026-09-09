import { z } from 'zod'

// Fixed list, in the order the interest picker shows them. Interests are stored
// on the user and are what Discover's rows are filtered by before a search, so
// adding one here changes onboarding and discovery at the same time.
export const CATEGORIES = [
  'verktoy',
  'gaming',
  'sykkel',
  'klaer',
  'sport',
  'bat-og-fritid',
  'mobler',
  'elektronikk',
  'barn',
  'hage',
  'musikk',
  'bil-og-mc',
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
