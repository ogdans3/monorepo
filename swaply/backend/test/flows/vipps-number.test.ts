// FLOW — The number a mellomlegg is paid to
//
// The rule this exists to pin down: **the payee's phone number is shown to the
// one who pays, and only once everybody has agreed** — accepted, paused on a
// withdrawal question, or completed. Before that nobody sees it, the payee
// included, who has no use for their own number.
//
// The number is on the trade so a mellomlegg can be sent by Vipps between the
// two of them; we show it and never touch it. It used to be on the trade for
// everybody in it and in every state, and anybody can be in a trade with a
// lister: write to them about their drill, propose a mellomlegg the lister
// would receive, and the answer to the proposal carried the lister's number.
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

async function register(name: string, phone: string) {
  const res = await call('POST', '/auth/register', {
    body: {
      displayName: name, email: `${name.split(' ')[0]!.toLowerCase()}@epost.no`,
      phone, password: 'byttehandel1', town: 'Trondheim',
    },
  })
  expect(res.status, name).toBe(201)
  return res.body!['token'] as string
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 600 },
  })
  return res.body!['id'] as string
}

async function phoneSeenBy(tradeId: string, token: string) {
  const res = await call('GET', `/trades/${tradeId}`, { token })
  expect(res.status).toBe(200)
  return res.body!['cash']?.['payeePhone'] ?? null
}

describe('the number a mellomlegg is paid to', () => {
  let ola = '', per = ''
  let drill = '', bike = ''
  let tradeId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await register('Ola N.', '412 34 567')
    per = await register('Per N.', '922 33 444')
    drill = await list(ola, 'Bosch drill 18V')
    bike = await list(per, 'Bysykkel, dame')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Per writes to Ola about the drill, which is all it takes to be in a trade with him', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: per, body: { body: 'Hei! Er drillen ledig?' },
    })
    expect(res.status).toBe(201)
    tradeId = res.body!['tradeId']
  })

  test('2. a mellomlegg Per proposes paying Ola does not hand Per the number', async () => {
    const view = await call('GET', `/trades/${tradeId}`, { token: per })
    const mine = view.body!['you']['position']
    const his = view.body!['receivingFrom']['position']

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: per,
      body: {
        items: [
          { itemId: bike, giverPosition: mine },
          { itemId: drill, giverPosition: his },
        ],
        cash: { payerPosition: mine, payeePosition: his, amountNok: 100 },
      },
    })

    expect(res.status).toBe(200)
    expect(res.body!['cash']).toMatchObject({ amountNok: 100, youPay: true, payeePhone: null })
  })

  test('3. nor does the trade, read again, for either of them', async () => {
    expect(await phoneSeenBy(tradeId, per)).toBeNull()
    expect(await phoneSeenBy(tradeId, ola)).toBeNull()
  })

  test('4. one yes is not an agreement, and still shows nothing', async () => {
    expect((await call('POST', `/trades/${tradeId}/accept`, { token: ola })).status).toBe(200)

    expect(await phoneSeenBy(tradeId, per)).toBeNull()
  })

  test('5. once both have agreed, the one who pays sees the number, and only he does', async () => {
    expect((await call('POST', `/trades/${tradeId}/accept`, { token: per })).status).toBe(200)

    expect(await phoneSeenBy(tradeId, per)).toBe('412 34 567')
    expect(await phoneSeenBy(tradeId, ola)).toBeNull()
  })

  test('6. paused on a withdrawal question it is still an agreement, and still shown', async () => {
    expect((await call('POST', `/trades/${tradeId}/withdrawal`, { token: ola })).status).toBe(200)

    expect(await phoneSeenBy(tradeId, per)).toBe('412 34 567')
    expect(await phoneSeenBy(tradeId, ola)).toBeNull()
  })

  test('7. and once it is done, the payer keeps it on the record', async () => {
    expect((await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: ola })).status).toBe(200)
    for (const token of [ola, per]) {
      for (const marker of ['sent', 'received']) {
        await call('POST', `/trades/${tradeId}/mark`, { token, body: { marker } })
      }
    }

    expect((await call('GET', `/trades/${tradeId}`, { token: per })).body!['state']).toBe('completed')
    expect(await phoneSeenBy(tradeId, per)).toBe('412 34 567')
    expect(await phoneSeenBy(tradeId, ola)).toBeNull()
  })
})
