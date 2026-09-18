import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { ApiError } from './errors.js'
import { one } from './rows.js'

/**
 * A block hides both ways.
 *
 * `docs/DESIGN.md` says a blocked user's items «are hidden and can't match»,
 * and in a matching product that has to mean every surface: hidden on Oppdag
 * but reachable from a profile is not hidden, and the person who was blocked
 * must not be able to reach around it either — they do not know they were
 * blocked, and finding out by being refused is better than finding out in a
 * trade.
 */
export async function blockedBetween(db: Database, a: string | null, b: string | null) {
  if (!a || !b || a === b) return false
  const row = await one(
    db,
    sql`select 1 from blocks
        where (blocker = ${a} and blocked = ${b}) or (blocker = ${b} and blocked = ${a})`,
  )
  return Boolean(row)
}

/** 403, with a code the app can switch on. Never says who blocked whom. */
export const blocked = () =>
  new ApiError(403, 'blocked', 'Dette er ikke mulig mellom dere.')
