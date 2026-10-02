// FLOW — What is waiting on you (the badge on Bytter)
//
// The rule this exists to pin down: **the badge on Bytter counts every trade
// that is waiting for an answer from you.** A deal you could say yes to and
// have not, which is «Din tur» on screen 11 — and a question to withdraw that
// somebody else asked. That one pauses an agreed trade for 72 hours on an
// answer that may be yours, and it used to wait with no badge at all, so the
// first anybody heard of it was the deadline passing.
//
// Your own question waits on somebody else, and is not counted for you.
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

async function register(name: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  return res.body!['token'] as string
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

describe('what is waiting on you', () => {
  let ola = '', kari = ''
  let tradeId = ''

  const badge = async (token: string) =>
    (await call('GET', '/me', { token })).body!['tradesNeedingYou'] as number

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await register('Ola')
    kari = await register('Kari')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a loop closes, and the deal waits on both of them', async () => {
    const drill = await list(ola, 'Bosch drill 18V')
    const tent = await list(kari, 'Telt')
    await call('POST', `/items/${tent}/like`, { token: ola })
    tradeId = (await call('POST', `/items/${drill}/like`, { token: kari })).body!['tradeId']

    expect(await badge(ola)).toBe(1)
    expect(await badge(kari)).toBe(1)
  })

  test('2. each yes takes it off that person\'s badge, and the trade is agreed', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: ola, body: { termsVersion: '2026-09-06' } })
    expect(await badge(ola)).toBe(0)
    expect(await badge(kari)).toBe(1)

    const res = await call('POST', `/trades/${tradeId}/accept`, {
      token: kari, body: { termsVersion: '2026-09-06' },
    })
    expect(res.body!['trade']['state']).toBe('accepted')
    expect(await badge(kari)).toBe(0)
  })

  test('3. Ola asks to withdraw, and it is Kari\'s to answer: on her badge, not on his', async () => {
    const res = await call('POST', `/trades/${tradeId}/withdrawal`, { token: ola })
    expect(res.body!['trade']['state']).toBe('paused')

    expect(await badge(kari)).toBe(1)
    expect(await badge(ola)).toBe(0)
  })

  test('4. her no answers it, and the badge goes', async () => {
    const res = await call('POST', `/trades/${tradeId}/withdrawal/respond`, {
      token: kari, body: { approve: false },
    })
    expect(res.body!['trade']['state']).toBe('accepted')

    expect(await badge(kari)).toBe(0)
  })

  test('5. so does a question its asker takes back', async () => {
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: ola })
    expect(await badge(kari)).toBe(1)

    await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: ola })
    expect(await badge(kari)).toBe(0)
  })
})
