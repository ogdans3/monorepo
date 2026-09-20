// FLOW — Rating somebody you actually traded with
//
// The rule this exists to pin down: a review is what happened **after a
// completed trade**. `docs/DESIGN.md` puts both kinds of feedback there, and
// the screens agree — 06h comes off 09h, and 07l asks about a chain we were
// not part of. A rating given before anything happened is a rating of nothing,
// and it moves a number that the whole trust model leans on.
//
// The rest is who: only the people in the trade, never yourself, and the
// profile average is recomputed rather than nudged, so editing a review cannot
// drift it.
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

describe('rating the counterparty', () => {
  let ola = '', kari = '', per = ''
  let olaId = '', kariId = '', perId = ''
  let drill = '', tent = ''
  let tradeId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    const c = await register('Per N.', 'per@epost.no')
    ;[ola, olaId] = [a.token, a.id]
    ;[kari, kariId] = [b.token, b.id]
    ;[per, perId] = [c.token, c.id]

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')

    await call('POST', `/items/${tent}/like`, { token: ola })
    tradeId = (await call('POST', `/items/${drill}/like`, { token: kari })).body!['tradeId']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. there is nothing to rate before the trade has happened', async () => {
    const res = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: kariId, score: 1 },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_completed')
  })

  test('2. nor while it is merely agreed and the things are still in the post', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: ola })
    await call('POST', `/trades/${tradeId}/accept`, { token: kari })

    const res = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: kariId, score: 5 },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_completed')
  })

  test('3. once both have sent and received, it is a thing that happened', async () => {
    for (const token of [ola, kari]) {
      await call('POST', `/trades/${tradeId}/mark`, { token, body: { marker: 'sent' } })
      await call('POST', `/trades/${tradeId}/mark`, { token, body: { marker: 'received' } })
    }

    const res = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: kariId, score: 5, comment: 'Rask og hyggelig, alt som avtalt' },
    })

    expect(res.status).toBe(201)
    expect((await call('GET', `/users/${kariId}`, { token: ola })).body!['ratingAvg']).toBe(5)
  })

  test('4. you cannot rate yourself, and a stranger cannot rate either of us', async () => {
    const self = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: olaId, score: 5 },
    })
    expect(self.status).toBe(400)
    expect(self.body!['code']).toBe('self_review')

    const outsider = await call('POST', `/trades/${tradeId}/reviews`, {
      token: per, body: { ratee: kariId, score: 1 },
    })
    expect(outsider.status).toBe(403)

    const absent = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: perId, score: 1 },
    })
    expect(absent.status).toBe(403)
  })

  test('5. changing your mind replaces the review rather than adding one', async () => {
    await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: kariId, score: 3, comment: 'Litt treg' },
    })

    const kariNow = await call('GET', `/users/${kariId}`, { token: ola })
    expect(kariNow.body!['ratingAvg']).toBe(3)
    expect(kariNow.body!['ratingCount']).toBe(1)
  })

  test('6. a score outside the five stars is not a score', async () => {
    for (const score of [0, 6, 42]) {
      const res = await call('POST', `/trades/${tradeId}/reviews`, {
        token: kari, body: { ratee: olaId, score },
      })
      expect(res.status, `score ${score}`).toBe(400)
    }
  })

  test('7. feedback about Swaply is about us, and needs no trade at all', async () => {
    const res = await call('POST', '/feedback', {
      token: ola, body: { score: 4, chips: ['Frakt'], comment: 'Fin flyt' },
    })
    expect(res.status).toBe(201)
  })

  // Stars without words is the ordinary review, not the exception, and a
  // client with nothing to put in a field sends `null` rather than leaving the
  // key out — that is what encoding an absent string produces. Refusing it
  // made both screens demand a sentence before they would go through.
  test('8. four stars and not a word is a whole review', async () => {
    const review = await call('POST', `/trades/${tradeId}/reviews`, {
      token: kari, body: { ratee: olaId, score: 4, comment: null, chips: [] },
    })
    expect(review.status).toBe(201)

    const feedback = await call('POST', '/feedback', {
      token: kari, body: { score: 5, chips: [], comment: null },
    })
    expect(feedback.status).toBe(201)

    // And the same for the report sheet, which has a detail box nobody has to
    // fill in either.
    const report = await call('POST', '/reports', {
      token: kari, body: { targetItem: drill, targetUser: null, reason: 'spam', detail: null },
    })
    expect(report.status).toBe(201)
  })

  // Nothing in the product speaks English to anybody, and a request that does
  // not fit a schema is not the one exception: «Expected string, received
  // null» is what used to come back here. See backend/src/lib/validation.ts.
  test('9. a refusal is written in Norwegian', async () => {
    const res = await call('POST', '/feedback', {
      token: ola, body: { score: 'fem' },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('invalid_request')
    expect(res.body!['message']).not.toMatch(/[Ee]xpected|[Rr]eceived|[Ii]nvalid/)
    expect(res.body!['field']).toBe('score')

    // A message written into a schema still wins over the fallback, which is
    // the whole reason this is a global map rather than a message per field.
    const short = await call('POST', '/auth/register', {
      body: { displayName: 'Nils N.', email: 'nils@epost.no', password: 'kort' },
    })
    expect(short.body!['message']).toBe('Passordet må ha minst 8 tegn.')
  })
})
