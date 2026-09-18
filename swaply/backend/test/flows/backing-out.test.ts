// FLOW — Taking a yes back, and the doors that are shut once it is given
//
// The rule this exists to pin down: an acceptance and a reservation are the
// same act, so undoing one undoes the other. Your yes is what locks your
// things; taking it back has to unlock them, or a listing is frozen by a
// promise nobody is making any more.
//
// Around that sit the three ways out of a trade, and they are not
// interchangeable. While it is still being negotiated you may decline or
// simply withdraw. Once everybody has accepted, the only way out is the
// negotiation on 08a–08c — so decline, withdraw and counter-offer are all
// refused there rather than quietly going around it.
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

describe('taking a yes back', () => {
  let ola = '', kari = ''
  let drill = '', tent = ''
  let tradeId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    ola = a.token
    kari = b.token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')

    await call('POST', `/items/${tent}/like`, { token: ola })
    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    tradeId = closing.body!['tradeId']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. nothing is marked sent before anybody has accepted', async () => {
    // 06f is the screen these buttons live on, and it only exists once the
    // trade is agreed. Marking a thing sent earlier would close the door on
    // withdrawing from something nobody has said yes to.
    const res = await call('POST', `/trades/${tradeId}/mark`, {
      token: ola, body: { marker: 'sent' },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_accepted')
  })

  test('2. Ola accepts, and the drill is his answer made concrete', async () => {
    const res = await call('POST', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(200)
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
  })

  test('3. de-accepting gives the drill back', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(200)
    expect(res.body!['you']['accepted']).toBe(false)

    const row = await itemRow(drill)
    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
  })

  test('4. de-accepting twice is a refusal, not a second undo', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_accepted')
  })

  test('5. both accept, and any single de-accept holds the whole trade', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: ola })
    await call('POST', `/trades/${tradeId}/accept`, { token: kari })
    expect(await tradeState(tradeId)).toBe('accepted')

    await call('DELETE', `/trades/${tradeId}/accept`, { token: kari })

    expect(await tradeState(tradeId)).toBe('pending')
    // Kari's tent comes back; Ola's yes, and his drill, stay where they were.
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
  })

  test('6. an agreed trade cannot be declined out from under the other side', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: kari })
    expect(await tradeState(tradeId)).toBe('accepted')

    const declined = await call('POST', `/trades/${tradeId}/decline`, { token: ola })
    expect(declined.status).toBe(409)
    expect(declined.body!['code']).toBe('needs_permission')

    const withdrawn = await call('POST', `/trades/${tradeId}/withdraw-early`, { token: ola })
    expect(withdrawn.status).toBe(409)

    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('7. nor counter-offered, which would undo everyone’s acceptance', async () => {
    const before = await call('GET', `/trades/${tradeId}`, { token: ola })
    const mine = before.body!['you']['position']

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola, body: { items: [{ itemId: drill, giverPosition: mine }] },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_negotiable')
    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('8. once something is sent, the yes is no longer yours to take back', async () => {
    await call('POST', `/trades/${tradeId}/mark`, { token: ola, body: { marker: 'sent' } })

    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('already_sent')
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
  })
})
