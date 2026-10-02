// FLOW — A counter-offer, and why acceptance belongs to a version
//
// The single easiest thing to model wrong. If acceptance hangs off the trade,
// a counter-offer silently invalidates what someone already agreed to, and they
// end up bound to a deal they never saw. Offers are immutable versions, and an
// acceptance names the version it was given for.
//
// The other half follows from it: a reservation *is* an owner's acceptance, so
// it belongs to the version too. A counter-offer lets go of everything the
// trade held for the version before, and the things go back on the market
// where the cycle search can find them; and completing a trade marks as traded
// only what its final version gives. A counter-offer used to release nothing,
// so a drill dropped from the deal stayed held — and completing the trade
// marked it traded.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import {
  acceptOffer,
  completeTrade,
  openTradeFromCycle,
  proposeCounterOffer,
} from '../../src/trades/trades.js'
import { close, currentOffer, db, itemRow, makeItem, makeUser, reset, tradeState } from '../helpers.js'

afterAll(close)

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

  test('1. Ola accepts the first version, and his drill is held for it', async () => {
    const result = await acceptOffer(db, v1, ola, 'terms-2026-09')

    expect(result.everyoneAccepted).toBe(false)
    expect(await tradeState(trade)).toBe('pending')
    expect((await itemRow(drill))['active_trade_id']).toBe(trade)
  })

  test('2. Kari counters: two things and 200 kroner, rather than one', async () => {
    const countered = await proposeCounterOffer(
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
    v2 = countered.offerId

    expect(v2).not.toBe(v1)
    expect(await tradeState(trade)).toBe('countered')
    // What the trade held for version one, it let go of.
    expect(countered.freed).toEqual([drill])
  })

  test('3. Ola’s acceptance stayed on version one — it does not carry over', async () => {
    const live = await db.execute(
      sql`select 1 from trade_acceptances where offer_id = ${v2} and revoked_at is null`,
    )
    expect(live).toHaveLength(0)

    const onV1 = await db.execute(sql`select 1 from trade_acceptances where offer_id = ${v1}`)
    expect(onV1).toHaveLength(1)
  })

  test('3b. and neither does the reservation, which was that acceptance', async () => {
    // He said yes to one drill for one tent. Holding the drill now would be
    // holding it for a deal he has not seen.
    const row = await itemRow(drill)
    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
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
    for (const id of [drill, tent, lamp]) {
      expect((await itemRow(id))['active_trade_id']).toBe(trade)
    }
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

  test('7. completing it marks as traded what the final version gives, and nothing else', async () => {
    // A listing still held for an earlier version, the way a counter-offer
    // made before it let go of anything left one.
    const saw = await makeItem(ola, 'Stikksag')
    await db.execute(
      sql`update items set active_trade_id = ${trade}, status = 'reserved' where id = ${saw}`,
    )

    const freed = await completeTrade(db, trade)

    expect(await tradeState(trade)).toBe('completed')
    for (const id of [drill, tent, lamp]) {
      expect((await itemRow(id))['status']).toBe('traded')
    }
    expect(freed).toEqual([saw])
    expect(await itemRow(saw)).toMatchObject({ status: 'available', active_trade_id: null })
  })
})

describe('a counter-offer that drops something already promised, over HTTP', () => {
  let app: FastifyInstance
  type Json = Record<string, any>

  async function call(method: string, url: string, opts: { token?: string; body?: Json } = {}) {
    const res = await app.inject({
      method: method as 'GET',
      url,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      ...(opts.body ? { payload: opts.body } : {}),
    })
    return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
  }

  async function register(name: string) {
    const res = await call('POST', '/auth/register', {
      body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
    })
    return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
  }

  async function list(token: string, title: string) {
    const res = await call('POST', '/items', {
      token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
    })
    return res.body!['id'] as string
  }

  let ola = { token: '', id: '' }, kari = { token: '', id: '' }, per = { token: '', id: '' }
  let drill = '', saw = '', tent = '', bike = ''
  let tradeId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await register('Ola')
    kari = await register('Kari')
    per = await register('Per')
    drill = await list(ola.token, 'Bosch drill 18V')
    saw = await list(ola.token, 'Stikksag')
    tent = await list(kari.token, 'Telt')
    bike = await list(per.token, 'Sykkel')

    await call('POST', `/items/${tent}/like`, { token: ola.token })
    tradeId = (await call('POST', `/items/${drill}/like`, { token: kari.token })).body!['tradeId']
  })

  afterAll(async () => {
    await app.close()
  })

  test('8. Ola says yes to the drill for the tent, and the drill is held', async () => {
    expect((await call('POST', `/trades/${tradeId}/accept`, { token: ola.token })).status).toBe(200)
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
  })

  test('9. Per and Ola want each other’s things, but a held drill closes no ring', async () => {
    await call('POST', `/items/${drill}/like`, { token: per.token })
    const heart = await call('POST', `/items/${bike}/like`, { token: ola.token })

    expect(heart.body!['tradeId']).toBeNull()
  })

  test('10. Kari asks for the saw instead, and the drill goes back on the market at once', async () => {
    const view = await call('GET', `/trades/${tradeId}`, { token: kari.token })
    const mine = view.body!['you']['position']
    const his = view.body!['receivingFrom']['position']

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: kari.token,
      body: { items: [{ itemId: tent, giverPosition: mine }, { itemId: saw, giverPosition: his }] },
    })

    expect(res.status).toBe(200)
    expect(await itemRow(drill)).toMatchObject({ status: 'available', active_trade_id: null })
  })

  test('11. and the search runs over it: the ring between Per and Ola opens', async () => {
    const waiting = (await call('GET', '/trades', { token: per.token })).body!['waiting'] as Json[]

    expect(waiting).toHaveLength(1)
    expect(waiting[0]!['youGet'].map((i: Json) => i['id'])).toEqual([drill])
    expect(waiting[0]!['youGive'].map((i: Json) => i['id'])).toEqual([bike])
  })

  test('12. Kari’s deal goes through, and the drill was never part of it', async () => {
    for (const who of [ola, kari]) {
      expect((await call('POST', `/trades/${tradeId}/accept`, { token: who.token })).status).toBe(200)
    }
    for (const who of [ola, kari]) {
      for (const marker of ['sent', 'received']) {
        await call('POST', `/trades/${tradeId}/mark`, { token: who.token, body: { marker } })
      }
    }

    expect(await tradeState(tradeId)).toBe('completed')
    expect((await itemRow(saw))['status']).toBe('traded')
    expect((await itemRow(drill))['status']).toBe('available')
  })
})
