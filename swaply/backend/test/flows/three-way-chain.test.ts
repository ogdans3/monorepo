// FLOW — A three-way chain
//
// The screen that sells the product, and the reason the whole thing is a graph
// rather than a list of pairs. Nobody here wants what the person who wants their
// thing has: Ola wants Kari's tent, Kari wants Per's bike, Per wants Ola's
// drill. No pair of them can trade, but all three can.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { markHandover, requestWithdrawal, respondToWithdrawal } from '../../src/trades/actions.js'
import { findCyclesThrough } from '../../src/trades/cycles.js'
import { acceptOffer, completeTrade, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, itemRow, like, makeItem, makeUser, reset, tradeState } from '../helpers.js'

afterAll(close)

describe('a three-way chain', () => {
  let ola: string, kari: string, per: string
  let drill: string, tent: string, bike: string
  let trade: string, offer: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt')
    bike = await makeItem(per, 'Sykkel')
  })

  test('1. two of the three wishes close nothing', async () => {
    await like(ola, tent)
    await like(kari, bike)

    expect(await findCyclesThrough(db, ola, tent)).toEqual([])
    expect(await findCyclesThrough(db, kari, bike)).toEqual([])
  })

  test('2. the third wish closes the ring, in giving order', async () => {
    await like(per, drill)

    const cycles = await findCyclesThrough(db, per, drill)

    expect(cycles).toHaveLength(1)
    // Each gives to the next: Per → Kari → Ola → Per.
    expect(cycles[0]).toEqual([
      { userId: per, givesItemId: bike },
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
  })

  test('3. no two of them want each other’s things', async () => {
    // The chain is doing real work here, not decorating a trade that a pair
    // could have made on their own: not one of the three wishes is returned.
    const mutual = await db.execute(sql`
      select 1
      from likes a
      join items ai on ai.id = a.target_item
      join likes b on b.from_user = ai.owner_id
      join items bi on bi.id = b.target_item
      where bi.owner_id = a.from_user
    `)
    expect(mutual).toHaveLength(0)
  })

  test('4. the trade opens with all three, in order', async () => {
    const cycles = await findCyclesThrough(db, per, drill)
    trade = await openTradeFromCycle(db, cycles[0]!)
    offer = await currentOffer(trade)

    const rows = await db.execute<Record<string, string | number>>(
      sql`select user_id, position from trade_participants
          where trade_id = ${trade} order by position`,
    )
    expect(rows.map((r) => r['user_id'])).toEqual([per, kari, ola])
  })

  test('5. each acceptance locks only that person’s own listing', async () => {
    const first = await acceptOffer(db, offer, per, 'terms-2026-09')
    expect(first.reserved).toEqual([bike])
    expect((await itemRow(tent))['active_trade_id']).toBeNull()

    const second = await acceptOffer(db, offer, kari, 'terms-2026-09')
    expect(second.reserved).toEqual([tent])
    expect(second.everyoneAccepted).toBe(false)
    expect(await tradeState(trade)).toBe('pending')
  })

  test('6. the last acceptance is what agrees the whole ring', async () => {
    const last = await acceptOffer(db, offer, ola, 'terms-2026-09')

    expect(last.everyoneAccepted).toBe(true)
    expect(await tradeState(trade)).toBe('accepted')
  })

  test('7. completing it moves all three listings at once', async () => {
    await completeTrade(db, trade)

    for (const item of [drill, tent, bike]) {
      expect((await itemRow(item))['status']).toBe('traded')
    }
  })
})

describe('a ring of three, and one of them asking to get out', () => {
  let tor: string, una: string, vid: string
  let kayak: string, lamp: string, bike: string
  let trade: string

  beforeAll(async () => {
    tor = await makeUser('Tor')
    una = await makeUser('Una')
    vid = await makeUser('Vid')
    kayak = await makeItem(tor, 'Kajakk')
    lamp = await makeItem(una, 'Lampe')
    bike = await makeItem(vid, 'Sykkel')
    await like(tor, lamp)
    await like(una, bike)
    await like(vid, kayak)
    trade = await openTradeFromCycle(db, (await findCyclesThrough(db, vid, kayak))[0]!)
    const offer = await currentOffer(trade)
    for (const who of [tor, una, vid]) await acceptOffer(db, offer, who, 'terms-2026-09')
    expect(await tradeState(trade)).toBe('accepted')
  })

  test('8. Tor asks, and while the others answer, Vid sends his bike to Una', async () => {
    expect((await requestWithdrawal(db, trade, tor)).blocked).toBe(false)
    expect(await tradeState(trade)).toBe('paused')
    await markHandover(db, trade, vid, 'sent')
  })

  test('9. Una’s yes is then a no, because something is on its way, and the ring goes on', async () => {
    // 08a: «Har Ola allerede sendt, kan du ikke trekke deg», and that is true
    // of anybody but the one asking. Only the one answering was asked, so
    // Una's yes ended the ring with Vid's bike already sent.
    const answer = await respondToWithdrawal(db, trade, una, true)

    expect(answer).toMatchObject({ state: 'rejected', blockedBySent: true })
    expect(await tradeState(trade)).toBe('accepted')
    expect((await itemRow(kayak))['active_trade_id']).toBe(trade)
  })
})
