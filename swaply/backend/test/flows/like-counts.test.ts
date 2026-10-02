// FLOW — How many have liked it
//
// The rule this exists to pin down: **04's «3 har likt denne», 13's «♥ 4 har
// likt tingene dine» and 12's list of who it was are one count.** 12 lists
// the owner's listings that are still up, with the people who liked each,
// and nobody on the other side of a block — neither can see the other's
// things, and no trade can open between them. 04 counted those likers
// anyway, and 13 kept counting the likes on a listing long taken down, so
// the numbers said more people than the list could show.
//
// A block takes nothing away: the like is still there, uncounted, and comes
// back with the unblock.
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
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

describe('how many have liked it', () => {
  let ola = { token: '', id: '' }
  let kari = { token: '', id: '' }
  let per = { token: '', id: '' }
  let drill = '', ladder = ''

  /** 04, as the owner opens it. */
  const onListing = async (id: string) =>
    (await call('GET', `/items/${id}`, { token: ola.token })).body!['likeCount'] as number
  /** 13's «♥ N har likt tingene dine». */
  const onProfile = async () =>
    (await call('GET', '/me', { token: ola.token })).body!['likedByCount'] as number
  /** Everybody 12 lists, listing by listing. */
  const onTwelve = async () =>
    ((await call('GET', '/me/liked-by', { token: ola.token })).body!['items'] as Json[]).reduce(
      (n, row) => n + (row['likers'] as Json[]).length,
      0,
    )

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await register('Ola')
    kari = await register('Kari')
    per = await register('Per')

    const list = async (title: string) =>
      (await call('POST', '/items', {
        token: ola.token,
        body: { title, category: 'verktoy', condition: 'good' },
      })).body!['id'] as string
    drill = await list('Bosch drill 18V')
    ladder = await list('Stige')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Kari and Per like the drill and Kari the ladder: 2 on the drill, 3 on 13', async () => {
    await call('POST', `/items/${drill}/like`, { token: kari.token })
    await call('POST', `/items/${drill}/like`, { token: per.token })
    await call('POST', `/items/${ladder}/like`, { token: kari.token })

    expect(await onListing(drill)).toBe(2)
    expect(await onProfile()).toBe(3)
    expect(await onTwelve()).toBe(3)
  })

  test('2. Ola blocks Per, and Per is counted neither on the drill nor on 13', async () => {
    expect((await call('POST', `/blocks/${per.id}`, { token: ola.token })).status).toBe(204)

    expect(await onListing(drill)).toBe(1)
    expect(await onProfile()).toBe(2)
    // Kari opening the drill is told the same number.
    expect((await call('GET', `/items/${drill}`, { token: kari.token })).body!['likeCount']).toBe(1)
  })

  test('3. a block either way: Per blocking Ola leaves him out just the same', async () => {
    await call('DELETE', `/blocks/${per.id}`, { token: ola.token })
    expect(await onListing(drill)).toBe(2)

    await call('POST', `/blocks/${ola.id}`, { token: per.token })
    expect(await onListing(drill)).toBe(1)
    expect(await onProfile()).toBe(2)

    // And the like comes back with the unblock: it was never taken away.
    await call('DELETE', `/blocks/${ola.id}`, { token: per.token })
    expect(await onProfile()).toBe(3)
  })

  test('4. the ladder taken down, its like leaves 13 with it, as it leaves 12', async () => {
    expect((await call('DELETE', `/items/${ladder}`, { token: ola.token })).status).toBe(204)

    expect(await onProfile()).toBe(2)
    expect(await onTwelve()).toBe(2)
  })
})
