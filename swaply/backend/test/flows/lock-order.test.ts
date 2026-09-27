// FLOW — Two things that end or take trades, in the same moment
//
// The rule this exists to pin down: **everything that changes a trade or what
// it holds takes its locks in one order — the trades first, lowest id first,
// then the listings, lowest id first** (`backend/src/trades/index.ts`). Two
// transactions that take the same rows in the same order queue; two that take
// them in different orders can each end up holding what the other needs next,
// and Postgres settles that by killing one of them as a deadlock — a 500 under
// somebody's button, or «Slett kontoen» failing.
//
// Both races here were real before the order was one order. Ola saying yes
// took her own things, then the trades her yes pushed out, then her own
// trade; Kari deleting her account took each of her trades' things and then
// that trade, one trade at a time. And two people each saying yes in a
// different trade took the trades they pushed out in whatever order their own
// listings happened to sort in.
//
// Each race runs five times, on two connections of its own. A third
// connection holds every row either side will want until both are waiting on
// it, and then lets go, so the two start from the same instant instead of
// whichever the event loop reached first.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { connect } from '../../src/db/index.js'
import { anonymiseUser } from '../../src/trades/erasure.js'
import { acceptOffer, openTradeFromCycle, proposeCounterOffer } from '../../src/trades/trades.js'
import { close, currentOffer, db, itemRow, makeItem, makeUser, reset, tradeState } from '../helpers.js'

const ROUNDS = 5

/** Postgres's own word for it, wherever drizzle has wrapped the driver's error. */
function deadlocked(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if ((e as { code?: string }).code === '40P01') return true
  }
  return false
}

/**
 * Run `a` and `b` on two connections of their own, released together.
 *
 * The gate holds the trades and listings the two will reach for until both
 * are waiting on something, and only then commits. Without it the first to be
 * scheduled usually finishes before the second has started, and the test
 * passes whatever order the code takes its locks in.
 */
async function race(
  held: { trades: string[]; items: string[] },
  a: (db: ReturnType<typeof connect>['db']) => Promise<unknown>,
  b: (db: ReturnType<typeof connect>['db']) => Promise<unknown>,
): Promise<[PromiseSettledResult<unknown>, PromiseSettledResult<unknown>]> {
  const gate = connect()
  const first = connect()
  const second = connect()
  try {
    let running: Promise<[PromiseSettledResult<unknown>, PromiseSettledResult<unknown>]> | undefined
    await gate.db.transaction(async (tx) => {
      for (const id of held.trades) {
        await tx.execute(sql`select 1 from trades where id = ${id} for update`)
      }
      for (const id of held.items) {
        await tx.execute(sql`select 1 from items where id = ${id} for update`)
      }
      running = Promise.allSettled([a(first.db), b(second.db)]) as typeof running
      // Asked outside the gate's transaction: inside one, Postgres answers
      // `pg_stat_activity` from the snapshot it took the first time, and the
      // two would never be seen arriving.
      for (let tries = 0; ; tries++) {
        const [waiting] = await db.execute<{ n: number }>(
          sql`select count(*)::int as n from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'`,
        )
        if (waiting!.n >= 2) break
        if (tries > 500) throw new Error('the two never both came to the rows the gate holds')
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    })
    return await running!
  } finally {
    await Promise.all([gate.client.end(), first.client.end(), second.client.end()])
  }
}

/** Neither side died of the other. A refusal in words is an answer; a deadlock is not. */
function noDeadlock(results: PromiseSettledResult<unknown>[], round: number) {
  for (const result of results) {
    if (result.status === 'fulfilled') continue
    const reason = result.reason as { statusCode?: number }
    expect(deadlocked(reason), `round ${round}: ${String(reason)}`).toBe(false)
    // Anything but a 409 in words is a 500 somebody sees.
    expect(reason.statusCode, `round ${round}: ${String(reason)}`).toBe(409)
  }
}

/** A listing held by a trade that has ended is held by nothing, for ever. */
async function heldByEndedTrades(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from items i join trades t on t.id = i.active_trade_id
        where t.state in ('cancelled', 'completed')`,
  )
  return row!.n
}

beforeAll(reset)
afterAll(close)

describe('Ola says yes while Kari deletes her account', () => {
  // Kari is in two trades with Ola, both about Ola's drill, and has said yes
  // to both — her tent is held by one and her lamp by the other. Ola's yes to
  // the tent closes the lamp trade, because the drill is in it. Kari's
  // deletion ends both.
  test('1. both finish, five times over, and neither is a deadlock', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const ola = await makeUser(`Ola${round}`)
      const kari = await makeUser(`Kari${round}`)
      const drill = await makeItem(ola, 'Bosch drill 18V')
      const tent = await makeItem(kari, 'Telt')
      const lamp = await makeItem(kari, 'Byggelampe')

      const forTent = await openTradeFromCycle(db, [
        { userId: kari, givesItemId: tent },
        { userId: ola, givesItemId: drill },
      ])
      const forLamp = await openTradeFromCycle(db, [
        { userId: kari, givesItemId: lamp },
        { userId: ola, givesItemId: drill },
      ])
      await acceptOffer(db, await currentOffer(forTent), kari, 'terms-2026-09')
      await acceptOffer(db, await currentOffer(forLamp), kari, 'terms-2026-09')
      const offer = await currentOffer(forTent)

      const results = await race(
        { trades: [forTent, forLamp], items: [drill, tent, lamp] },
        (conn) => acceptOffer(conn, offer, ola, 'terms-2026-09'),
        (conn) => anonymiseUser(conn, kari),
      )

      noDeadlock(results, round)
      // The deletion always finishes: a yes never stands in its way.
      expect(results[1].status, `round ${round}`).toBe('fulfilled')
      // Whichever went first, both of Kari's trades are over and nothing
      // either of them held is still held — the yes did not bring a trade the
      // deletion had ended back to life.
      expect(await tradeState(forTent), `round ${round}`).toBe('cancelled')
      expect(await tradeState(forLamp), `round ${round}`).toBe('cancelled')
      expect((await itemRow(drill))['active_trade_id'], `round ${round}`).toBeNull()
      expect(await heldByEndedTrades(), `round ${round}`).toBe(0)
    }
  }, 30_000)
})

describe('Ola and Per say yes in two trades that each push out the other’s', () => {
  // Ola offers Kari two things in one trade, and Per offers Kari two of his in
  // another. Between Ola and Per there are two more trades, crossed: Ola's
  // first thing for Per's second, and Ola's second for Per's first. Each yes
  // closes both crossed trades, and before the order was one order, Ola took
  // them in the order of her listings and Per in the order of his.
  test('2. both yeses land, five times over, and the crossed trades close once', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const ola = await makeUser(`Ola${round}b`)
      const per = await makeUser(`Per${round}b`)
      const kari = await makeUser(`Kari${round}b`)
      // Named by the order the database sorts them in, which is what decides
      // the order a yes used to reach the trades it pushed out.
      const [olaFirst, olaSecond] = [await makeItem(ola, 'Drill'), await makeItem(ola, 'Sag')].sort()
      const [perFirst, perSecond] = [await makeItem(per, 'Sykkel'), await makeItem(per, 'Hjelm')].sort()
      const kariOne = await makeItem(kari, 'Telt')
      const kariTwo = await makeItem(kari, 'Lampe')

      const withOla = await openTradeFromCycle(db, [
        { userId: kari, givesItemId: kariOne },
        { userId: ola, givesItemId: olaFirst! },
      ])
      await proposeCounterOffer(db, withOla, kari, [
        { itemId: kariOne, giverPosition: 0 },
        { itemId: olaFirst!, giverPosition: 1 },
        { itemId: olaSecond!, giverPosition: 1 },
      ])
      const withPer = await openTradeFromCycle(db, [
        { userId: kari, givesItemId: kariTwo },
        { userId: per, givesItemId: perFirst! },
      ])
      await proposeCounterOffer(db, withPer, kari, [
        { itemId: kariTwo, giverPosition: 0 },
        { itemId: perFirst!, giverPosition: 1 },
        { itemId: perSecond!, giverPosition: 1 },
      ])
      const crossedA = await openTradeFromCycle(db, [
        { userId: ola, givesItemId: olaFirst! },
        { userId: per, givesItemId: perSecond! },
      ])
      const crossedB = await openTradeFromCycle(db, [
        { userId: ola, givesItemId: olaSecond! },
        { userId: per, givesItemId: perFirst! },
      ])
      const olaOffer = await currentOffer(withOla)
      const perOffer = await currentOffer(withPer)

      const results = await race(
        {
          trades: [withOla, withPer, crossedA, crossedB],
          items: [olaFirst!, olaSecond!, perFirst!, perSecond!],
        },
        (conn) => acceptOffer(conn, olaOffer, ola, 'terms-2026-09'),
        (conn) => acceptOffer(conn, perOffer, per, 'terms-2026-09'),
      )

      noDeadlock(results, round)
      // Neither yes takes anything the other is giving, so both stand.
      expect(results.map((r) => r.status), `round ${round}`).toEqual(['fulfilled', 'fulfilled'])
      expect((await itemRow(olaFirst!))['active_trade_id'], `round ${round}`).toBe(withOla)
      expect((await itemRow(perFirst!))['active_trade_id'], `round ${round}`).toBe(withPer)
      expect(await tradeState(crossedA), `round ${round}`).toBe('cancelled')
      expect(await tradeState(crossedB), `round ${round}`).toBe('cancelled')
      expect(await heldByEndedTrades(), `round ${round}`).toBe(0)
    }
  }, 30_000)
})
