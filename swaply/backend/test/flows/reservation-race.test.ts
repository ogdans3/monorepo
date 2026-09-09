// FLOW — Two trades want the same drill
//
// The rule this exists to pin down: an item is reserved by *its own owner's*
// acceptance, and never earlier. Anything sooner and a stranger could freeze
// your things by saying hello. When the lock lands, the trade that loses is
// closed with a reason in words rather than quietly disappearing.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { acceptOffer, cancelTrade, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, itemRow, makeItem, makeUser, reset, tradeState } from '../helpers.js'

describe('two trades wanting the same drill', () => {
  let ola: string, kari: string, per: string
  let drill: string, tent: string, bike: string
  let withKari: string, withPer: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt')
    bike = await makeItem(per, 'Sykkel')

    // Two live proposals for the one drill. This is allowed on purpose: it is
    // the owner's choice, not a race the first suitor wins by arriving.
    withKari = await openTradeFromCycle(db, [
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
    withPer = await openTradeFromCycle(db, [
      { userId: per, givesItemId: bike },
      { userId: ola, givesItemId: drill },
    ])
  })

  afterAll(close)

  test('1. both proposals stand, and the drill is still free', async () => {
    expect(await tradeState(withKari)).toBe('pending')
    expect(await tradeState(withPer)).toBe('pending')
    expect((await itemRow(drill))['active_trade_id']).toBeNull()
  })

  test('2. Kari accepting does not touch the drill — it is not hers', async () => {
    const result = await acceptOffer(db, await currentOffer(withKari), kari, 'terms-2026-09')

    expect(result.reserved).toEqual([tent])
    expect(result.displaced).toEqual([])
    expect((await itemRow(drill))['active_trade_id']).toBeNull()
  })

  test('3. Ola accepting is what locks the drill, and it closes the other trade', async () => {
    const result = await acceptOffer(db, await currentOffer(withKari), ola, 'terms-2026-09')

    expect(result.reserved).toEqual([drill])
    expect(result.displaced).toEqual([withPer])
    expect((await itemRow(drill))['active_trade_id']).toBe(withKari)
  })

  test('4. the loser is closed with a reason a person can read', async () => {
    expect(await tradeState(withPer)).toBe('cancelled')

    const [row] = await db.execute<Record<string, string | null>>(
      sql`select close_reason from trades where id = ${withPer}`,
    )
    expect(row!['close_reason']).toBe(
      'En gjenstand i byttet ble reservert av et annet bytte',
    )
  })

  test('5. a locked item cannot be taken by a second trade', async () => {
    const revived = await openTradeFromCycle(db, [
      { userId: per, givesItemId: bike },
      { userId: ola, givesItemId: drill },
    ])

    await expect(
      acceptOffer(db, await currentOffer(revived), ola, 'terms-2026-09'),
    ).rejects.toThrow(/already reserved/)
  })

  test('6. cancelling the winner puts the drill back on the market', async () => {
    await cancelTrade(db, withKari, 'Ola trakk seg')

    const row = await itemRow(drill)
    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
  })
})
