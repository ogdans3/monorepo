// FLOW — A two-way trade, from the first like to a completed swap
//
// The shortest complete path through the product, and the one every other flow
// is a variation on. Ola has a drill, Kari has a tent, and each wants what the
// other has. Nothing is reserved until an owner says yes, and when it is over
// the trade holds its own copy of what changed hands.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { findCyclesThrough } from '../../src/trades/cycles.js'
import { acceptOffer, completeTrade, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, itemRow, like, makeItem, makeUser, reset, tradeState } from '../helpers.js'

describe('a two-way trade', () => {
  let ola: string, kari: string, drill: string, tent: string, trade: string, offer: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    drill = await makeItem(ola, 'Bosch drill 18V', { value: 600, photo: 'https://img/drill.webp' })
    tent = await makeItem(kari, 'Telt, 3 personer', { value: 700 })
  })

  afterAll(close)

  test('1. Ola wants the tent, and one wish closes nothing', async () => {
    await like(ola, tent)

    expect(await findCyclesThrough(db, ola, tent)).toEqual([])
  })

  test('2. Kari wants the drill, and the loop closes', async () => {
    await like(kari, drill)

    const cycles = await findCyclesThrough(db, kari, drill)

    expect(cycles).toHaveLength(1)
    // Goods travel against the wishes: Kari gives the tent, Ola gives the drill.
    expect(cycles[0]).toEqual([
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
  })

  test('3. the trade opens as pending, holding nothing', async () => {
    const cycles = await findCyclesThrough(db, kari, drill)
    trade = await openTradeFromCycle(db, cycles[0]!)
    offer = await currentOffer(trade)

    expect(await tradeState(trade)).toBe('pending')
    expect((await itemRow(drill))['active_trade_id']).toBeNull()
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
  })

  test('4. a trade always comes with its thread', async () => {
    const rows = await db.execute(
      sql`select user_id from thread_participants tp
          join threads t on t.id = tp.thread_id where t.trade_id = ${trade}`,
    )
    expect(rows).toHaveLength(2)
  })

  test('5. Ola accepts, and only Ola’s drill is reserved', async () => {
    const result = await acceptOffer(db, offer, ola, 'terms-2026-09')

    expect(result.reserved).toEqual([drill])
    expect(result.everyoneAccepted).toBe(false)
    expect(await tradeState(trade)).toBe('pending')
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
  })

  test('6. Kari accepts, and the trade is agreed', async () => {
    const result = await acceptOffer(db, offer, kari, 'terms-2026-09')

    expect(result.reserved).toEqual([tent])
    expect(result.everyoneAccepted).toBe(true)
    expect(await tradeState(trade)).toBe('accepted')
  })

  test('7. completing it takes the copy that outlives the listings', async () => {
    await completeTrade(db, trade)

    expect(await tradeState(trade)).toBe('completed')
    expect((await itemRow(drill))['status']).toBe('traded')

    const snapshots = await db.execute<Record<string, string | null>>(
      sql`select title, cover_url, estimated_value_nok
          from trade_item_snapshots where trade_id = ${trade} order by giver_position`,
    )
    expect(snapshots.map((s) => s['title'])).toEqual(['Telt, 3 personer', 'Bosch drill 18V'])
    expect(snapshots[1]!['cover_url']).toBe('https://img/drill.webp')
  })

  test('8. the listing cannot be hard-deleted out from under the record', async () => {
    // The offer rows are history too, so the database refuses. Listings that
    // have been in a trade are retired, not removed.
    await expect(db.execute(sql`delete from items where id = ${drill}`)).rejects.toThrow()
  })

  test('9. retiring the listing leaves the history standing', async () => {
    await db.execute(
      sql`update items set deleted_at = now(), description = null where id = ${drill}`,
    )

    const snapshots = await db.execute<Record<string, string | null>>(
      sql`select title from trade_item_snapshots where trade_id = ${trade} order by giver_position`,
    )
    expect(snapshots.map((s) => s['title'])).toEqual(['Telt, 3 personer', 'Bosch drill 18V'])
  })
})
