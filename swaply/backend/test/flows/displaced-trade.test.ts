// FLOW — Two trades, one drill, and what the loser was holding
//
// The rule this exists to pin down: closing a trade because somebody else took
// a listing it was counting on has to let go of everything *that* trade was
// holding. Whoever had already accepted in it locked their own things, and a
// listing reserved by a cancelled trade is one nothing will ever free again.
//
// `reservation-race.test.ts` is the same race one level down, against the
// engine. This one is over HTTP, because the release happens on the way out of
// the accept route and the re-search happens after it.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, itemRow, reset, tradeState } from '../helpers.js'

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

async function register(name: string, email: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1', town: 'Trondheim' },
  })
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string, category = 'verktoy') {
  const res = await call('POST', '/items', {
    token,
    body: { title, category, condition: 'good', estimatedValueNok: 600 },
  })
  return res.body!['id'] as string
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('a trade that loses the race lets go of what it was holding', () => {
  let ola = '', kari = '', per = ''
  let drill = '', tent = '', bike = ''
  let withKari = '', withPer = ''

  beforeAll(async () => {
    ola = (await register('Ola N.', 'ola@epost.no')).token
    kari = (await register('Kari N.', 'kari@epost.no')).token
    per = (await register('Per N.', 'per@epost.no')).token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')
    bike = await list(per, 'Bysykkel, dame')

    // Two live proposals for the one drill, which is allowed: it is the
    // owner's choice, not a race won by whoever asked first.
    await call('POST', `/items/${tent}/like`, { token: ola })
    withKari = (await call('POST', `/items/${drill}/like`, { token: kari })).body!['tradeId']
    await call('POST', `/items/${bike}/like`, { token: ola })
    withPer = (await call('POST', `/items/${drill}/like`, { token: per })).body!['tradeId']
  })

  test('1. Per accepts first, and his bicycle is locked to that trade', async () => {
    await call('POST', `/trades/${withPer}/accept`, { token: per })

    expect((await itemRow(bike))['active_trade_id']).toBe(withPer)
    expect((await itemRow(drill))['active_trade_id']).toBeNull()
  })

  test('2. Ola gives the drill to Kari instead, which closes Per’s trade', async () => {
    await call('POST', `/trades/${withKari}/accept`, { token: ola })

    expect(await tradeState(withPer)).toBe('cancelled')
    expect((await itemRow(drill))['active_trade_id']).toBe(withKari)
  })

  test('3. and Per’s bicycle is on the market again, not held by a dead trade', async () => {
    const row = await itemRow(bike)

    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
  })

  test('3b. a yes sent again changes nothing: a conversation opened since about the drill goes on', async () => {
    // The drill is held for Kari's trade, and a held thing is still on the
    // market: Per writes to Ola about it, in case that trade falls through.
    // Then Ola's yes arrives a second time — a double press, or a retry
    // after the first answer was lost — and it used to push Per's
    // conversation out as displaced, tell Kari «Ola godtok byttet» again and
    // move the time of the yes.
    const asking = await call('POST', `/items/${drill}/message`, {
      token: per, body: { body: 'Si fra om drillen blir ledig igjen.' },
    })
    expect(asking.status).toBe(201)
    const told = async () =>
      (await call('GET', '/notifications', { token: kari })).body!['notifications'].length
    const before = await told()
    const [first] = await db.execute<Record<string, string>>(
      sql`select a.accepted_at::text as at from trade_acceptances a
          join trade_offers o on o.id = a.offer_id
          join users u on u.id = a.user_id
          where o.trade_id = ${withKari} and u.email = 'ola@epost.no'`,
    )

    const again = await call('POST', `/trades/${withKari}/accept`, { token: ola })

    expect(again.status).toBe(200)
    expect(again.body!['alreadyAccepted']).toBe(true)
    expect(again.body!['displaced']).toEqual([])
    expect(await tradeState(asking.body!['tradeId'])).toBe('talking')
    expect(await told()).toBe(before)
    const [second] = await db.execute<Record<string, string>>(
      sql`select a.accepted_at::text as at from trade_acceptances a
          join trade_offers o on o.id = a.offer_id
          join users u on u.id = a.user_id
          where o.trade_id = ${withKari} and u.email = 'ola@epost.no'`,
    )
    expect(second!['at']).toBe(first!['at'])
  })
})

describe('a trade whose table no longer holds the thing is not pushed out by it', () => {
  // The table is the newest version (`removeListings`, the sweep): a thing a
  // counter-offer dropped is back on the market, and the version that named
  // it is history. A yes elsewhere used to push out every trade that had the
  // thing in any version, so a negotiation about something else entirely
  // ended «En gjenstand i byttet ble reservert av et annet bytte».
  let siri = '', tor = '', una = ''
  let skis = '', saw = '', kayak = '', tent = ''
  let withTor = '', withUna = ''

  beforeAll(async () => {
    siri = (await register('Siri N.', 'siri@epost.no')).token
    tor = (await register('Tor N.', 'tor@epost.no')).token
    una = (await register('Una N.', 'una@epost.no')).token
    skis = await list(siri, 'Langrennski')
    saw = await list(siri, 'Stikksag')
    kayak = await list(tor, 'Kajakk')
    tent = await list(una, 'Telt, 2 personer')

    await call('POST', `/items/${kayak}/like`, { token: siri })
    withTor = (await call('POST', `/items/${skis}/like`, { token: tor })).body!['tradeId']
    await call('POST', `/items/${tent}/like`, { token: siri })
    withUna = (await call('POST', `/items/${skis}/like`, { token: una })).body!['tradeId']
  })

  test('4. Siri and Tor go on talking about the saw instead of the skis', async () => {
    const view = (await call('GET', `/trades/${withTor}`, { token: siri })).body!
    const res = await call('POST', `/trades/${withTor}/counter`, {
      token: siri,
      body: {
        items: [
          { itemId: saw, giverPosition: view['you']['position'] },
          { itemId: kayak, giverPosition: view['receivingFrom']['position'] },
        ],
      },
    })
    expect(res.status).toBe(200)
    expect(res.body!['youGive'].map((i: Json) => i['title'])).toEqual(['Stikksag'])
  })

  test('5. her yes to Una holds the skis, and the trade about the saw goes on', async () => {
    const res = await call('POST', `/trades/${withUna}/accept`, { token: siri })

    expect(res.status).toBe(200)
    expect(res.body!['displaced']).toEqual([])
    expect((await itemRow(skis))['active_trade_id']).toBe(withUna)
    expect(await tradeState(withTor)).toBe('countered')
  })
})
