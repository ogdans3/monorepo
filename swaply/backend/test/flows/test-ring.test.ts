// FLOW — A test account and a real person never meet
//
// The rule this exists to pin down: **a test account deals only with its own
// ring — the admin who made it and the admin's other test accounts — and the
// admin is a real person, free to deal with real people.** `docs/ADMIN.md`
// bound #2: once a test account and a real person are in one trade, the
// account can neither be reset nor deleted, because it is somebody's history.
//
// Hiding test listings on Oppdag was the only thing holding that. A heart, a
// first message and the cycle search all walked past it: the admin acting as
// Kari could heart a real tester's bike and the tester was told; a tester with
// a link could write to Kari; and a ring through the admin, Kari and a tester
// opened a real three-way trade. Now each is refused as `test_ring`, a ring
// that would hold a test account and anybody outside its ring is never found,
// liked-by does not show likes across the ring, and «Nullstill → gjenstander»
// leaves a listing a real person is negotiating about where it is.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { close, db, reset, tradeState } from '../helpers.js'

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

async function register(name: string, email: string): Promise<Person> {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1' },
  })
  expect(res.status, name).toBe(201)
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

/** A test account made by [admin], and a session the switcher minted for it. */
async function testAccount(admin: Person, displayName: string): Promise<Person> {
  const made = await call('POST', '/admin/accounts', {
    token: admin.token, body: { displayName, withItems: 0 },
  })
  expect(made.status).toBe(201)
  const id = made.body!['id'] as string
  const session = await call('POST', `/admin/accounts/${id}/session`, { token: admin.token })
  return { token: session.body!['token'], id }
}

async function list(who: Person, title: string) {
  const res = await call('POST', '/items', {
    token: who.token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  expect(res.status, title).toBe(201)
  return res.body!['id'] as string
}

const refusal = { code: 'test_ring', message: 'Testkontoer kan bare bytte med hverandre og med eieren sin.' }

async function tradesBetween(a: string, b: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from trades t
        where exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${a})
          and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${b})`,
  )
  return row!.n
}

describe('a test account and a real person', () => {
  let gabriel: Person, henrik: Person, tora: Person, tove: Person
  let kari: Person, per: Person, lise: Person
  let bike = '', lamp = '', scarf = '', drill = '', saw = '', helmet = ''
  let kayak = '', canoe = '', tent = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    gabriel = await register('Gabriel', 'gabriel@epost.no')
    await grantAdmin(gabriel.id)
    henrik = await register('Henrik', 'henrik@epost.no')
    await grantAdmin(henrik.id)
    tora = await register('Tora T.', 'tora@epost.no')
    tove = await register('Tove T.', 'tove@epost.no')

    kari = await testAccount(gabriel, 'Kari Test')
    per = await testAccount(gabriel, 'Per Test')
    lise = await testAccount(henrik, 'Lise Test')

    bike = await list(tora, 'Sykkel')
    lamp = await list(tora, 'Lampe')
    scarf = await list(tove, 'Skjerf')
    drill = await list(gabriel, 'Bosch drill 18V')
    saw = await list(gabriel, 'Stikksag')
    helmet = await list(gabriel, 'Sykkelhjelm')
    kayak = await list(kari, 'Kajakk')
    canoe = await list(kari, 'Kano')
    tent = await list(per, 'Telt')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Gabriel, acting as Kari, hearts a real tester’s bike: refused, and Tora is told nothing', async () => {
    const res = await call('POST', `/items/${bike}/like`, { token: kari.token })

    expect(res.status).toBe(403)
    expect(res.body).toEqual(refusal)
    const [like] = await db.execute(sql`select 1 from likes where from_user = ${kari.id}`)
    expect(like).toBeUndefined()
    const told = (await call('GET', '/notifications', { token: tora.token })).body!['notifications']
    expect(told).toEqual([])
  })

  test('2. nor can Tora, holding a link to Kari’s kayak, heart it', async () => {
    const res = await call('POST', `/items/${kayak}/like`, { token: tora.token })

    expect(res.status).toBe(403)
    expect(res.body).toEqual(refusal)
  })

  test('3. and a first message is refused in either direction, so no trade opens', async () => {
    const hers = await call('POST', `/items/${bike}/message`, {
      token: kari.token, body: { body: 'Hei! Er sykkelen ledig?' },
    })
    const theirs = await call('POST', `/items/${kayak}/message`, {
      token: tora.token, body: { body: 'Hei! Er kajakken ledig?' },
    })

    expect(hers.body).toEqual(refusal)
    expect(theirs.body).toEqual(refusal)
    expect(await tradesBetween(kari.id, tora.id)).toBe(0)
  })

  test('4. Gabriel himself is a real person, and deals with real people', async () => {
    expect((await call('POST', `/items/${bike}/like`, { token: gabriel.token })).status).toBe(200)

    const res = await call('POST', `/items/${lamp}/message`, {
      token: gabriel.token, body: { body: 'Er lampen ledig?' },
    })
    expect(res.status).toBe(201)
  })

  test('5. another admin’s ring is outside this one, and so is that admin', async () => {
    expect((await call('POST', `/items/${kayak}/like`, { token: lise.token })).body).toEqual(refusal)
    expect((await call('POST', `/items/${kayak}/like`, { token: henrik.token })).body).toEqual(refusal)
  })

  test('6. inside the ring everything still works: Kari and Per’s hearts open a trade', async () => {
    expect((await call('POST', `/items/${tent}/like`, { token: kari.token })).body!['tradeId']).toBeNull()

    const closing = await call('POST', `/items/${kayak}/like`, { token: per.token })

    expect(closing.body!['tradeId']).toBeTruthy()
    expect(await tradeState(closing.body!['tradeId'])).toBe('pending')
  })

  test('7. a ring through Gabriel, Kari and a real person never opens, though every wish is there', async () => {
    // Tove wants Gabriel's saw; Kari wants Tove's scarf, a wish from before
    // the heart refused one; Gabriel's heart on Kari's canoe would close it.
    expect((await call('POST', `/items/${saw}/like`, { token: tove.token })).body!['tradeId']).toBeNull()
    await db.execute(sql`insert into likes (from_user, target_item) values (${kari.id}, ${scarf})`)

    const closing = await call('POST', `/items/${canoe}/like`, { token: gabriel.token })

    expect(closing.status).toBe(200)
    expect(closing.body!['tradeId']).toBeNull()
    expect(await sweepForCycles(db)).toEqual([])
    expect(await tradesBetween(kari.id, tove.id)).toBe(0)
  })

  test('8. liked-by shows a like across the ring to nobody, and counts it nowhere', async () => {
    // From before the heart refused it, as in step 7.
    await db.execute(sql`insert into likes (from_user, target_item) values (${kari.id}, ${lamp})`)
    expect((await call('POST', `/items/${drill}/like`, { token: kari.token })).status).toBe(200)

    const toras = (await call('GET', '/me/liked-by', { token: tora.token })).body!['items'] as Json[]
    const ofLamp = toras.find((row) => row['item']['id'] === lamp)!
    expect(ofLamp['likers']).toEqual([])
    expect(ofLamp['item']['likeCount']).toBe(0)
    const ofBike = toras.find((row) => row['item']['id'] === bike)!
    expect(ofBike['likers'].map((u: Json) => u['displayName'])).toEqual(['Gabriel'])

    // Inside the ring a like is shown like any other.
    const gabriels = (await call('GET', '/me/liked-by', { token: gabriel.token })).body!['items'] as Json[]
    const ofDrill = gabriels.find((row) => row['item']['id'] === drill)!
    expect(ofDrill['likers'].map((u: Json) => u['displayName'])).toEqual(['Kari Test'])
  })

  test('9. «Nullstill → gjenstander» leaves what a real person is negotiating about, and says so', async () => {
    // Tora writes to Gabriel about his helmet; Kari writes about his drill.
    const toras = await call('POST', `/items/${helmet}/message`, {
      token: tora.token, body: { body: 'Er hjelmen ledig?' },
    })
    const karis = await call('POST', `/items/${drill}/message`, {
      token: kari.token, body: { body: 'Er drillen ledig?' },
    })

    const res = await call('POST', `/admin/accounts/${gabriel.id}/reset`, {
      token: gabriel.token, body: { parts: ['items'] },
    })

    expect(res.status).toBe(200)
    expect(res.body!['done']).toContain('1 gjenstand som Tora T. forhandler om ble ikke rørt')
    // Tora's negotiation stands, about a helmet that is still there.
    expect(await tradeState(toras.body!['tradeId'])).toBe('talking')
    expect((await call('GET', `/items/${helmet}`, { token: tora.token })).status).toBe(200)
    // Kari's, inside the ring, ended with the drill, as removing it ends one.
    const ended = (await call('GET', `/trades/${karis.body!['tradeId']}`, { token: kari.token })).body!
    expect(ended['closeCode']).toBe('listing_removed')
  })
})
