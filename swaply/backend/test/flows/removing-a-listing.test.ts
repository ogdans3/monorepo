// FLOW — Removing a listing that somebody is negotiating about
//
// The rule this exists to pin down: **«Fjern annonsen» takes the listing out of
// every negotiation it is on the table in.** Each one ends with the code
// `listing_removed` and words true for everybody in it, the others are told,
// and what those trades held goes back on the market for the search. A trade
// whose newest version no longer holds the listing is about something else
// and goes on; and a listing an owner's yes holds is part of a deal, so it is
// not removed at all — judged in the statement that removes it, so a yes in
// the same moment cannot leave a listing both removed and reserved.
//
// It used to be one update and nothing else. The trades stayed open around a
// thing that was no longer there, «Godta» on one agreed to receive it, and a
// listing removed while a trade held it came back `available` when the trade
// let go — into the cycle search, deleted. Those last two are rows the old
// route could leave behind, so they are refused and released properly too.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { close, db, itemRow, reset, tradeState } from '../helpers.js'

let app: FastifyInstance

type Json = Record<string, any>
type Person = { token: string; id: string }

async function call(method: string, url: string, opts: { token?: string; body?: Json } = {}) {
  const res = await app.inject({
    method: method as 'GET',
    url,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    ...(opts.body ? { payload: opts.body } : {}),
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

async function register(name: string): Promise<Person> {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  expect(res.status, name).toBe(201)
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

async function list(who: Person, title: string) {
  const res = await call('POST', '/items', {
    token: who.token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

async function heart(who: Person, itemId: string) {
  const res = await call('POST', `/items/${itemId}/like`, { token: who.token })
  expect(res.status).toBe(200)
  return res.body!['tradeId'] as string | null
}

async function told(who: Person, tradeId: string) {
  const res = await call('GET', '/notifications', { token: who.token })
  return (res.body!['notifications'] as Json[])
    .filter((n) => n['type'] === 'trade_cancelled' && n['payload']['tradeId'] === tradeId)
    .map((n) => n['payload'])
}

/** Two new people who want each other's things, and the trade the hearts open. */
async function pair(a: Person, b: Person) {
  const fromA = await list(a, `Ting fra ${a.id.slice(0, 4)}`)
  const fromB = await list(b, `Ting fra ${b.id.slice(0, 4)}`)
  expect(await heart(b, fromA)).toBeNull()
  const tradeId = (await heart(a, fromB))!
  return { tradeId, fromA, fromB }
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('removing a listing that is on the table', () => {
  let ola: Person, kari: Person, per: Person, liv: Person, una: Person
  let drill = '', saw = '', tent = '', bike = '', lamp = ''
  let withKari = '', withPer = '', withLiv = ''

  beforeAll(async () => {
    ola = await register('Ola')
    kari = await register('Kari')
    per = await register('Per')
    liv = await register('Liv')
    una = await register('Una')
    drill = await list(ola, 'Bosch drill 18V')
    saw = await list(ola, 'Stikksag')
    tent = await list(kari, 'Telt')
    bike = await list(per, 'Sykkel')
    lamp = await list(una, 'Byggelampe')
  })

  test('1. Kari and Per each want the drill, Ola wants theirs, and Liv writes about it', async () => {
    await heart(kari, drill)
    withKari = (await heart(ola, tent))!
    await heart(per, drill)
    withPer = (await heart(ola, bike))!
    withLiv = (await call('POST', `/items/${drill}/message`, {
      token: liv.token, body: { body: 'Er drillen ledig?' },
    })).body!['tradeId']

    for (const tradeId of [withKari, withPer, withLiv]) expect(tradeId).toBeTruthy()
  })

  test('2. in Per’s trade Ola puts the saw on the table instead of the drill', async () => {
    const view = (await call('GET', `/trades/${withPer}`, { token: ola.token })).body!
    const res = await call('POST', `/trades/${withPer}/counter`, {
      token: ola.token,
      body: {
        items: [
          { itemId: saw, giverPosition: view['you']['position'] },
          { itemId: bike, giverPosition: view['receivingFrom']['position'] },
        ],
      },
    })
    expect(res.status).toBe(200)
  })

  test('3. Kari says yes to hers, which holds her tent — and Una, who wants the tent, waits on it', async () => {
    expect((await call('POST', `/trades/${withKari}/accept`, { token: kari.token })).status).toBe(200)
    expect((await itemRow(tent))['active_trade_id']).toBe(withKari)

    // Una wants the tent and Kari the lamp, but a held tent closes no ring.
    await heart(una, tent)
    expect(await heart(kari, lamp)).toBeNull()
  })

  test('4. Ola removes the drill', async () => {
    expect((await call('DELETE', `/items/${drill}`, { token: ola.token })).status).toBe(204)
  })

  test('5. the two negotiations it was on the table in end, in words true for all', async () => {
    for (const [tradeId, who] of [[withKari, kari], [withLiv, liv]] as const) {
      const view = (await call('GET', `/trades/${tradeId}`, { token: who.token })).body!
      expect(view['state']).toBe('cancelled')
      expect(view['closeCode']).toBe('listing_removed')
      expect(view['closeReason']).toBe('En av tingene i byttet ble fjernet av eieren')
    }
  })

  test('6. Per’s, whose table no longer holds it, goes on', async () => {
    expect(await tradeState(withPer)).toBe('countered')
  })

  test('7. Kari and Liv are told, and Ola, who removed it, is not', async () => {
    expect(await told(kari, withKari)).toEqual([{ tradeId: withKari, reason: 'listing_removed' }])
    expect(await told(liv, withLiv)).toEqual([{ tradeId: withLiv, reason: 'listing_removed' }])
    expect(await told(ola, withKari)).toEqual([])
    expect(await told(ola, withLiv)).toEqual([])
  })

  test('8. Kari’s tent is back on the market, and the ring that waited for it opens', async () => {
    expect(await itemRow(tent)).toMatchObject({ status: 'available', active_trade_id: null })

    const waiting = (await call('GET', '/trades', { token: una.token })).body!['waiting'] as Json[]
    expect(waiting).toHaveLength(1)
    expect(waiting[0]!['youGet'].map((i: Json) => i['id'])).toEqual([tent])
  })

  test('9. a listing an owner’s yes holds is not removed, and nothing ends', async () => {
    expect((await call('POST', `/trades/${withPer}/accept`, { token: ola.token })).status).toBe(200)
    expect((await itemRow(saw))['active_trade_id']).toBe(withPer)

    const res = await call('DELETE', `/items/${saw}`, { token: ola.token })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ code: 'item_reserved', message: 'Gjenstanden er reservert i et bytte.' })
    expect((await itemRow(saw))['status']).toBe('reserved')
    expect(await tradeState(withPer)).toBe('countered')
  })

  test('10. removing it a second time changes nothing', async () => {
    expect((await call('DELETE', `/items/${drill}`, { token: ola.token })).status).toBe(204)
  })
})

describe('what the old route left behind', () => {
  test('11. a negotiation still holding a listing removed without ending it refuses a yes', async () => {
    const [siri, tor] = [await register('Siri'), await register('Tor')]
    const { tradeId, fromA } = await pair(siri, tor)
    // What removing a listing used to do, and all it did.
    await db.execute(sql`update items set deleted_at = now(), status = 'withdrawn' where id = ${fromA}`)

    const res = await call('POST', `/trades/${tradeId}/accept`, { token: tor.token })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      code: 'item_unavailable',
      message: 'En av tingene i forslaget er ikke tilgjengelig lenger.',
    })
    expect((await call('GET', `/trades/${tradeId}`, { token: tor.token })).body!['you']['accepted'])
      .toBe(false)
  })

  test('12. a listing removed while a trade held it goes back withdrawn, and no ring is found through it', async () => {
    const [vid, wenche, xan] = [await register('Vid'), await register('Wenche'), await register('Xan')]
    const { tradeId, fromA: oars } = await pair(vid, wenche)
    expect((await call('POST', `/trades/${tradeId}/accept`, { token: vid.token })).status).toBe(200)
    // Xan and Vid want each other's things too, but the oars are held.
    const sail = await list(xan, 'Seil')
    await heart(xan, oars)
    expect(await heart(vid, sail)).toBeNull()
    // The old race: removed between the check and the write, by then held.
    await db.execute(sql`update items set deleted_at = now() where id = ${oars}`)

    expect((await call('POST', `/trades/${tradeId}/decline`, { token: wenche.token })).status).toBe(200)

    expect(await itemRow(oars)).toMatchObject({ status: 'withdrawn', active_trade_id: null })
    expect(await sweepForCycles(db)).toEqual([])
    expect((await call('GET', '/trades', { token: xan.token })).body!['waiting']).toEqual([])
  })
})
