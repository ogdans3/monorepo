// FLOW — A counter-offer, and why acceptance belongs to a version
//
// The single easiest thing to model wrong. If acceptance hangs off the trade,
// a counter-offer silently invalidates what someone already agreed to, and they
// end up bound to a deal they never saw. Offers are immutable versions, and an
// acceptance names the version it was given for.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { acceptOffer, openTradeFromCycle, proposeCounterOffer } from '../../src/trades/trades.js'
import { close, currentOffer, db, makeItem, makeUser, reset, tradeState } from '../helpers.js'

describe('a counter-offer', () => {
  let ola: string, kari: string
  let drill: string, tent: string, lamp: string
  let trade: string, v1: string, v2: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    drill = await makeItem(ola, 'Bosch drill 18V', { value: 600 })
    tent = await makeItem(kari, 'Telt', { value: 400 })
    lamp = await makeItem(kari, 'Byggelampe', { value: 150 })

    trade = await openTradeFromCycle(db, [
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
    v1 = await currentOffer(trade)
  })

  afterAll(close)

  test('1. Ola accepts the first version', async () => {
    const result = await acceptOffer(db, v1, ola, 'terms-2026-09')

    expect(result.everyoneAccepted).toBe(false)
    expect(await tradeState(trade)).toBe('pending')
  })

  test('2. Kari counters: two things and 200 kroner, rather than one', async () => {
    v2 = await proposeCounterOffer(
      db,
      trade,
      kari,
      [
        { itemId: tent, giverPosition: 0 },
        { itemId: lamp, giverPosition: 0 },
        { itemId: drill, giverPosition: 1 },
      ],
      { payerPosition: 0, payeePosition: 1, amountNok: 200 },
    )

    expect(v2).not.toBe(v1)
    expect(await tradeState(trade)).toBe('countered')
  })

  test('3. Ola’s acceptance stayed on version one — it does not carry over', async () => {
    const live = await db.execute(
      sql`select 1 from trade_acceptances where offer_id = ${v2} and revoked_at is null`,
    )
    expect(live).toHaveLength(0)

    const onV1 = await db.execute(sql`select 1 from trade_acceptances where offer_id = ${v1}`)
    expect(onV1).toHaveLength(1)
  })

  test('4. the cash difference is recorded, never settled', async () => {
    const [row] = await db.execute<Record<string, string | number | null>>(
      sql`select amount_nok, payer_position from trade_offer_cash where offer_id = ${v2}`,
    )
    expect(Number(row!['amount_nok'])).toBe(200)
    expect(Number(row!['payer_position'])).toBe(0)
  })

  test('5. both accept the new version, and that is what binds', async () => {
    await acceptOffer(db, v2, ola, 'terms-2026-09')
    const result = await acceptOffer(db, v2, kari, 'terms-2026-09')

    expect(result.everyoneAccepted).toBe(true)
    expect(await tradeState(trade)).toBe('accepted')
  })

  test('6. what each side ticked is on the record, per version', async () => {
    const rows = await db.execute<Record<string, string | null>>(
      sql`select o.seq, count(a.user_id) as accepted
          from trade_offers o
          left join trade_acceptances a on a.offer_id = o.id and a.revoked_at is null
          where o.trade_id = ${trade} group by o.seq order by o.seq`,
    )
    expect(rows.map((r) => Number(r['accepted']))).toEqual([1, 2])
  })
})
