// FLOW — «Legg ut» pressed twice makes one listing
//
// The rule this exists to pin down: **the same draft sent twice is one
// listing.** The app makes an `Idempotency-Key` once per draft and sends it
// with `POST /items`. When the answer to «Legg ut» is lost after the server
// has written the listing — a tunnel, a lift, a phone that slept — the draft
// is still on the phone and the button is still there, and pressing it again
// used to put the same thing on the market twice. Now the same key from the
// same account, within 48 hours, is answered with the first listing (200, the
// same body) instead of a second one.
//
// A key is somebody's draft, not a global name: another account's same key is
// its own listing. And it answers for 48 hours and while the listing stands —
// a draft kept longer than that, or sent again after the listing it made was
// deleted, is listed again.
//
// The body of a second press is not compared with the first: the answer is
// the listing the key made, as it stands, and the 200 is what tells the app
// so. A draft changed after the lost answer is the app's to put right, and it
// does, with the same PATCH «Rediger annonsen» sends — so the person's changes
// reach the one listing instead of being thrown away under «Lagt ut».
//
// Unless a trade has reserved the listing since: then the correction is
// refused, as «Rediger annonsen» is, and the answer to the second press says
// `reserved` so the app can stop there. Its draft is done with — the listing
// is out — rather than pressed again until the key runs out and the same
// press lists the thing a second time.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { connect } from '../../src/db/index.js'
import { env } from '../../src/env.js'
import { acceptOffer, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, makeItem, reset } from '../helpers.js'

let app: FastifyInstance

type Json = Record<string, any>

async function call(
  method: string,
  url: string,
  opts: { token?: string; body?: Json; key?: string; on?: FastifyInstance } = {},
) {
  const res = await (opts.on ?? app).inject({
    method: method as 'GET',
    url,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.key ? { 'idempotency-key': opts.key } : {}),
    },
    ...(opts.body ? { payload: opts.body } : {}),
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

async function register(name: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  expect(res.status).toBe(201)
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

/** 10b's draft, as «Legg ut» sends it. */
const draft = {
  title: 'Bosch drill 18V',
  category: 'verktoy',
  condition: 'good',
  estimatedValueNok: 600,
  media: ['https://bilder.example/drill.webp'],
}

/** What the phone does: one key for the draft, made when the draft was. */
const newKey = () => crypto.randomUUID()

async function listings(ownerId: string, title = draft.title): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from items
        where owner_id = ${ownerId} and title = ${title} and deleted_at is null`,
  )
  return row!.n
}

let ola = { token: '', id: '' }
let kari = { token: '', id: '' }

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

describe('the same draft sent twice', () => {
  const key = newKey()
  let first: Json = {}

  test('1. the first press lists the drill', async () => {
    const res = await call('POST', '/items', { token: ola.token, body: draft, key })

    expect(res.status).toBe(201)
    first = res.body!
    expect(await listings(ola.id)).toBe(1)
  })

  test('2. the same press again, its answer lost, is the same listing and not a second', async () => {
    const res = await call('POST', '/items', { token: ola.token, body: draft, key })

    // 200 rather than 201: nothing new was made.
    expect(res.status).toBe(200)
    expect(res.body).toEqual(first)
    expect(res.body!['media']).toEqual(first['media'])
    expect(await listings(ola.id)).toBe(1)
  })

  test('3. two presses landing at once are still one listing', async () => {
    // Two connections, so the second can be written while the first is. Most
    // runs they meet on the key's index — the second waits there for the
    // first to commit, writes nothing, and answers with what the first made.
    const second = connect()
    const other = await buildApp(second.db)
    try {
      const both = newKey()
      const body = { ...draft, title: 'Stige' }
      const [a, b] = await Promise.all([
        call('POST', '/items', { token: ola.token, body, key: both }),
        call('POST', '/items', { token: ola.token, body, key: both, on: other }),
      ])

      expect([a.status, b.status].sort()).toEqual([200, 201])
      expect(a.body!['id']).toBe(b.body!['id'])
      expect(await listings(ola.id, 'Stige')).toBe(1)
    } finally {
      await other.close()
      await second.client.end()
    }
  })

  test('4. a new draft has a new key, and is a new listing', async () => {
    const res = await call('POST', '/items', { token: ola.token, body: draft, key: newKey() })

    expect(res.status).toBe(201)
    expect(res.body!['id']).not.toBe(first['id'])
    expect(await listings(ola.id)).toBe(2)
  })

  test('5. another account sending the same key lists its own thing', async () => {
    const res = await call('POST', '/items', { token: kari.token, body: draft, key })

    expect(res.status).toBe(201)
    expect(res.body!['ownerId']).toBe(kari.id)
    expect(await listings(kari.id)).toBe(1)
    // And Ola's key still answers with Ola's drill.
    const again = await call('POST', '/items', { token: ola.token, body: draft, key })
    expect(again.body!['id']).toBe(first['id'])
  })

  test('6. without a key every press is a listing, as it always was', async () => {
    const body = { ...draft, title: 'Uten nøkkel' }
    await call('POST', '/items', { token: ola.token, body })
    await call('POST', '/items', { token: ola.token, body })

    expect(await listings(ola.id, 'Uten nøkkel')).toBe(2)
  })
})

describe('a key that no longer answers', () => {
  test('7. after 48 hours the same draft is listed again', async () => {
    const key = newKey()
    const body = { ...draft, title: 'Telt' }
    const old = await call('POST', '/items', { token: ola.token, body, key })
    await db.execute(
      sql`update items set created_at = now() - interval '49 hours' where id = ${old.body!['id']}`,
    )

    const res = await call('POST', '/items', { token: ola.token, body, key })

    expect(res.status).toBe(201)
    expect(res.body!['id']).not.toBe(old.body!['id'])
    expect(await listings(ola.id, 'Telt')).toBe(2)
    // The key now belongs to the new listing, and answers with it.
    const again = await call('POST', '/items', { token: ola.token, body, key })
    expect(again.status).toBe(200)
    expect(again.body!['id']).toBe(res.body!['id'])
  })

  test('8. nor once the listing it made has been deleted', async () => {
    const key = newKey()
    const body = { ...draft, title: 'Kajakk' }
    const gone = await call('POST', '/items', { token: ola.token, body, key })
    expect((await call('DELETE', `/items/${gone.body!['id']}`, { token: ola.token })).status).toBe(204)

    const res = await call('POST', '/items', { token: ola.token, body, key })

    expect(res.status).toBe(201)
    expect(res.body!['id']).not.toBe(gone.body!['id'])
  })

  test('9. a key that is not one is refused in words, and nothing is listed', async () => {
    const body = { ...draft, title: 'Feil nøkkel' }
    const res = await call('POST', '/items', { token: ola.token, body, key: 'trykk-2' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      code: 'invalid_idempotency_key',
      message: 'Utkastet har en ugyldig nøkkel. Start annonsen på nytt.',
    })
    expect(await listings(ola.id, 'Feil nøkkel')).toBe(0)
  })
})

describe('from a browser', () => {
  test('10. the header is let through, or the browser would refuse the listing before sending it', async () => {
    const origin = env.CORS_ORIGINS.split(',').map((o) => o.trim()).find(Boolean) ?? 'http://localhost:8080'
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/items',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,idempotency-key',
      },
    })

    expect(res.statusCode).toBeLessThan(300)
    expect(String(res.headers['access-control-allow-headers'])).toContain('idempotency-key')
  })
})

describe('a draft changed after the lost answer', () => {
  const key = newKey()
  let first: Json = {}

  test('11. the changed draft sent with the same key is still the first listing, with 200', async () => {
    first = (await call('POST', '/items', { token: ola.token, body: { ...draft, title: 'Sag' }, key }))
      .body!
    const changed = {
      ...draft,
      title: 'Sag, 60 cm',
      media: ['https://bilder.example/sag.webp', 'https://bilder.example/sag-2.webp'],
    }

    const res = await call('POST', '/items', { token: ola.token, body: changed, key })

    expect(res.status).toBe(200)
    expect(res.body).toEqual(first)
    expect(await listings(ola.id, 'Sag, 60 cm')).toBe(0)
  })

  test('12. the app\'s correction, as «Rediger annonsen» sends it, makes that listing read as the draft', async () => {
    const res = await call('PATCH', `/items/${first['id']}`, {
      token: ola.token,
      body: {
        kind: 'item',
        title: 'Sag, 60 cm',
        description: '',
        category: draft.category,
        subcategory: '',
        condition: draft.condition,
        estimatedValueNok: draft.estimatedValueNok,
        media: ['https://bilder.example/sag.webp', 'https://bilder.example/sag-2.webp'],
      },
    })

    expect(res.status).toBe(200)
    expect(res.body!['id']).toBe(first['id'])
    expect(res.body!['title']).toBe('Sag, 60 cm')
    expect(res.body!['media']).toEqual([
      'https://bilder.example/sag.webp',
      'https://bilder.example/sag-2.webp',
    ])
    expect(await listings(ola.id, 'Sag')).toBe(0)
    expect(await listings(ola.id, 'Sag, 60 cm')).toBe(1)
  })
})

describe('a draft whose listing a trade has reserved since', () => {
  const key = newKey()
  let first: Json = {}

  test('13. handed back all the same, saying it is reserved, and its correction is refused', async () => {
    first = (await call('POST', '/items', { token: ola.token, body: { ...draft, title: 'Høvel' }, key }))
      .body!
    // Ola accepts a trade with it — from another phone — while the draft
    // still waits on this one for an answer that was lost.
    const tent = await makeItem(kari.id, 'Telt')
    const trade = await openTradeFromCycle(db, [
      { userId: kari.id, givesItemId: tent },
      { userId: ola.id, givesItemId: first['id'] },
    ])
    await acceptOffer(db, await currentOffer(trade), kari.id, 'terms-2026-09')
    await acceptOffer(db, await currentOffer(trade), ola.id, 'terms-2026-09')

    const res = await call('POST', '/items', {
      token: ola.token,
      body: { ...draft, title: 'Høvel, nesten ny' },
      key,
    })

    expect(res.status).toBe(200)
    expect(res.body!['id']).toBe(first['id'])
    // What the app reads to let the draft go instead of correcting it.
    expect(res.body!['reserved']).toBe(true)
    expect(res.body!['status']).toBe('reserved')
    const correction = await call('PATCH', `/items/${first['id']}`, {
      token: ola.token,
      body: { title: 'Høvel, nesten ny' },
    })
    expect(correction.status).toBe(400)
    expect(correction.body!['code']).toBe('item_reserved')
    expect(await listings(ola.id, 'Høvel')).toBe(1)
    expect(await listings(ola.id, 'Høvel, nesten ny')).toBe(0)
  })
})
