// FLOW — A cycle that only appears once a listing comes back
//
// The incremental search runs on the new like and finds cycles through that
// edge alone. When a trade is cancelled, the listings it held go back on the
// market carrying wishes that were dead while it held them — and nothing has
// looked at those wishes since. This is the trigger that catches them.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { expireWithdrawals } from '../../src/trades/actions.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { acceptOffer, cancelTrade, openTradeFromCycle } from '../../src/trades/trades.js'
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
    const freed = await cancelTrade(db, first, 'Ola trakk seg')

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
