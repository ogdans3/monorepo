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

describe('a trade that loses the race lets go of what it was holding', () => {
  let ola = '', kari = '', per = ''
  let drill = '', tent = '', bike = ''
  let withKari = '', withPer = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

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

  afterAll(async () => {
    await app.close()
    await close()
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
})
