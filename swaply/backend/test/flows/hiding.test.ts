// FLOW — «Ikke vis meg slike» (the long-press menu on a discovery card)
//
// The rule this exists to pin down: **asking not to be shown a kind of thing
// takes every listing of that kind out of what is put in front of you — Oppdag,
// its rows and its search — and nothing else.** A kind is the category and the
// subcategory under it. A listing with no subcategory says no more than its
// category, and one lamp is no reason to hide every «Hjem», so then only that
// listing goes.
//
// The menu item used to do nothing. What it does now is about looking, so a
// phone that has made no profile may do it, and it comes along when that phone
// signs in to an account. An item page opened directly still opens: a link or
// a notification is somebody choosing to look. Nobody else's Oppdag changes,
// and the owner is not told.
//
// How much is hidden comes with every answer that carries the account, because
// the app offers «Angre» — which is «vis alt igjen» — only while one kind is
// hidden, and a count missing from a sign-in read as none.
import { sql } from 'drizzle-orm'
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

async function list(token: string, title: string, category: string, subcategory?: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category, subcategory: subcategory ?? null, condition: 'good', estimatedValueNok: 900 },
  })
  expect(res.status, title).toBe(201)
  return res.body!['id'] as string
}

async function shown(token: string, query = ''): Promise<string[]> {
  const res = await call('GET', `/discover${query}`, { token })
  return (res.body!['items'] as Json[]).map((i) => i['id'] as string)
}

async function inRows(token: string): Promise<string[]> {
  const res = await call('GET', '/discover/rows', { token })
  return (res.body!['rows'] as Json[]).flatMap((r) => (r['items'] as Json[]).map((i) => i['id'] as string))
}

async function hiddenCount(token: string): Promise<number> {
  return (await call('GET', '/me', { token })).body!['hiddenCount'] as number
}

async function subcategories(token: string, category: string): Promise<string[]> {
  const res = await call('GET', `/discover/subcategories?category=${category}`, { token })
  return res.body!['subcategories'] as string[]
}

describe('«Ikke vis meg slike»', () => {
  let kari = '', per = '', phone = '', ola = ''
  let elbike = '', elbikeToo = '', elbikeLower = '', racer = '', lamp = '', chair = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    kari = await register('Kari', 'kari@epost.no')
    per = await register('Per', 'per@epost.no')
    elbike = await list(kari, 'Elsykkel Cube', 'sykling', 'Elsykler')
    elbikeToo = await list(kari, 'Elsykkel Batavus', 'sykling', 'Elsykler')
    // Typed by somebody else, in another case. It is the same kind of thing.
    elbikeLower = await list(per, 'Elsykkel med kurv', 'sykling', 'elsykler')
    racer = await list(kari, 'Racersykkel', 'sykling', 'Racersykler')
    lamp = await list(kari, 'Lampe', 'hjem')
    chair = await list(per, 'Stol', 'hjem')

    // Ola has an account on another phone, and on this one he is looking
    // around as a stranger with interests of his own.
    ola = await register('Ola', 'ola@epost.no')
    const start = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-hiding-0123456789abcdef' },
    })
    phone = start.body!['token']
    await call('PUT', '/me/interests', { token: phone, body: { interests: ['sykling', 'hjem', 'verktoy'] } })
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a phone looking around hides «slike» on an el-bike card, and is told what was hidden', async () => {
    const res = await call('POST', '/me/hidden', { token: phone, body: { itemId: elbike } })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      hidden: { category: 'sykling', subcategory: 'Elsykler', itemId: null },
      hiddenCount: 1,
    })
  })

  test('2. Oppdag shows no el-bike any more, whoever wrote the word, and the racing bike stays', async () => {
    const ids = await shown(phone)

    expect(ids).not.toContain(elbike)
    expect(ids).not.toContain(elbikeToo)
    expect(ids).not.toContain(elbikeLower)
    expect(ids).toContain(racer)
  })

  test('3. nor do the rows by interest, or a search for one', async () => {
    const rows = await inRows(phone)
    expect(rows).toContain(racer)
    expect(rows).not.toContain(elbike)
    expect(rows).not.toContain(elbikeLower)

    const searched = await shown(phone, '?q=Elsykkel')
    for (const id of [elbike, elbikeToo, elbikeLower]) expect(searched).not.toContain(id)
    expect(await shown(phone, '?category=sykling&subcategory=Elsykler')).toEqual([])
  })

  test('4. nor does 05b offer «Elsykler» under Sykling any more, in either spelling', async () => {
    expect(await subcategories(phone, 'sykling')).toEqual(['Racersykler'])
    // Somebody else is still offered it, and once: it is one kind however it
    // was typed, in the spelling most of its listings use.
    expect(await subcategories(ola, 'sykling')).toEqual(['Elsykler', 'Racersykler'])
  })

  test('5. a lamp with no subcategory hides that lamp, and not every «Hjem»', async () => {
    const res = await call('POST', '/me/hidden', { token: phone, body: { itemId: lamp } })

    expect(res.body).toEqual({
      hidden: { category: 'hjem', subcategory: null, itemId: lamp },
      hiddenCount: 2,
    })
    const ids = await shown(phone)
    expect(ids).not.toContain(lamp)
    expect(ids).toContain(chair)
  })

  test('6. pressed twice, it is hidden once', async () => {
    const again = await call('POST', '/me/hidden', { token: phone, body: { itemId: elbikeToo } })

    expect(again.status).toBe(200)
    expect(again.body!['hidden']['subcategory']).toBe('Elsykler')
    expect(again.body!['hiddenCount']).toBe(2)
    expect(await hiddenCount(phone)).toBe(2)
  })

  test('7. a listing hidden on its own stops counting once it is gone for good', async () => {
    const vase = await list(per, 'Vase', 'hjem')
    const hid = await call('POST', '/me/hidden', { token: phone, body: { itemId: vase } })
    expect(hid.body!['hiddenCount']).toBe(3)

    // Retired, the vase can never be shown again, so there is nothing for
    // «vis alt igjen» to bring back.
    expect((await call('DELETE', `/items/${vase}`, { token: per })).status).toBe(204)
    expect(await hiddenCount(phone)).toBe(2)
  })

  test('8. every answer that carries the phone\'s own profile says how much is hidden', async () => {
    const interests = await call('PUT', '/me/interests', {
      token: phone,
      body: { interests: ['sykling', 'hjem', 'verktoy'] },
    })
    expect(interests.body!['hiddenCount']).toBe(2)

    const moved = await call('PATCH', '/me', { token: phone, body: { postalCode: '7030' } })
    expect(moved.body!['hiddenCount']).toBe(2)

    const back = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-hiding-0123456789abcdef' },
    })
    expect(back.body!['user']['hiddenCount']).toBe(2)
  })

  test('9. the item page opened directly still opens', async () => {
    const page = await call('GET', `/items/${elbike}`, { token: phone })

    expect(page.status).toBe(200)
    expect(page.body!['title']).toBe('Elsykkel Cube')
  })

  test('10. nobody else is shown less, and the owner is not told', async () => {
    const ids = await shown(per)
    expect(ids).toContain(elbike)
    expect(ids).toContain(lamp)

    const [row] = await db.execute<{ n: string }>(
      sql`select count(*)::text as n from notifications n
          join users u on u.id = n.user_id where u.email = 'kari@epost.no'`,
    )
    expect(Number(row!.n)).toBe(0)
  })

  test('11. a listing that does not exist cannot be hidden', async () => {
    const res = await call('POST', '/me/hidden', {
      token: phone,
      body: { itemId: '00000000-0000-4000-8000-000000000000' },
    })

    expect(res.status).toBe(404)
    expect(res.body!['message']).toBe('Fant ikke gjenstanden.')
  })

  test('12. signing in folds what the phone hid into the account, once each', async () => {
    // The account has already hidden el-bikes on the other phone.
    await call('POST', '/me/hidden', { token: ola, body: { itemId: elbikeLower } })

    const res = await call('POST', '/auth/login', {
      token: phone,
      body: { email: 'ola@epost.no', password: 'byttehandel1' },
    })
    expect(res.status).toBe(200)
    ola = res.body!['token']

    // Said by the sign-in itself, before anything asks for GET /me.
    expect(res.body!['user']['hiddenCount']).toBe(2)
    expect(await hiddenCount(ola)).toBe(2)
    const ids = await shown(ola)
    expect(ids).not.toContain(elbike)
    expect(ids).not.toContain(lamp)
    expect(ids).toContain(chair)
  })

  test('13. «vis alt igjen» brings every one of them back', async () => {
    const res = await call('DELETE', '/me/hidden', { token: ola })
    expect(res.status).toBe(204)

    expect(await hiddenCount(ola)).toBe(0)
    const ids = await shown(ola)
    for (const id of [elbike, elbikeToo, elbikeLower, lamp]) expect(ids).toContain(id)
  })
})
