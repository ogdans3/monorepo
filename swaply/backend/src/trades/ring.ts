import { sql, type SQL } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { ApiError } from '../lib/errors.js'
import type { Row } from '../lib/rows.js'

// The test tooling's ring, where it meets the product.
//
// `docs/ADMIN.md` bound #2: a test account and a real person are never in one
// trade, one chat or one handover — from that moment the account can neither
// be reset nor deleted, because it is somebody's history. Hiding test
// listings on Oppdag was the only thing holding that, and a heart, a first
// message and the cycle search all walked straight past it: the admin acting
// as Kari could heart a real tester's bike, and a ring through Kari and the
// tester opened a real trade.
//
// An account's ring is the admin's own id for the admin, `test_account_of`
// for a test account, and none for everybody else. Two accounts may meet
// when neither is a test account — the admin is a real person, and stays
// free to trade with real people — or when they are in the same ring.

/** The ring of the account behind [alias], or null for a person outside every ring. */
const ringOf = (alias: string) =>
  `(case when ${alias}.is_admin then ${alias}.id else ${alias}.test_account_of end)`

/**
 * Whether the accounts [a] and [b] may meet, as a condition for a statement.
 * True or false, never null, so it can be negated.
 */
export function sameRing(a: SQL, b: SQL): SQL {
  return sql`exists (
    select 1 from users ra, users rb
    where ra.id = ${a} and rb.id = ${b}
      and ((ra.test_account_of is null and rb.test_account_of is null)
           or ${sql.raw(ringOf('ra'))} = ${sql.raw(ringOf('rb'))}))`
}

/** Whether a test account and somebody outside its ring are the two people here. */
export async function ringsApart(db: Database, a: string, b: string): Promise<boolean> {
  const [row] = await db.execute<Row>(sql`select ${sameRing(sql`${a}::uuid`, sql`${b}::uuid`)} as meet`)
  return !row?.['meet']
}

/**
 * 403, with a code the app can switch on, in words true for whoever reads it:
 * the real person who found a test listing through a link, and the admin
 * pressing a heart as one of their test accounts.
 */
export const testRing = () =>
  new ApiError(403, 'test_ring', 'Testkontoer kan bare bytte med hverandre og med eieren sin.')
