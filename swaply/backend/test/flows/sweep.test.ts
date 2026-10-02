// FLOW — A cycle that only appears once a listing comes back
//
// The incremental search runs on the new like and finds cycles through that
// edge alone. When a trade is cancelled, the listings it held go back on the
// market carrying wishes that were dead while it held them — and nothing has
// looked at those wishes since. This is the trigger that catches them.
//
// And the rule it must not break: «A ring is opened once» (`docs/DESIGN.md`).
// A ring somebody in it said no to — «Avslå», «Trekk deg», a yes to a
// withdrawal — is decided, and the sweep leaves it alone, though every wish
// that made it is still there. It used to open it again: on the way out of
// the no, over the listings the no had just freed, or within the hour, with a
// second «Dere kan swappe!» to the people who had just said no to it. A heart
// pressed again after the no is a new wish, and opens the ring anew.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  declineTrade,
  expireWithdrawals,
  requestWithdrawal,
  respondToWithdrawal,
  withdrawEarly,
} from '../../src/trades/actions.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { acceptOffer, cancelTrade, openTradeFromCycle } from '../../src/trades/trades.js'
import { expressWish } from '../../src/trades/wish.js'
import { close, currentOffer, db, like, makeItem, makeUser, reset, tradeState } from '../helpers.js'

// One connection for the file. Closing it per describe leaves the next one
// without a database.
afterAll(close)

describe('the sweep', () => {
  let ola: string, kari: string, per: string
  let drill: string, tent: string, bike: string
  let first: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt')
    bike = await makeItem(per, 'Sykkel')

    // Kari and Per both want the drill; Ola wants the tent.
    await like(ola, tent)
    await like(kari, drill)
    await like(per, drill)
    await like(ola, bike)
  })

  test('1. the drill is spoken for by the first trade', async () => {
    first = await openTradeFromCycle(db, [
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
    const offer = await currentOffer(first)
    await acceptOffer(db, offer, ola, 'terms')

    const [row] = await db.execute<Record<string, string | null>>(
      sql`select active_trade_id from items where id = ${drill}`,
    )
    expect(row!['active_trade_id']).toBe(first)
  })

  test('2. while it is held, Per’s wish finds nothing', async () => {
    expect(await sweepForCycles(db)).toEqual([])
  })

  test('3. cancelling it says which listings came back', async () => {
    const freed = await cancelTrade(db, first, 'withdrawn_early')

    expect(freed).toEqual([drill])
    expect(await tradeState(first)).toBe('cancelled')
  })

  test('4. the sweep over those listings opens the trade nobody looked for', async () => {
    const opened = await sweepForCycles(db, [drill])

    expect(opened).toHaveLength(1)
    expect(await tradeState(opened[0]!)).toBe('pending')
  })

  test('5. running it again does not open a second trade on the same things', async () => {
    expect(await sweepForCycles(db, [drill])).toEqual([])
  })

  test('6. everyone in the new trade hears about it', async () => {
    const rows = await db.execute(
      sql`select 1 from notifications where type = 'trade_opened'`,
    )
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the withdrawal deadline', () => {
  let ola: string, kari: string, trade: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    const drill = await makeItem(ola, 'Bosch drill 18V')
    const tent = await makeItem(kari, 'Telt')

    trade = await openTradeFromCycle(db, [
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
    const offer = await currentOffer(trade)
    await acceptOffer(db, offer, kari, 'terms')
    await acceptOffer(db, offer, ola, 'terms')
  })

  test('1. an unanswered request past its deadline lets the trade carry on', async () => {
    await db.execute(sql`
      insert into trade_withdrawals (trade_id, requested_by, responds_by)
      values (${trade}, ${ola}, now() - interval '1 hour')
    `)
    await db.execute(sql`update trades set state = 'paused' where id = ${trade}`)

    expect(await expireWithdrawals(db)).toBe(1)
    expect(await tradeState(trade)).toBe('accepted')

    const [row] = await db.execute<Record<string, string>>(
      sql`select state from trade_withdrawals where trade_id = ${trade}`,
    )
    expect(row!['state']).toBe('expired')
  })

  test('2. a request still inside its deadline is left alone', async () => {
    await db.execute(sql`
      insert into trade_withdrawals (trade_id, requested_by, responds_by)
      values (${trade}, ${ola}, now() + interval '2 days')
    `)
    expect(await expireWithdrawals(db)).toBe(0)
  })
})

describe('a ring somebody said no to', () => {
  let ola: string, kari: string, per: string, liv: string
  let drill: string, tent: string, bike: string, lamp: string
  let ring: string

  /** Trades still going on that have both of these people in them. */
  async function openBetween(a: string, b: string): Promise<string[]> {
    const rows = await db.execute<{ id: string }>(
      sql`select t.id from trades t
          where t.state not in ('completed', 'cancelled')
            and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${a})
            and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${b})
          order by t.created_at`,
    )
    return rows.map((r) => r.id)
  }

  async function toldOpened(userId: string): Promise<number> {
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from notifications
          where user_id = ${userId} and type = 'trade_opened'`,
    )
    return row!.n
  }

  /** Two new people who want each other's things, and the trade the heart opens. */
  async function pair(a: string, b: string) {
    const fromA = await makeItem(a, 'Ting')
    const fromB = await makeItem(b, 'Ting')
    await like(b, fromA)
    const tradeId = (await expressWish(db, a, fromB)).tradeId!
    expect(tradeId).toBeTruthy()
    return tradeId
  }

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    liv = await makeUser('Liv')
    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt')
    bike = await makeItem(per, 'Sykkel')
    lamp = await makeItem(liv, 'Byggelampe')
  })

  test('3. Ola and Kari want each other’s things, and Ola’s heart opens a trade', async () => {
    await like(kari, drill)
    ring = (await expressWish(db, ola, tent)).tradeId!

    expect(await tradeState(ring)).toBe('pending')
  })

  test('4. Kari says no to it', async () => {
    await declineTrade(db, ring, kari)

    expect(await tradeState(ring)).toBe('cancelled')
  })

  test('5. the search over what the no let go of leaves the ring alone', async () => {
    expect(await sweepForCycles(db, [drill, tent])).toEqual([])
  })

  test('6. and so does the hourly sweep, though both wishes are still there', async () => {
    expect(await sweepForCycles(db)).toEqual([])
    expect(await openBetween(ola, kari)).toEqual([])
    // «Dere kan swappe!» was said once, when the ring opened.
    expect(await toldOpened(kari)).toBe(1)
  })

  test('7. a yes to a withdrawal decides a ring the same way', async () => {
    const [siri, tor] = [await makeUser('Siri'), await makeUser('Tor')]
    const agreed = await pair(siri, tor)
    const offer = await currentOffer(agreed)
    for (const who of [siri, tor]) await acceptOffer(db, offer, who, 'terms-2026-09')
    await requestWithdrawal(db, agreed, siri)
    const { freed } = await respondToWithdrawal(db, agreed, tor, true)

    expect(freed).toHaveLength(2)
    expect(await sweepForCycles(db, freed)).toEqual([])
    expect(await sweepForCycles(db)).toEqual([])
    expect(await openBetween(siri, tor)).toEqual([])
  })

  test('8. and so does «Trekk deg» before anybody agreed', async () => {
    const [una, vid] = [await makeUser('Una'), await makeUser('Vid')]
    const talking = await pair(una, vid)
    await withdrawEarly(db, talking, una)

    expect(await sweepForCycles(db)).toEqual([])
    expect(await openBetween(una, vid)).toEqual([])
  })

  test('9. a ring pushed out by somebody else’s yes was never answered, and comes back', async () => {
    // Per and Liv each want the drill, and Ola wants each of their things:
    // two rings over one drill. Ola's yes to Liv's pushes Per's out.
    await like(per, drill)
    const withPer = (await expressWish(db, ola, bike)).tradeId!
    await like(liv, drill)
    const withLiv = (await expressWish(db, ola, lamp)).tradeId!
    await acceptOffer(db, await currentOffer(withLiv), ola, 'terms-2026-09')
    expect(await tradeState(withPer)).toBe('cancelled')

    // Then Liv says no, and the drill is free again.
    const freed = await declineTrade(db, withLiv, liv)
    expect(freed).toEqual([drill])

    // Per's ring opens again; Liv's, and Kari's, which were refused, do not.
    const opened = await sweepForCycles(db, freed)
    expect(opened).toHaveLength(1)
    expect(await openBetween(ola, per)).toEqual(opened)
    expect(await openBetween(ola, liv)).toEqual([])
    expect(await openBetween(ola, kari)).toEqual([])
  })

  test('10. a heart Ola presses again after Kari’s no is a new wish, and opens the ring anew', async () => {
    await db.execute(sql`delete from likes where from_user = ${ola} and target_item = ${tent}`)

    const again = await expressWish(db, ola, tent)

    expect(again.tradeIsNew).toBe(true)
    expect(again.tradeId).not.toBe(ring)
    expect(await openBetween(ola, kari)).toEqual([again.tradeId])
  })

  test('11. and the sweep does not open it a second time', async () => {
    expect(await sweepForCycles(db)).toEqual([])
    expect(await openBetween(ola, kari)).toHaveLength(1)
  })
})
