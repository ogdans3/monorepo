// FLOW — The whole round 5 journey over HTTP
//
// Two people sign up on screen 10c, list things on 10b, find each other on 05,
// like on 04, negotiate on 09a, accept on 06c, hand over on 06f and rate each
// other on 06h. If this passes, every screen has an endpoint behind it.
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

/** What the Flutter client sends: a content type, and sometimes nothing else. */
async function callWithJsonHeader(method: string, url: string, token: string) {
  const res = await app.inject({
    method: method as 'POST',
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

describe('the whole journey over HTTP', () => {
  let ola = '', kari = ''
  let olaId = '', kariId = ''
  let drill = '', helmet = '', console_ = ''
  let tradeId = '', threadId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('10c — signing up gives you a token', async () => {
    const a = await call('POST', '/auth/register', {
      body: { displayName: 'Ola N.', email: 'ola@epost.no', phone: '412 34 567',
              password: 'drillbits123', postalCode: '7030', town: 'Trondheim' },
    })
    expect(a.status).toBe(201)
    ola = a.body!['token']
    olaId = a.body!['user']['id']

    const b = await call('POST', '/auth/register', {
      body: { displayName: 'Kari N.', email: 'kari@epost.no', phone: '911 22 333',
              password: 'fiskestang1', town: 'Trondheim' },
    })
    kari = b.body!['token']
    kariId = b.body!['user']['id']
  })

  test('a POST with nothing to say is not a bad request', async () => {
    // Every action without a payload — the heart, sharing, declining, marking
    // read, signing out — sends a JSON content type and no body. Fastify
    // refuses that by default, which turned the heart into «Noe gikk galt hos
    // oss» on a real phone while every test here passed.
    const res = await callWithJsonHeader('POST', '/auth/logout', ola)
    expect(res.status).toBe(204)

    // And back in, since that just spent the token.
    const again = await call('POST', '/auth/login', {
      body: { email: 'ola@epost.no', password: 'drillbits123' },
    })
    ola = again.body!['token']
  })

  test('16c — the same address and password logs you back in, a wrong one does not', async () => {
    expect((await call('POST', '/auth/login', { body: { email: 'ola@epost.no', password: 'drillbits123' } })).status).toBe(200)
    expect((await call('POST', '/auth/login', { body: { email: 'ola@epost.no', password: 'feil' } })).status).toBe(401)
  })

  test('02 — interests are three to five', async () => {
    expect((await call('PUT', '/me/interests', { token: ola, body: { interests: ['verktoy', 'gaming'] } })).status).toBe(400)

    const ok = await call('PUT', '/me/interests', {
      token: ola, body: { interests: ['verktoy', 'gaming', 'sykling'] },
    })
    expect(ok.status).toBe(200)
    expect(ok.body!['interests']).toEqual(['verktoy', 'gaming', 'sykling'])
  })

  test('10b — listing things, with and without photos', async () => {
    const a = await call('POST', '/items', {
      token: ola,
      body: { title: 'Bosch drill 18V', description: 'Lite brukt', category: 'verktoy',
              subcategory: 'Elektroverktøy', condition: 'good', estimatedValueNok: 600,
              media: ['https://img/drill.webp'] },
    })
    expect(a.status).toBe(201)
    drill = a.body!['id']

    // No photo at all is allowed; discovery draws a generated card.
    const b = await call('POST', '/items', {
      token: ola,
      body: { title: 'Sykkelhjelm', category: 'sykling', condition: 'good', estimatedValueNok: 250 },
    })
    helmet = b.body!['id']
    expect(b.body!['cover']).toBeNull()

    const c = await call('POST', '/items', {
      token: kari,
      body: { title: 'Retro spillkonsoll', category: 'gaming', condition: 'good',
              estimatedValueNok: 1200 },
    })
    console_ = c.body!['id']
  })

  test('10b — a gadget without a condition is refused', async () => {
    const res = await call('POST', '/items', {
      token: ola, body: { title: 'Uten tilstand', category: 'hjem' },
    })
    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('condition_required')
  })

  test('05 — search finds the other person’s things, never your own', async () => {
    const res = await call('GET', '/discover?q=konsoll', { token: ola })
    expect(res.body!['total']).toBe(1)
    expect(res.body!['items'][0]['title']).toBe('Retro spillkonsoll')

    const mine = await call('GET', '/discover?q=drill', { token: ola })
    expect(mine.body!['total']).toBe(0)
  })

  test('05 — the rows before a search come from your interests', async () => {
    const res = await call('GET', '/discover/rows', { token: ola })
    const gaming = res.body!['rows'].find((r: Json) => r['category'] === 'gaming')
    expect(gaming['items']).toHaveLength(1)
  })

  test('04 — the item page carries its owner and their rating', async () => {
    const res = await call('GET', `/items/${console_}`, { token: ola })
    expect(res.body!['owner']['displayName']).toBe('Kari N.')
    expect(res.body!['likedByMe']).toBe(false)
  })

  test('04 — writing the first message opens the trade', async () => {
    const res = await call('POST', `/items/${console_}/message`, {
      token: ola, body: { body: 'Hei! Er konsollen ledig?' },
    })
    expect(res.status).toBe(201)
    threadId = res.body!['threadId']

    const thread = await call('GET', `/threads/${threadId}`, { token: ola })
    expect(thread.body!['messages']).toHaveLength(1)
    expect(thread.body!['banner']).toBeNull()
  })

  test('04 — the heart is what closes a loop', async () => {
    const first = await call('POST', `/items/${console_}/like`, { token: ola })
    expect(first.body!['tradeId']).toBeNull()

    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    expect(closing.body!['tradeId']).not.toBeNull()
    tradeId = closing.body!['tradeId']
  })

  test('06b — the trade reads in the second person', async () => {
    const res = await call('GET', `/trades/${tradeId}`, { token: ola })
    expect(res.body!['kind']).toBe('direct')
    expect(res.body!['youGet'][0]['title']).toBe('Retro spillkonsoll')
    expect(res.body!['youGive'][0]['title']).toBe('Bosch drill 18V')
    expect(res.body!['youGetValue']).toBe(1200)
    expect(res.body!['difference']).toBe(600)
  })

  test('09a — a counter-offer adds the helmet and 350 kroner', async () => {
    // Positions come from the cycle, not from the order anyone typed them in.
    const before = await call('GET', `/trades/${tradeId}`, { token: ola })
    const mine = before.body!['you']['position']
    const theirs = before.body!['receivingFrom']['position'] ?? (mine === 0 ? 1 : 0)

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola,
      body: {
        items: [
          { itemId: drill, giverPosition: mine },
          { itemId: helmet, giverPosition: mine },
          { itemId: console_, giverPosition: theirs },
        ],
        cash: { payerPosition: mine, payeePosition: theirs, amountNok: 350 },
      },
    })
    expect(res.body!['state']).toBe('countered')
    expect(res.body!['youGive']).toHaveLength(2)
    expect(res.body!['cash']['youPay']).toBe(true)
    expect(res.body!['cash']['amountNok']).toBe(350)
  })

  test('06f — the counterparty’s Vipps number is shown, never used', async () => {
    const res = await call('GET', `/trades/${tradeId}`, { token: ola })
    expect(res.body!['cash']['payeePhone']).toBe('911 22 333')
  })

  test('09b — things held by another trade come back marked locked', async () => {
    const res = await call('GET', `/trades/${tradeId}/candidates`, { token: ola })
    const titles = res.body!['yours'].map((i: Json) => i['title'])
    expect(titles).toContain('Sykkelhjelm')
    expect(res.body!['yours'].every((i: Json) => i['lockedByOtherTrade'] === false)).toBe(true)
  })

  test('06c — accepting reserves only your own things', async () => {
    const res = await call('POST', `/trades/${tradeId}/accept`, {
      token: ola, body: { termsVersion: '2026-09-06' },
    })
    expect(res.body!['everyoneAccepted']).toBe(false)
    expect(res.body!['reserved']).toHaveLength(2)

    const theirs = await call('GET', `/items/${console_}`, { token: kari })
    expect(theirs.body!['reserved']).toBe(false)
  })

  test('06c — the second acceptance agrees the trade', async () => {
    const res = await call('POST', `/trades/${tradeId}/accept`, { token: kari })
    expect(res.body!['everyoneAccepted']).toBe(true)
    expect(res.body!['trade']['state']).toBe('accepted')
  })

  test('08a — asking to withdraw pauses the trade while the other answers', async () => {
    const res = await call('POST', `/trades/${tradeId}/withdrawal`, { token: ola })
    expect(res.body!['blocked']).toBe(false)
    expect(res.body!['trade']['state']).toBe('paused')
    expect(res.body!['trade']['withdrawal']['byYou']).toBe(true)
  })

  test('08b — undoing the request puts the trade back', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: ola })
    expect(res.body!['state']).toBe('accepted')
  })

  test('06f — the handover markers are self-reported', async () => {
    await call('POST', `/trades/${tradeId}/mark`, { token: ola, body: { marker: 'paid' } })
    const res = await call('POST', `/trades/${tradeId}/mark`, { token: ola, body: { marker: 'sent' } })
    expect(res.body!['complete']).toBe(false)
    expect(res.body!['trade']['you']['sentAt']).not.toBeNull()
  })

  test('08c — once the other side has sent, you cannot withdraw', async () => {
    const res = await call('POST', `/trades/${tradeId}/withdrawal`, { token: kari })
    expect(res.body!['blocked']).toBe(true)
    expect(res.body!['trade']['withdrawal']['blockedBySent']).toBe(true)
    expect(res.body!['trade']['state']).toBe('accepted')
  })

  test('09h — when everyone has sent and received, the trade completes itself', async () => {
    await call('POST', `/trades/${tradeId}/mark`, { token: ola, body: { marker: 'received' } })
    await call('POST', `/trades/${tradeId}/mark`, { token: kari, body: { marker: 'sent' } })
    const res = await call('POST', `/trades/${tradeId}/mark`, { token: kari, body: { marker: 'received' } })

    expect(res.body!['complete']).toBe(true)
    expect(res.body!['trade']['state']).toBe('completed')
    expect(res.body!['trade']['snapshots']).toHaveLength(3)
  })

  test('06h — rating the counterparty moves their profile rating', async () => {
    const res = await call('POST', `/trades/${tradeId}/reviews`, {
      token: ola, body: { ratee: kariId, score: 5, comment: 'Rask og hyggelig, alt som avtalt' },
    })
    expect(res.status).toBe(201)

    const profile = await call('GET', `/users/${kariId}`, { token: ola })
    expect(profile.body!['ratingAvg']).toBe(5)
    expect(profile.body!['ratingCount']).toBe(1)
  })

  test('06i — feedback about Swaply is a different thing from a review', async () => {
    const res = await call('POST', '/feedback', {
      token: ola, body: { score: 4, chips: ['Mellomlegg', 'Frakt'], comment: 'Bra nok' },
    })
    expect(res.status).toBe(201)
  })

  test('12 — your things come back with the people who liked them', async () => {
    const res = await call('GET', '/me/liked-by', { token: ola })
    const liked = res.body!['items'].find((row: Json) => row['item']['title'] === 'Bosch drill 18V')
    expect(liked['likers'][0]['displayName']).toBe('Kari N.')
  })

  test('11 — both trades are finished: one completed, one displaced', async () => {
    const res = await call('GET', '/trades', { token: ola })

    // The conversation started on screen 04 was a trade too, and it was closed
    // the moment the console got reserved by the one that went through.
    expect(res.body!['waiting']).toHaveLength(0)
    expect(res.body!['active']).toHaveLength(0)
    expect(res.body!['done'].map((t: Json) => t['state']).sort()).toEqual(['cancelled', 'completed'])
    expect(res.body!['done'].find((t: Json) => t['state'] === 'cancelled')['closeReason'])
      .toContain('reservert av et annet bytte')
  })

  test('11a — the chat list says what each conversation is about', async () => {
    const res = await call('GET', '/threads', { token: ola })
    expect(res.body!['threads'].length).toBeGreaterThan(0)
    expect(res.body!['threads'][0]['subject']).toBeTruthy()
  })

  test('12a — the notification payload carries ids, not sentences', async () => {
    const res = await call('GET', '/notifications', { token: kari })
    const liked = res.body!['notifications'].find((n: Json) => n['type'] === 'item_liked')
    expect(liked['payload']['itemId']).toBeTruthy()
    expect(JSON.stringify(liked['payload'])).not.toContain('Ola')
  })

  test('16a — reporting can block in the same gesture, and blocking hides them', async () => {
    const res = await call('POST', '/reports', {
      token: kari, body: { targetItem: helmet, reason: 'spam', block: true },
    })
    expect(res.body!['blocked']).toBe(true)

    const discover = await call('GET', '/discover', { token: kari })
    expect(discover.body!['items'].every((i: Json) => i['ownerId'] !== olaId)).toBe(true)
  })

  test('a request without a token is refused', async () => {
    expect((await call('GET', '/trades')).status).toBe(401)
    expect((await call('GET', '/me')).status).toBe(401)
  })
})
