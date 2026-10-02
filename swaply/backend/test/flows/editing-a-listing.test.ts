// FLOW — «Rediger annonsen»
//
// The rule this exists to pin down: **a field sent is a change, and a field
// left out is left alone; an emptied field is empty.** CLAUDE.md says so for
// every PATCH — `null` is a value there, not an absence — and the app sends
// `''` for a box somebody cleared. The edit used to keep the old value of
// every field it was sent empty, so a description could never be taken away,
// `''` was stored as a subcategory, and «Tjeneste» picked on an item was not
// written at all.
//
// And 10b's rule holds for an edit as for a new listing: a service has no
// condition, and an item needs one. A listing taken down cannot be edited,
// and the words and the photos of an edit are written together or not at all.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { acceptOffer, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, makeItem, reset } from '../helpers.js'
import { storedPhoto } from '../photo.js'

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

async function row(id: string) {
  const [found] = await db.execute<Json>(
    sql`select kind, title, description, subcategory, condition, estimated_value_nok, town
        from items where id = ${id}`,
  )
  return found!
}

describe('editing a listing', () => {
  let kari = { token: '', id: '' }
  let drill = ''
  let photo = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    kari = await register('Kari')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Kari lists a drill with every box filled in', async () => {
    photo = await storedPhoto()
    const res = await call('POST', '/items', {
      token: kari.token,
      body: {
        title: 'Bosch drill 18V', description: 'Lite brukt, lader følger med',
        category: 'verktoy', subcategory: 'Elektroverktøy', condition: 'good',
        estimatedValueNok: 600, postalCode: '7030', media: [photo],
      },
    })

    expect(res.status).toBe(201)
    drill = res.body!['id']
    expect(res.body!['town']).toBe('Trondheim')
  })

  test('2. the form sent back with the description and subcategory emptied empties them', async () => {
    // What the app sends: every field, '' for a box somebody cleared, and the
    // photos by the URLs the listing was read with.
    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: {
        kind: 'item', title: 'Bosch drill 18V', description: '', category: 'verktoy',
        subcategory: '', condition: 'good', estimatedValueNok: 600,
        media: [`http://test.local${photo}`],
      },
    })

    expect(res.status).toBe(200)
    expect(res.body!['description']).toBeNull()
    expect(res.body!['subcategory']).toBeNull()
    // Emptied, not an empty string every reader has to know to hide.
    expect(await row(drill)).toMatchObject({ description: null, subcategory: null })
    // The photo is the one it had, and the town is where it was.
    expect(res.body!['media']).toEqual([`http://test.local${photo}`])
    expect(res.body!['town']).toBe('Trondheim')
  })

  test('3. null empties a field too, and a field left out is left alone', async () => {
    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { estimatedValueNok: null, description: 'Med koffert' },
    })

    expect(res.status).toBe(200)
    expect(res.body!['estimatedValueNok']).toBeNull()
    expect(res.body!['description']).toBe('Med koffert')
    expect(res.body!['title']).toBe('Bosch drill 18V')
    expect(res.body!['condition']).toBe('good')
    expect(res.body!['media']).toEqual([`http://test.local${photo}`])
  })

  test('4. «Tjeneste» picked on it makes it a service, which has no condition', async () => {
    // The app sends no condition for a service.
    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { kind: 'service', title: 'Boring av hull' },
    })

    expect(res.status).toBe(200)
    expect(res.body!['kind']).toBe('service')
    expect(res.body!['condition']).toBeNull()
    expect(await row(drill)).toMatchObject({ kind: 'service', condition: null })
  })

  test('5. made an item again it needs a condition, and without one nothing changes', async () => {
    const refused = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { kind: 'item', title: 'Bosch drill 18V' },
    })
    expect(refused.status).toBe(400)
    expect(refused.body).toEqual({
      code: 'condition_required',
      message: 'Velg tilstand for gjenstanden.',
    })
    expect(await row(drill)).toMatchObject({ kind: 'service', title: 'Boring av hull' })

    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { kind: 'item', title: 'Bosch drill 18V', condition: 'worn' },
    })
    expect(res.status).toBe(200)
    expect(res.body!['kind']).toBe('item')
    expect(res.body!['condition']).toBe('worn')
  })

  test('6. and an item\'s condition cannot be emptied', async () => {
    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { condition: null },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('condition_required')
    expect((await row(drill))['condition']).toBe('worn')
  })

  test('7. a refused edit writes nothing, neither its words nor its photos', async () => {
    const swept = '/media/0123456789abcdef0123456789abcdef.png'
    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { title: 'Drill med to batterier', media: [`http://test.local${photo}`, swept] },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('image_gone')
    expect((await row(drill))['title']).toBe('Bosch drill 18V')
    const page = await call('GET', `/items/${drill}`, { token: kari.token })
    expect(page.body!['media']).toEqual([`http://test.local${photo}`])
  })

  test('8. a service in a trade everybody has agreed to stays a service', async () => {
    // A service is never reserved, so nothing else stops the edit. Made an
    // item there, the trade would be giving away something another trade
    // could reserve as well.
    const per = await register('Per')
    const mowing = await makeItem(kari.id, 'Plenklipping', { kind: 'service' })
    const tent = await makeItem(per.id, 'Telt')
    const trade = await openTradeFromCycle(db, [
      { userId: per.id, givesItemId: tent },
      { userId: kari.id, givesItemId: mowing },
    ])
    await acceptOffer(db, await currentOffer(trade), per.id, 'terms-2026-09')
    await acceptOffer(db, await currentOffer(trade), kari.id, 'terms-2026-09')

    const res = await call('PATCH', `/items/${mowing}`, {
      token: kari.token,
      body: { kind: 'item', condition: 'good' },
    })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      code: 'agreed_trade',
      message: 'Tjenesten er med i et avtalt bytte og kan ikke gjøres om til en gjenstand.',
    })
    expect(await row(mowing)).toMatchObject({ kind: 'service', condition: null })
  })

  test('9. a listing taken down is not there to edit', async () => {
    expect((await call('DELETE', `/items/${drill}`, { token: kari.token })).status).toBe(204)

    const res = await call('PATCH', `/items/${drill}`, {
      token: kari.token,
      body: { title: 'Tilbake igjen' },
    })

    expect(res.status).toBe(404)
    expect(res.body!['message']).toBe('Fant ikke gjenstanden.')
    expect((await row(drill))['title']).toBe('Bosch drill 18V')
  })
})
