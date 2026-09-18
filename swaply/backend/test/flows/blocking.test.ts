// FLOW — Blocking somebody, and what it is worth
//
// The rule this exists to pin down: `docs/DESIGN.md` says a block means
// «blocked users' items are hidden and can't match». In a matching product
// that has to hold in both directions and on every surface, or it is a setting
// rather than a protection: hidden on Oppdag but reachable from a profile,
// or unable to match directly but able to arrive through a chain, or unable to
// match at all but able to open a conversation.
//
// Blocking is also not reporting. Reports are reviewed by a person and outlive
// the reported user; a block is immediate and is the blocker's own.
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
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

describe('blocking somebody', () => {
  let ola = '', kari = '', per = ''
  let olaId = '', kariId = ''
  let drill = '', tent = '', bike = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    const c = await register('Per N.', 'per@epost.no')
    ;[ola, olaId] = [a.token, a.id]
    ;[kari, kariId] = [b.token, b.id]
    per = c.token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')
    bike = await list(per, 'Bysykkel, dame')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. before anything, each of them can see the others', async () => {
    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title']).sort()).toEqual([
      'Bysykkel, dame',
      'Telt, 3 personer',
    ])
  })

  test('2. Ola blocks Kari, and her things go from his page', async () => {
    expect((await call('POST', `/blocks/${kariId}`, { token: ola })).status).toBe(204)

    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title'])).toEqual(['Bysykkel, dame'])
  })

  test('3. and his go from hers, because a block hides both ways', async () => {
    const seen = await call('GET', '/discover', { token: kari })
    expect(seen.body!['items'].map((i: Json) => i['title'])).toEqual(['Bysykkel, dame'])
  })

  test('4. her profile no longer hands out what her page would not show', async () => {
    // Hidden on one surface and listed on another is not hidden. 13b is one
    // tap from a chat row, a notification or an old conversation.
    const profile = await call('GET', `/users/${kariId}`, { token: ola })

    expect(profile.body!['blockedByYou']).toBe(true)
    expect(profile.body!['items']).toEqual([])
  })

  test('5. nor can he open the listing itself by its id', async () => {
    const item = await call('GET', `/items/${tent}`, { token: ola })

    expect(item.status).toBe(404)
  })

  test('6. no wish of his can reach her', async () => {
    const res = await call('POST', `/items/${tent}/like`, { token: ola })

    expect(res.status).toBe(403)
    expect(res.body!['code']).toBe('blocked')
  })

  test('7. and no conversation either, in either direction', async () => {
    const his = await call('POST', `/items/${tent}/message`, {
      token: ola, body: { body: 'Hei igjen' },
    })
    expect(his.status).toBe(403)

    const hers = await call('POST', `/items/${drill}/message`, {
      token: kari, body: { body: 'Hei' },
    })
    expect(hers.status).toBe(403)
  })

  test('8. a chain cannot route around it either', async () => {
    // Everybody in a three-cycle is next to everybody else, so a ring holding
    // both of them needs an edge between them — and that edge is the one thing
    // that is refused. Ola→Per and Per→Kari are fine and close nothing.
    expect((await call('POST', `/items/${bike}/like`, { token: ola })).status).toBe(200)
    expect((await call('POST', `/items/${tent}/like`, { token: per })).status).toBe(200)

    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    expect(closing.status).toBe(403)

    const trades = await call('GET', '/trades', { token: per })
    expect(trades.body!['waiting']).toEqual([])
  })

  test('9. unblocking gives everything back', async () => {
    expect((await call('DELETE', `/blocks/${kariId}`, { token: ola })).status).toBe(204)

    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title']).sort()).toEqual([
      'Bysykkel, dame',
      'Telt, 3 personer',
    ])
    expect((await call('GET', `/items/${tent}`, { token: ola })).status).toBe(200)
    expect((await call('GET', `/users/${kariId}`, { token: ola })).body!['items']).toHaveLength(1)
  })

  test('10. and the ring that was refused while blocked closes now', async () => {
    // Ola→Per→Kari→Ola, the one from step 8, with the edge that was refused
    // put back.
    const closing = await call('POST', `/items/${drill}/like`, { token: kari })

    expect(closing.status).toBe(200)
    expect(closing.body!['tradeId']).not.toBeNull()

    const view = await call('GET', `/trades/${closing.body!['tradeId']}`, { token: ola })
    expect(view.body!['kind']).toBe('chain')
    expect(view.body!['participants']).toHaveLength(3)
  })
})
