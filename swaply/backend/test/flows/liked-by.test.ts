// FLOW — Who liked your things
//
// The rule this exists to pin down: **screen 12 lists the people you could
// close a loop with from your side, and says which of them cannot be
// answered yet.** Each liker carries `anonymous`, true for a device that is
// only looking around and has made no profile — nobody to write to and
// nothing of theirs to want back. And nobody across a block is listed or
// counted, in either direction: a block hides both ways on every surface,
// and a like made before the block is still in the table.
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, reset } from '../helpers.js'

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
    body: { displayName: name, email: `${name.split(' ')[0]!.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  expect(res.status, name).toBe(201)
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

/** The drill's row on Ola's screen 12. */
async function drillRow(ola: Person, drill: string): Promise<Json> {
  const items = (await call('GET', '/me/liked-by', { token: ola.token })).body!['items'] as Json[]
  return items.find((row) => row['item']['id'] === drill)!
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('who liked your things', () => {
  let ola: Person, kari: Person, per: Person, device: Person
  let drill = ''

  beforeAll(async () => {
    ola = await register('Ola N.')
    kari = await register('Kari N.')
    per = await register('Per N.')
    const started = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-looking-around-0123456789' },
    })
    device = { token: started.body!['token'], id: started.body!['user']['id'] }
    drill = (await call('POST', '/items', {
      token: ola.token, body: { title: 'Bosch drill 18V', category: 'verktoy', condition: 'good' },
    })).body!['id']
  })

  test('1. Kari, Per and a phone that is only looking around all like the drill', async () => {
    for (const who of [kari, per, device]) {
      expect((await call('POST', `/items/${drill}/like`, { token: who.token })).status).toBe(200)
    }

    const row = await drillRow(ola, drill)
    expect(row['likers']).toHaveLength(3)
    expect(row['item']['likeCount']).toBe(3)
  })

  test('2. the phone is said to be one, and the people are not', async () => {
    const likers = (await drillRow(ola, drill))['likers'] as Json[]

    expect(likers.find((u) => u['id'] === device.id)!['anonymous']).toBe(true)
    expect(likers.find((u) => u['id'] === kari.id)!['anonymous']).toBe(false)
    expect(likers.find((u) => u['id'] === per.id)!['anonymous']).toBe(false)
  })

  test('3. once Ola blocks Per, Per is neither listed nor counted', async () => {
    expect((await call('POST', `/blocks/${per.id}`, { token: ola.token })).status).toBe(204)

    const row = await drillRow(ola, drill)
    expect(row['likers'].map((u: Json) => u['id']).sort()).toEqual([kari.id, device.id].sort())
    expect(row['item']['likeCount']).toBe(2)
  })

  test('4. and the same when it is Kari who blocks Ola: a block hides both ways', async () => {
    expect((await call('POST', `/blocks/${ola.id}`, { token: kari.token })).status).toBe(204)

    const row = await drillRow(ola, drill)
    expect(row['likers'].map((u: Json) => u['id'])).toEqual([device.id])
    expect(row['item']['likeCount']).toBe(1)
  })

  test('5. lifting a block lists the like again, for it was never taken away', async () => {
    expect((await call('DELETE', `/blocks/${per.id}`, { token: ola.token })).status).toBe(204)

    const row = await drillRow(ola, drill)
    expect(row['likers'].map((u: Json) => u['id']).sort()).toEqual([per.id, device.id].sort())
  })
})
