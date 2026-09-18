// FLOW — The conversation, and what it outlives
//
// The rule this exists to pin down: **every thread belongs to a trade, and the
// first message creates one.** There is no free-floating conversation to model,
// which is what makes the four cases on `docs/DESIGN.md`'s chat list fall out
// of the model rather than needing rules of their own.
//
// The other half is what the screens promise in writing. 09g says «Ola får
// beskjed, samtalen beholdes» — so ending a trade must not take the
// conversation with it, and a thread has to keep working after the trade it
// belongs to is over. Read state is per participant, and a session is a
// credential that can be taken back.
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

describe('a conversation and the trade it belongs to', () => {
  let ola = '', kari = '', per = ''
  let olaId = ''
  let drill = '', tent = ''
  let tradeId = '', threadId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    const c = await register('Per N.', 'per@epost.no')
    ;[ola, olaId] = [a.token, a.id]
    kari = b.token
    per = c.token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. with no trade between them there is no thread to open', async () => {
    const res = await call('GET', '/threads', { token: kari })

    expect(res.body!['threads']).toEqual([])
    expect(res.body!['unreadTotal']).toBe(0)
  })

  test('2. writing the first message is what makes both', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: kari, body: { body: 'Hei! Er drillen fortsatt ledig?' },
    })

    expect(res.status).toBe(201)
    tradeId = res.body!['tradeId']
    threadId = res.body!['threadId']

    const trade = await call('GET', `/trades/${tradeId}`, { token: kari })
    expect(trade.body!['state']).toBe('talking')
  })

  test('3. a second message goes to the same place, not into a second trade', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: kari, body: { body: 'Jeg kan bytte mot et telt.' },
    })

    expect(res.body!['tradeId']).toBe(tradeId)
    expect((await call('GET', '/threads', { token: kari })).body!['threads']).toHaveLength(1)
  })

  test('4. writing to yourself is not a conversation', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: ola, body: { body: 'Hei meg' },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('own_item')
  })

  test('5. nobody else can read it, or write into it', async () => {
    expect((await call('GET', `/threads/${threadId}`, { token: per })).status).toBe(403)
    expect(
      (await call('POST', `/threads/${threadId}/messages`, {
        token: per, body: { body: 'Hei alle' },
      })).status,
    ).toBe(403)
  })

  test('6. unread is per participant, and reading is not a thing the sender does', async () => {
    const forOla = await call('GET', '/threads', { token: ola })
    expect(forOla.body!['unreadTotal']).toBe(2)

    const forKari = await call('GET', '/threads', { token: kari })
    expect(forKari.body!['unreadTotal']).toBe(0)

    await call('POST', `/threads/${threadId}/read`, { token: ola })
    expect((await call('GET', '/threads', { token: ola })).body!['unreadTotal']).toBe(0)
    // Ola reading changes nothing for Kari, who has not read his reply yet.
    await call('POST', `/threads/${threadId}/messages`, {
      token: ola, body: { body: 'Ja, den er ledig!' },
    })
    expect((await call('GET', '/threads', { token: kari })).body!['unreadTotal']).toBe(1)
  })

  test('7. the row says what the conversation is about', async () => {
    const row = (await call('GET', '/threads', { token: kari })).body!['threads'][0]

    expect(row['kind']).toBe('direct')
    expect(row['subject']).toContain('Bosch drill 18V')
    expect(row['others']).toHaveLength(1)
    expect(row['others'][0]['displayName']).toBe('Ola N.')
  })

  test('7b. it is not your turn on a deal that still has an empty side', async () => {
    // Kari puts the drill back on the table and nothing of her own with it —
    // a real move in a negotiation, and one the other side cannot answer yes
    // to. «Din tur» and the badge on Bytter both mean «somebody is waiting for
    // you to say yes», so counting this sends Ola to a screen with nothing to
    // press.
    const view = await call('GET', `/trades/${tradeId}`, { token: kari })
    const theirs = view.body!['receivingFrom']['position']

    const countered = await call('POST', `/trades/${tradeId}/counter`, {
      token: kari, body: { items: [{ itemId: drill, giverPosition: theirs }] },
    })
    expect(countered.status).toBe(200)
    expect(countered.body!['state']).toBe('countered')

    const list = await call('GET', '/trades', { token: ola })
    expect(list.body!['waiting']).toHaveLength(1)
    expect(list.body!['yourTurn']).toBe(0)
    expect((await call('GET', '/me', { token: ola })).body!['tradesNeedingYou']).toBe(0)
  })

  test('8. ending the trade keeps the conversation, which 09g promises in writing',
    async () => {
      // «Ola får beskjed, samtalen beholdes.» A thread that dies with its trade
      // would make that sentence untrue on the screen that says it.
      expect((await call('POST', `/trades/${tradeId}/decline`, { token: kari })).status).toBe(200)

      const thread = await call('GET', `/threads/${threadId}`, { token: kari })
      expect(thread.status).toBe(200)
      expect(thread.body!['messages']).toHaveLength(3)
      expect(thread.body!['state']).toBe('cancelled')

      const posted = await call('POST', `/threads/${threadId}/messages`, {
        token: kari, body: { body: 'Beklager, fant noe annet.' },
      })
      expect(posted.status).toBe(201)
    })

  test('9. and writing about the listing again opens a new trade, not the dead one',
    async () => {
      const res = await call('POST', `/items/${drill}/message`, {
        token: kari, body: { body: 'Ombestemte meg — er den fortsatt ledig?' },
      })

      expect(res.status).toBe(201)
      expect(res.body!['tradeId']).not.toBe(tradeId)
      expect((await call('GET', '/threads', { token: kari })).body!['threads']).toHaveLength(2)
    })

  test('10. a chain puts all three in one thread, with the banner that cannot be closed',
    async () => {
      const bike = await list(per, 'Bysykkel, dame')
      await call('POST', `/items/${tent}/like`, { token: ola })
      await call('POST', `/items/${bike}/like`, { token: kari })
      const closing = await call('POST', `/items/${drill}/like`, { token: per })

      const trade = await call('GET', `/trades/${closing.body!['tradeId']}`, { token: ola })
      const thread = await call('GET', `/threads/${trade.body!['threadId']}`, { token: ola })

      expect(thread.body!['kind']).toBe('chain')
      expect(thread.body!['participants']).toHaveLength(3)
      expect(thread.body!['banner']).toBe(
        'Swaply fasiliterer ikke dette byttet. Dere avtaler overlevering, mellomlegg og ' +
          'eventuell frakt selv i denne chatten.',
      )
    })

  test('11. an empty message is not a message, however it is spelled', async () => {
    for (const body of ['', '   ', '\n\n']) {
      const res = await call('POST', `/threads/${threadId}/messages`, {
        token: kari, body: { body },
      })
      expect(res.status, JSON.stringify(body)).toBe(400)
    }

    // And the same going the other way, where the message also opens a trade.
    const opening = await call('POST', `/items/${drill}/message`, {
      token: per, body: { body: '   ' },
    })
    expect(opening.status).toBe(400)
  })

  test('11b. and a listing with a blank name is not a listing', async () => {
    // The same class of thing one screen over: the collage would draw a card
    // with nothing written on it, and «  » is a title the column accepts.
    const res = await call('POST', '/items', {
      token: ola,
      body: { title: '   ', category: 'verktoy', condition: 'good' },
    })

    expect(res.status).toBe(400)
  })

  test('12. signing out takes the session with it', async () => {
    const extra = await call('POST', '/auth/login', {
      body: { email: 'ola@epost.no', password: 'byttehandel1' },
    })
    const second = extra.body!['token']

    expect((await call('POST', '/auth/logout', { token: second })).status).toBe(204)
    expect((await call('GET', '/me', { token: second })).status).toBe(401)
    // The other device is still signed in: a session is a credential of its own.
    expect((await call('GET', '/me', { token: ola })).body!['id']).toBe(olaId)
  })
})
