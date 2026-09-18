// FLOW — What a counter-offer is allowed to contain
//
// The rule this exists to pin down: an offer is a claim about who gives what,
// and every part of that claim has to be true. `docs/DESIGN.md`: «Each side of
// a hop is a list of 1–3 items», and the positions are seats in the ring, not
// numbers somebody typed.
//
// It matters more here than anywhere else in the product, because the offer is
// what the agreement screen reads out and what the acceptance is keyed to. An
// offer that names a listing its supposed giver does not own is a screen
// telling somebody they are about to receive a thing nobody is giving them.
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, reset } from '../helpers.js'

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
  return res.body!['token'] as string
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 300 },
  })
  return res.body!['id'] as string
}

describe('what a counter-offer may contain', () => {
  let ola = '', kari = '', per = ''
  let drill = '', tent = '', bike = ''
  let spare: string[] = []
  let tradeId = ''
  let mine = 0, theirs = 0

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    ola = await register('Ola N.', 'ola@epost.no')
    kari = await register('Kari N.', 'kari@epost.no')
    per = await register('Per N.', 'per@epost.no')

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')
    bike = await list(per, 'Bysykkel, dame')
    spare = [
      await list(ola, 'Sykkelhjelm'),
      await list(ola, 'Skateboard'),
      await list(ola, 'Ullgenser M'),
      await list(ola, 'Longboard'),
    ]

    await call('POST', `/items/${tent}/like`, { token: ola })
    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    tradeId = closing.body!['tradeId']

    const view = await call('GET', `/trades/${tradeId}`, { token: ola })
    mine = view.body!['you']['position']
    theirs = view.body!['receivingFrom']['position']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. an ordinary counter-offer is fine: two of mine against one of theirs', async () => {
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: spare[0]!, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(200)
    expect(res.body!['youGive']).toHaveLength(2)
    expect(res.body!['youGet']).toHaveLength(1)
  })

  test('2. a listing cannot be offered by somebody who does not own it', async () => {
    // Otherwise the agreement screen reads out «Du får Bysykkel fra Kari» for a
    // bicycle that is Per's and that Kari cannot give.
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: bike, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('not_theirs')
  })

  test('3. nor put your own listing on their side of the table', async () => {
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: spare[0]!, giverPosition: mine },
          { itemId: drill, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('not_theirs')
  })

  test('4. a position nobody sits in is not a place to give from', async () => {
    // Position 7 in a two-person trade is nobody. The offer row would be
    // written, the screens would never show it — and accepting it would
    // reserve the listing anyway.
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: 7 },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('no_such_position')
  })

  test('5. three things a side is the cap, and four is one too many', async () => {
    const four = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: spare[0]!, giverPosition: mine },
          { itemId: spare[1]!, giverPosition: mine },
          { itemId: spare[2]!, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })

    expect(four.status).toBe(400)
    expect(four.body!['code']).toBe('too_many_items')

    const three = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: spare[0]!, giverPosition: mine },
          { itemId: spare[1]!, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })
    expect(three.status).toBe(200)
    expect(three.body!['youGive']).toHaveLength(3)
  })

  test('6. a mellomlegg is between two people who are in the trade', async () => {
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
        cash: { payerPosition: mine, payeePosition: 5, amountNok: 200 },
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('no_such_position')
  })

  test('7. a retired listing cannot be put back on the table', async () => {
    const gone = await list(ola, 'Gammel sag')
    expect((await call('DELETE', `/items/${gone}`, { token: ola })).status).toBe(204)

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: gone, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('item_unavailable')
  })

  test('8. and neither can one another trade is already holding', async () => {
    // Ola's longboard goes into a trade with Per, and his acceptance locks it.
    // It is then not his to put on this table — 09b draws exactly that as
    // «reservert i annet bytte · Låst» rather than hiding it.
    const longboard = spare[3]!
    await call('POST', `/items/${bike}/like`, { token: ola })
    const withPer = (await call('POST', `/items/${longboard}/like`, { token: per }))
      .body!['tradeId']
    await call('POST', `/trades/${withPer}/accept`, { token: ola })

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: longboard, giverPosition: mine },
          { itemId: tent, giverPosition: theirs },
        ],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('item_unavailable')
  })

  test('9. somebody outside the trade cannot put anything on its table', async () => {
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: per,
      body: { items: [{ itemId: bike, giverPosition: 0 }] },
    })

    expect(res.status).toBe(403)
  })
})
