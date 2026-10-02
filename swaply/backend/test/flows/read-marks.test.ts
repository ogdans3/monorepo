// FLOW — What has been read, and who is told a message came
//
// The rule this exists to pin down: **a read mark moves only over what the
// person has had in front of them.** The app says which message its screen
// showed last (`upTo`), and the mark moves up to and including it, never back;
// a message that arrived after the screen loaded stays unread. Writing in a
// conversation is reading it, so whoever writes has read up to what they
// wrote. And every message into a conversation that exists tells the others,
// wherever it was written from.
//
// Until this, «marked read» meant every message in the thread when the
// request arrived — including one that came in after the screen loaded and
// was never seen. Your own reply left the messages it answered unread. And a
// second message from the box on 04 went into the conversation without a
// notification, where the same words from the thread's own field had one.
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
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

async function unread(who: Person): Promise<number> {
  return (await call('GET', '/threads', { token: who.token })).body!['unreadTotal']
}

/** Unread in one conversation, as the row on 11a counts it. */
async function unreadIn(threadId: string, who: Person): Promise<number> {
  const rows = (await call('GET', '/threads', { token: who.token })).body!['threads'] as Json[]
  return rows.find((row) => row['id'] === threadId)!['unread']
}

async function messages(threadId: string, who: Person): Promise<Json[]> {
  return (await call('GET', `/threads/${threadId}`, { token: who.token })).body!['messages']
}

async function write(threadId: string, who: Person, body: string) {
  const res = await call('POST', `/threads/${threadId}/messages`, { token: who.token, body: { body } })
  expect(res.status).toBe(201)
  return res.body!['id'] as string
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('read marks', () => {
  let ola: Person, kari: Person
  let drill = '', threadId = '', tradeId = ''

  beforeAll(async () => {
    ola = await register('Ola')
    kari = await register('Kari')
    drill = (await call('POST', '/items', {
      token: ola.token,
      body: { title: 'Bosch drill 18V', category: 'verktoy', condition: 'good' },
    })).body!['id']
  })

  test('1. Kari’s first message from 04 opens the conversation, and Ola is told', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: kari.token, body: { body: 'Hei! Er drillen ledig?' },
    })
    threadId = res.body!['threadId']
    tradeId = res.body!['tradeId']

    const told = (await call('GET', '/notifications', { token: ola.token })).body!['notifications']
    expect(told.filter((n: Json) => n['type'] === 'message')).toHaveLength(1)
  })

  test('2. a second message from 04 is told too, as a message in that conversation', async () => {
    const res = await call('POST', `/items/${drill}/message`, {
      token: kari.token, body: { body: 'Jeg kan hente den i kveld.' },
    })
    expect(res.body!['tradeId']).toBe(tradeId)

    const told = (await call('GET', '/notifications', { token: ola.token })).body!['notifications']
      .filter((n: Json) => n['type'] === 'message')
    expect(told).toHaveLength(2)
    // Newest first, and the same payload the thread's own field writes.
    expect(told[0]['payload']).toEqual({ threadId })
  })

  test('3. Ola’s screen showed two messages, and a third came before he said so: it stays unread', async () => {
    const shown = await messages(threadId, ola)
    expect(shown).toHaveLength(2)
    await write(threadId, kari, 'Eller i morgen?')

    const res = await call('POST', `/threads/${threadId}/read`, {
      token: ola.token, body: { upTo: shown[1]!['id'] },
    })

    expect(res.status).toBe(204)
    expect(await unread(ola)).toBe(1)
  })

  test('4. marking up to an older message does not make the newer ones unread again', async () => {
    const all = await messages(threadId, ola)
    await call('POST', `/threads/${threadId}/read`, { token: ola.token, body: { upTo: all[2]!['id'] } })
    expect(await unread(ola)).toBe(0)

    await call('POST', `/threads/${threadId}/read`, { token: ola.token, body: { upTo: all[0]!['id'] } })
    expect(await unread(ola)).toBe(0)
  })

  test('5. a message from another conversation is no place to mark up to', async () => {
    const tent = (await call('POST', '/items', {
      token: kari.token,
      body: { title: 'Telt', category: 'friluft', condition: 'good' },
    })).body!['id']
    const other = await call('POST', `/items/${tent}/message`, {
      token: ola.token, body: { body: 'Er teltet ledig?' },
    })
    const elsewhere = (await messages(other.body!['threadId'], ola))[0]!['id']
    await write(threadId, kari, 'Hallo?')

    const res = await call('POST', `/threads/${threadId}/read`, {
      token: ola.token, body: { upTo: elsewhere },
    })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ code: 'not_found', message: 'Fant ikke meldingen.' })
    expect(await unread(ola)).toBe(1)
  })

  test('6. answering is reading: Ola’s reply marks what it answers, with no read sent', async () => {
    const reply = await write(threadId, ola, 'Ja, den er ledig!')

    expect(await unread(ola)).toBe(0)
    const marks = (await call('GET', `/threads/${threadId}`, { token: ola.token })).body!['readBy']
    expect(marks.find((m: Json) => m['userId'] === ola.id)['lastReadMessageId']).toBe(reply)
  })

  test('7. and so is answering from the box on 04', async () => {
    expect(await unreadIn(threadId, kari)).toBe(1)

    await call('POST', `/items/${drill}/message`, { token: kari.token, body: { body: 'Supert!' } })

    expect(await unreadIn(threadId, kari)).toBe(0)
  })

  test('8. a read without upTo, as the released app sends, reads everything there is', async () => {
    await write(threadId, kari, 'Ses!')
    // «Supert!» from 04, and this.
    expect(await unreadIn(threadId, ola)).toBe(2)

    expect((await call('POST', `/threads/${threadId}/read`, { token: ola.token })).status).toBe(204)
    expect(await unread(ola)).toBe(0)
  })
})
