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

/** Screen 10a fires once someone has liked this many things without listing any. */
export const LIKES_BEFORE_LISTING_PROMPT = 10

/** «Svarer ikke Ola innen fristen, fortsetter byttet som vanlig.» */
export const WITHDRAWAL_RESPONSE_HOURS = 72
