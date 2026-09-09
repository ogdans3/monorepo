import type { Category, Condition } from '@swaply/shared'

/**
 * The keys cross the wire; the Norwegian words live here.
 *
 * The same table exists in `app/lib/design/tokens.dart`, written twice on
 * purpose — the Flutter app cannot import from `shared/`, and neither can it
 * import from here. The two have to be changed together.
 */
export const categoryLabels: Record<Category, string> = {
  sykling: 'Sykling',
  gaming: 'Gaming',
  verktoy: 'Verktøy',
  klaer: 'Klær',
  bat: 'Båt',
  friluft: 'Friluft',
  barn: 'Barn',
  hjem: 'Hjem',
  sport: 'Sport',
  musikk: 'Musikk',
  boker: 'Bøker',
  diverse: 'Diverse',
}

export const conditionLabels: Record<Condition, string> = {
  new: 'Ny',
  good: 'God',
  worn: 'Slitt',
}

/**
 * «Verdi 2 500 kr». A plain space between the thousands, not a thin one — read
 * off the round 5 export, and written the same way in the app and in
 * `backend/src/lib/text.ts`, which is where the shared line comes from.
 */
export function kr(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const digits = Math.round(value).toString()
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ' '
    out += digits[i]
  }
  return `${out} kr`
}

/** The label under a listing: category, then the free-text subcategory. */
export const categoryLine = (category: string, subcategory: string | null): string =>
  [categoryLabels[category as Category] ?? category, subcategory].filter(Boolean).join(' · ')
