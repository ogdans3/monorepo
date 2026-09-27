// FLOW — Taking a heart back and pressing it again
//
// The rule this exists to pin down: **a heart that finds a ring somebody is
// already negotiating is answered with that trade, says it is not new, and
// never opens the ring a second time.** A pending trade reserves nothing, so
// after «unlike» and «like» the search found the very ring the first heart
// had opened, and opened it again: a second trade, a second thread, and a
// second «Dere kan swappe!» to the same people about the same things. The
// answer still names the trade, and `tradeIsNew` is what keeps the app from
// celebrating it on the presser's phone a second time.
//
// And the half that must not be lost on the way: **a different ring over the
// same listing still opens.** Several pending trades may want one drill — the
// owner's acceptance is what decides between them — so the check is for the
// same ring, not the sweep's one-new-trade-per-listing rule. Once the trade
// over a ring has ended, the ring is free to be found again.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { issueSession } from '../../src/auth/sessions.js'
import { declineTrade } from '../../src/trades/actions.js'
import { proposeCounterOffer } from '../../src/trades/trades.js'
import { expressWish } from '../../src/trades/wish.js'
import { close, db, like, makeItem, makeUser, reset, tradeState } from '../helpers.js'

type Row = Record<string, string>

async function unlike(userId: string, itemId: string) {
  await db.execute(sql`delete from likes where from_user = ${userId} and target_item = ${itemId}`)
}

/** Trades still going on that have both of these people in them. */
async function openBetween(a: string, b: string): Promise<string[]> {
  const rows = await db.execute<Row>(
    sql`select t.id from trades t
        where t.state not in ('completed', 'cancelled')
          and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${a})
          and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${b})
        order by t.created_at`,
  )
  return rows.map((r) => r['id']!)
}

async function opened(userId: string): Promise<number> {
  const [row] = await db.execute<Row>(
    sql`select count(*) as n from notifications where user_id = ${userId} and type = 'trade_opened'`,
  )
  return Number(row!['n'])
}

describe('taking a heart back and pressing it again', () => {
  let app: FastifyInstance
  let ola: string, kari: string, per: string
  let drill: string, tent: string, saw: string
  let first: string

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt')
    saw = await makeItem(per, 'Stikksag')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Kari wants the drill, and Ola’s heart on her tent opens a trade', async () => {
    await like(kari, drill)

    const wish = await expressWish(db, ola, tent)

    expect(wish.tradeId).not.toBeNull()
    expect(wish.tradeIsNew).toBe(true)
    expect(await tradeState(wish.tradeId!)).toBe('pending')
    first = wish.tradeId!
  })

  test('2. he takes the heart back and presses it again: he is shown the same trade, as not new', async () => {
    await unlike(ola, tent)

    const again = await expressWish(db, ola, tent)

    expect(again.tradeId).toBe(first)
    expect(again.tradeIsNew).toBe(false)
  })

  test('3. and no second trade opened, and nobody was told twice', async () => {
    expect(await openBetween(ola, kari)).toEqual([first])
    expect(await opened(kari)).toBe(1)
    expect(await opened(ola)).toBe(1)
  })

  test('3b. the heart on the phone says so too: the trade, and that it is not new', async () => {
    await unlike(ola, tent)

    const res = await app.inject({
      method: 'POST',
      url: `/items/${tent}/like`,
      headers: { authorization: `Bearer ${await issueSession(db, ola)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ liked: true, tradeId: first, tradeIsNew: false })
    expect(await openBetween(ola, kari)).toEqual([first])
    expect(await opened(kari)).toBe(1)
  })

  test('4. a counter-offer that keeps the swap and adds a mellomlegg is still that ring', async () => {
    // Opened from Ola's heart: he is position 0 and gives the drill, Kari is
    // position 1 and gives the tent.
    await proposeCounterOffer(
      db,
      first,
      kari,
      [
        { itemId: drill, giverPosition: 0 },
        { itemId: tent, giverPosition: 1 },
      ],
      { payerPosition: 0, payeePosition: 1, amountNok: 200 },
    )
    expect(await tradeState(first)).toBe('countered')

    await unlike(ola, tent)
    const again = await expressWish(db, ola, tent)

    expect(again.tradeId).toBe(first)
    expect(again.tradeIsNew).toBe(false)
    expect(await openBetween(ola, kari)).toEqual([first])
  })

  test('5. another ring over the same drill still opens: several trades may want one listing', async () => {
    await like(per, drill)

    const wish = await expressWish(db, ola, saw)

    expect(wish.tradeId).not.toBeNull()
    expect(wish.tradeId).not.toBe(first)
    expect(wish.tradeIsNew).toBe(true)
    expect(await tradeState(wish.tradeId!)).toBe('pending')
    expect(await tradeState(first)).toBe('countered')
  })

  test('6. once the trade over the ring has ended, pressing the heart again opens it anew', async () => {
    await declineTrade(db, first, kari)
    expect(await tradeState(first)).toBe('cancelled')

    await unlike(ola, tent)
    const again = await expressWish(db, ola, tent)

    expect(again.tradeId).not.toBeNull()
    expect(again.tradeId).not.toBe(first)
    expect(again.tradeIsNew).toBe(true)
    expect(await openBetween(ola, kari)).toEqual([again.tradeId])
  })

  describe('in a ring of three', () => {
    let tor: string, una: string, vid: string
    let kayak: string, lamp: string, bike: string
    let ring: string

    beforeAll(async () => {
      tor = await makeUser('Tor')
      una = await makeUser('Una')
      vid = await makeUser('Vid')
      kayak = await makeItem(tor, 'Kajakk')
      lamp = await makeItem(una, 'Lampe')
      bike = await makeItem(vid, 'Sykkel')
    })

    test('7. Tor wants the lamp, Una the bike, Vid the kayak: Tor’s heart closes the ring', async () => {
      await like(una, bike)
      await like(vid, kayak)

      const wish = await expressWish(db, tor, lamp)

      expect(wish.tradeId).not.toBeNull()
      expect(wish.tradeIsNew).toBe(true)
      ring = wish.tradeId!
    })

    test('8. Vid takes his heart back and presses it again: the same trade, seen from his seat', async () => {
      // The search starts the ring from whoever pressed, so the ring it finds
      // now begins with Vid rather than with Tor. It is the same ring.
      await unlike(vid, kayak)

      const again = await expressWish(db, vid, kayak)

      expect(again.tradeId).toBe(ring)
      expect(again.tradeIsNew).toBe(false)
      expect(await openBetween(tor, vid)).toEqual([ring])
    })
  })
})
