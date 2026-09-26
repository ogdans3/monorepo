// Mirrors @swaply/shared, which the Flutter app cannot import either. The
// Norwegian labels live in the clients; the wire only ever carries these keys.
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

export const CONDITIONS = ['new', 'good', 'worn'] as const

/**
 * Screen 10a: while someone has listed nothing, the heart that brings their
 * likes to 5 offers it, and then every 10th after that — 15, 25, 35.
 *
 * Early, because wishes with nothing to give are a dead end and the sooner
 * that is said the fewer of them pile up. Then quieter, because the person who
 * answered «Senere» meant it, and asking again on every heart turns the heart
 * into something to avoid. The export's title says ten; the product owner moved
 * it on 26.09.2026.
 */
export const LIKES_BEFORE_LISTING_PROMPT = 5
export const LISTING_PROMPT_EVERY = 10

/** «Svarer ikke Ola innen fristen, fortsetter byttet som vanlig.» */
export const WITHDRAWAL_RESPONSE_HOURS = 72

/**
 * «Each side of a hop is a list of 1–3 items» — `docs/DESIGN.md`. The cap is
 * what the counter-offer screens are drawn for, not a storage limit.
 */
export const MAX_ITEMS_PER_SIDE = 3
