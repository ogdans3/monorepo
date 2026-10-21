import { sql, type SQL } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { ApiError } from '../lib/errors.js'
import { one, uuidArray, type Executor, type Row } from '../lib/rows.js'

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
//
// A listing is in its owner's ring, with one more: the «[test] …» things
// «Bygg et bytte» makes (`items.made_by_scenario`) are in the ring of the
// admin they were made for even when the admin owns them. The admin may meet
// anybody, so by owner alone those were on everybody's Oppdag, and a real
// person's heart on one opened a real trade with the admin over a thing that
// exists only to be spent by the tool.

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

/**
 * Whether the account [user] may meet the listing [item] as far as the
 * listing goes, as a condition for a statement — the owner is `sameRing`'s
 * to judge. Every listing but one a scenario made is open to anybody; that
 * one, to its owner and to the ring it was made in: the owner's admin, or
 * the owner when that is the admin, and the admin's test accounts. Nobody
 * at all — a device with no token — is in no ring. True or false, never
 * null, so it can be negated.
 */
export function listingOpenTo(user: SQL, item: SQL): SQL {
  return sql`exists (
    select 1 from items li join users lo on lo.id = li.owner_id
    where li.id = ${item}
      and (not li.made_by_scenario
           or exists (select 1 from users lv
                      where lv.id = ${user}
                        and (lv.id = lo.id
                             or ${sql.raw(ringOf('lv'))} = coalesce(lo.test_account_of, lo.id)))))`
}

/** Whether a test account and somebody outside its ring are the two people here. */
export async function ringsApart(db: Database, a: string, b: string): Promise<boolean> {
  const [row] = await db.execute<Row>(sql`select ${sameRing(sql`${a}::uuid`, sql`${b}::uuid`)} as meet`)
  return !row?.['meet']
}

/** Whether [item] is a listing a scenario made in a ring [user] is outside. */
export async function listingApart(db: Executor, user: string, item: string): Promise<boolean> {
  const [row] = await db.execute<Row>(
    sql`select ${listingOpenTo(sql`${user}::uuid`, sql`${item}::uuid`)} as open`,
  )
  return !row?.['open']
}

/**
 * The first of [items] that a scenario made in a ring somebody among [people]
 * is outside, or null. Everybody in a trade sees everything on its table — a
 * ring of three draws the leg that is not yours on 07j — so a listing is
 * judged against everybody in it, not only the one it goes to.
 */
export async function listingAcross(
  db: Executor,
  people: string[],
  items: string[],
): Promise<string | null> {
  if (people.length === 0 || items.length === 0) return null
  const row = await one(
    db,
    sql`select i.id from items i, users p
        where i.id = any(${uuidArray(items)}) and p.id = any(${uuidArray(people)})
          and i.made_by_scenario
          and not ${listingOpenTo(sql`p.id`, sql`i.id`)}
        limit 1`,
  )
  return row ? (row['id'] as string) : null
}

/**
 * Whether everybody in the trade [trade] is inside one admin's ring — the
 * admin and the admin's test accounts, and nobody else. The only trades
 * «Nullstill → bytter» ends (`resetAccount` leaves the rest standing), and so
 * the only ones whose ending by it counts as a no (`decidedRing`). True or
 * false, never null.
 */
export function withinOneRing(trade: SQL): SQL {
  return sql`(select count(*) = 0 from trade_participants p join users u on u.id = p.user_id
              where p.trade_id = ${trade} and ${sql.raw(ringOf('u'))} is null)
         and (select count(distinct ${sql.raw(ringOf('u'))}) = 1
              from trade_participants p join users u on u.id = p.user_id
              where p.trade_id = ${trade})`
}

/**
 * 403, with a code the app can switch on, in words true for whoever reads it:
 * the real person who found a test listing through a link, and the admin
 * pressing a heart as one of their test accounts.
 */
export const testRing = () =>
  new ApiError(403, 'test_ring', 'Testkontoer kan bare bytte med hverandre og med eieren sin.')

/**
 * The same refusal about a listing a scenario made, in the words true for
 * the one who meets it: a real person, or another admin, who reached a
 * «[test] …» thing by a link — its owner may be anybody's to trade with.
 */
export const testListing = () =>
  new ApiError(403, 'test_ring', 'Dette er en testannonse, og den er ikke til bytte.')

/** And about sharing one, which makes a page for somebody in no ring at all. */
export const testListingShared = () =>
  new ApiError(403, 'test_ring', 'Dette er en testannonse, og den kan ikke deles.')
