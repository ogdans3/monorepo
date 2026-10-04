// FLOW — Blocking somebody, and what it is worth
//
// The rule this exists to pin down: `docs/DESIGN.md` says a block means
// «blocked users' items are hidden and can't match». In a matching product
// that has to hold in both directions and on every surface, or it is a setting
// rather than a protection: hidden on Oppdag but reachable from a profile,
// or unable to match directly but able to arrive through a chain, or unable to
// match at all but able to open a conversation.
//
// Blocking is also not reporting. Reports are reviewed by a person and outlive
// the reported user; a block is immediate and is the blocker's own.
//
// And a block reaches what is already going on, not only what has yet to
// start. Every negotiation the two share ends when it is made, with the code
// `blocked` and words that do not say who blocked whom, and the others in it
// are told. It used to be a row and nothing else: the chat, the counter-offers
// and the yes all went on as before.
//
// A trade the two have both agreed to refuses the block: it is finished, or
// left through the withdrawal question, first — the product owner's rule of
// 04.10.2026 — and reporting is never refused. A block from before that rule
// can still stand beside an agreed trade, and across it nobody writes,
// proposes or says yes, and no notification crosses it.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, itemRow, reset, tradeState } from '../helpers.js'

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

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('blocking somebody', () => {
  let ola = '', kari = '', per = ''
  let olaId = '', kariId = ''
  let drill = '', tent = '', bike = ''

  beforeAll(async () => {
    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    const c = await register('Per N.', 'per@epost.no')
    ;[ola, olaId] = [a.token, a.id]
    ;[kari, kariId] = [b.token, b.id]
    per = c.token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')
    bike = await list(per, 'Bysykkel, dame')
  })

  test('1. before anything, each of them can see the others', async () => {
    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title']).sort()).toEqual([
      'Bysykkel, dame',
      'Telt, 3 personer',
    ])
  })

  test('2. Ola blocks Kari, and her things go from his page', async () => {
    expect((await call('POST', `/blocks/${kariId}`, { token: ola })).status).toBe(204)

    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title'])).toEqual(['Bysykkel, dame'])
  })

  test('3. and his go from hers, because a block hides both ways', async () => {
    const seen = await call('GET', '/discover', { token: kari })
    expect(seen.body!['items'].map((i: Json) => i['title'])).toEqual(['Bysykkel, dame'])
  })

  test('4. her profile no longer hands out what her page would not show', async () => {
    // Hidden on one surface and listed on another is not hidden. 13b is one
    // tap from a chat row, a notification or an old conversation.
    const profile = await call('GET', `/users/${kariId}`, { token: ola })

    expect(profile.body!['blockedByYou']).toBe(true)
    expect(profile.body!['items']).toEqual([])
  })

  test('5. nor can he open the listing itself by its id', async () => {
    const item = await call('GET', `/items/${tent}`, { token: ola })

    expect(item.status).toBe(404)
  })

  test('6. no wish of his can reach her', async () => {
    const res = await call('POST', `/items/${tent}/like`, { token: ola })

    expect(res.status).toBe(403)
    expect(res.body!['code']).toBe('blocked')
  })

  test('7. and no conversation either, in either direction', async () => {
    const his = await call('POST', `/items/${tent}/message`, {
      token: ola, body: { body: 'Hei igjen' },
    })
    expect(his.status).toBe(403)

    const hers = await call('POST', `/items/${drill}/message`, {
      token: kari, body: { body: 'Hei' },
    })
    expect(hers.status).toBe(403)
  })

  test('8. a chain cannot route around it either', async () => {
    // Everybody in a three-cycle is next to everybody else, so a ring holding
    // both of them needs an edge between them — and that edge is the one thing
    // that is refused. Ola→Per and Per→Kari are fine and close nothing.
    expect((await call('POST', `/items/${bike}/like`, { token: ola })).status).toBe(200)
    expect((await call('POST', `/items/${tent}/like`, { token: per })).status).toBe(200)

    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    expect(closing.status).toBe(403)

    const trades = await call('GET', '/trades', { token: per })
    expect(trades.body!['waiting']).toEqual([])
  })

  test('9. unblocking gives everything back', async () => {
    expect((await call('DELETE', `/blocks/${kariId}`, { token: ola })).status).toBe(204)

    const seen = await call('GET', '/discover', { token: ola })
    expect(seen.body!['items'].map((i: Json) => i['title']).sort()).toEqual([
      'Bysykkel, dame',
      'Telt, 3 personer',
    ])
    expect((await call('GET', `/items/${tent}`, { token: ola })).status).toBe(200)
    expect((await call('GET', `/users/${kariId}`, { token: ola })).body!['items']).toHaveLength(1)
  })

  test('10. and the ring that was refused while blocked closes now', async () => {
    // Ola→Per→Kari→Ola, the one from step 8, with the edge that was refused
    // put back.
    const closing = await call('POST', `/items/${drill}/like`, { token: kari })

    expect(closing.status).toBe(200)
    expect(closing.body!['tradeId']).not.toBeNull()

    const view = await call('GET', `/trades/${closing.body!['tradeId']}`, { token: ola })
    expect(view.body!['kind']).toBe('chain')
    expect(view.body!['participants']).toHaveLength(3)
  })
})

describe('a block made while the two are already negotiating', () => {
  type Person = { token: string; id: string }
  let siri: Person, tor: Person, una: Person
  let guitar = '', skis = '', tent = '', kayak = '', lamp = '', bike = ''
  let agreed = '', talking = '', ring = ''

  /** What a person has been told about one trade, by type. */
  async function told(who: Person, tradeId: string, type: string) {
    const res = await call('GET', '/notifications', { token: who.token })
    return (res.body!['notifications'] as Json[])
      .filter((n) => n['type'] === type && n['payload']['tradeId'] === tradeId)
      .map((n) => n['payload'])
  }

  async function messagesTold(who: Person): Promise<number> {
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from notifications where user_id = ${who.id} and type = 'message'`,
    )
    return row!.n
  }

  async function threadOf(tradeId: string, who: Person) {
    return (await call('GET', `/trades/${tradeId}`, { token: who.token })).body!['threadId'] as string
  }

  beforeAll(async () => {
    siri = await register('Siri N.', 'siri@epost.no')
    tor = await register('Tor N.', 'tor@epost.no')
    una = await register('Una N.', 'una@epost.no')
    guitar = await list(siri.token, 'Klassisk gitar')
    skis = await list(siri.token, 'Langrennski')
    tent = await list(siri.token, 'Telt, 2 personer')
    kayak = await list(tor.token, 'Kajakk med åre')
    lamp = await list(tor.token, 'Byggelampe')
    bike = await list(una.token, 'Terrengsykkel')
  })

  async function blocks(): Promise<number> {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from blocks`)
    return row!.n
  }

  async function reports(): Promise<number> {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from reports`)
    return row!.n
  }

  test('11. Siri and Tor have agreed one swap, the tent for the kayak', async () => {
    await call('POST', `/items/${kayak}/like`, { token: siri.token })
    agreed = (await call('POST', `/items/${tent}/like`, { token: tor.token })).body!['tradeId']
    for (const who of [siri, tor]) {
      expect((await call('POST', `/trades/${agreed}/accept`, { token: who.token })).status).toBe(200)
    }
    expect(await tradeState(agreed)).toBe('accepted')
  })

  test('12. are talking about her guitar, and are in a ring of three with Una, who has said yes', async () => {
    const res = await call('POST', `/items/${guitar}/message`, {
      token: tor.token, body: { body: 'Hei! Er gitaren ledig?' },
    })
    talking = res.body!['tradeId']

    // Siri wants the lamp, Tor the bike, Una the skis.
    await call('POST', `/items/${lamp}/like`, { token: siri.token })
    await call('POST', `/items/${bike}/like`, { token: tor.token })
    ring = (await call('POST', `/items/${skis}/like`, { token: una.token })).body!['tradeId']
    expect(ring).toBeTruthy()
    expect((await call('POST', `/trades/${ring}/accept`, { token: una.token })).status).toBe(200)
    expect((await itemRow(bike))['active_trade_id']).toBe(ring)
  })

  test('13. Siri cannot block Tor while the swap they agreed stands, and nothing ends', async () => {
    const res = await call('POST', `/blocks/${tor.id}`, { token: siri.token })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      code: 'agreed_trade',
      message:
        'Dere har et godtatt bytte på gang, så du kan ikke blokkere ennå. Fullfør byttet eller ' +
        'trekk deg fra det først. Du kan rapportere uansett.',
    })
    expect(await blocks()).toBe(0)
    expect(await tradeState(agreed)).toBe('accepted')
    expect(await tradeState(talking)).toBe('talking')
    expect(await tradeState(ring)).toBe('pending')
  })

  test('14. nor with «Blokkér» ticked on a report, which then sends nothing at all', async () => {
    const before = await reports()
    const res = await call('POST', '/reports', {
      token: siri.token, body: { targetUser: tor.id, reason: 'inappropriate', block: true },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('agreed_trade')
    expect(res.body!['message']).toContain('Fjern krysset for å sende rapporten')
    // One gesture, one outcome: no report to be sent twice by the second press.
    expect(await reports()).toBe(before)
    expect(await blocks()).toBe(0)
  })

  test('15. but the report itself always goes through', async () => {
    const before = await reports()
    const res = await call('POST', '/reports', {
      token: siri.token, body: { targetUser: tor.id, reason: 'inappropriate' },
    })

    expect(res.status).toBe(201)
    expect(await reports()).toBe(before + 1)
  })

  test('16. once the swap is done, Siri blocks Tor, and both negotiations they share end', async () => {
    for (const who of [siri, tor]) {
      expect((await call('POST', `/trades/${agreed}/complete`, { token: who.token })).status).toBe(200)
    }
    expect(await tradeState(agreed)).toBe('completed')

    expect((await call('POST', `/blocks/${tor.id}`, { token: siri.token })).status).toBe(204)

    expect(await tradeState(talking)).toBe('cancelled')
    expect(await tradeState(ring)).toBe('cancelled')
  })

  test('17. in words that are true for all of them, and say nothing of who blocked whom', async () => {
    for (const who of [siri, tor]) {
      const pair = (await call('GET', `/trades/${talking}`, { token: who.token })).body!
      expect(pair['closeCode']).toBe('blocked')
      expect(pair['closeReason']).toBe('Byttet er ikke mulig mellom dere lenger')
    }
    for (const who of [siri, tor, una]) {
      const three = (await call('GET', `/trades/${ring}`, { token: who.token })).body!
      expect(three['closeCode']).toBe('blocked')
      expect(three['closeReason']).toBe('Byttet er ikke mulig mellom to av dere lenger')
    }
  })

  test('18. the others are told, and the one who blocked is not', async () => {
    expect(await told(tor, talking, 'trade_cancelled')).toEqual([{ tradeId: talking, reason: 'blocked' }])
    expect(await told(tor, ring, 'trade_cancelled')).toEqual([{ tradeId: ring, reason: 'blocked' }])
    expect(await told(una, ring, 'trade_cancelled')).toEqual([{ tradeId: ring, reason: 'blocked' }])
    expect(await told(siri, talking, 'trade_cancelled')).toEqual([])
    expect(await told(siri, ring, 'trade_cancelled')).toEqual([])
  })

  test('19. what the ring held is back on the market', async () => {
    expect(await itemRow(bike)).toMatchObject({ status: 'available', active_trade_id: null })
  })

  test('20. the conversations are kept, but neither of them writes in one across the block', async () => {
    const before = (await messagesTold(siri)) + (await messagesTold(tor))
    for (const tradeId of [talking, ring]) {
      for (const who of [siri, tor]) {
        const thread = await threadOf(tradeId, who)
        expect((await call('GET', `/threads/${thread}`, { token: who.token })).status).toBe(200)

        const res = await call('POST', `/threads/${thread}/messages`, {
          token: who.token, body: { body: 'Hallo?' },
        })
        expect(res.status).toBe(403)
        expect(res.body).toEqual({ code: 'blocked', message: 'Dette er ikke mulig mellom dere.' })
      }
    }
    // And so nothing crossed it.
    expect((await messagesTold(siri)) + (await messagesTold(tor))).toBe(before)
  })

  test('21. Una, who blocked nobody, still writes in the ring’s conversation, and both are told', async () => {
    const thread = await threadOf(ring, una)
    const before = [await messagesTold(siri), await messagesTold(tor)]

    const res = await call('POST', `/threads/${thread}/messages`, {
      token: una.token, body: { body: 'Synd, det var et godt bytte.' },
    })

    expect(res.status).toBe(201)
    expect([await messagesTold(siri), await messagesTold(tor)]).toEqual([before[0]! + 1, before[1]! + 1])
  })

  test('22. reporting somebody with a block ends what you share the same way', async () => {
    const opened = await call('POST', `/items/${lamp}/message`, {
      token: una.token, body: { body: 'Er lampen ledig?' },
    })
    expect(opened.status).toBe(201)

    const res = await call('POST', '/reports', {
      token: tor.token, body: { targetUser: una.id, reason: 'spam', block: true },
    })
    expect(res.status).toBe(201)

    const ended = (await call('GET', `/trades/${opened.body!['tradeId']}`, { token: una.token })).body!
    expect(ended['state']).toBe('cancelled')
    expect(ended['closeCode']).toBe('blocked')
    expect(await told(una, opened.body!['tradeId'], 'trade_cancelled'))
      .toEqual([{ tradeId: opened.body!['tradeId'], reason: 'blocked' }])
  })
})

describe('a block from before 04.10.2026, beside a trade the two had agreed', () => {
  // The rule refuses a block across an agreed trade, but blocks made before it
  // can stand beside one in a database that has been running since. What is
  // left of such a trade still refuses every move across the block.
  type Person = { token: string; id: string }
  let vera: Person, ulf: Person
  let sofa = '', lamp = '', agreed = ''

  beforeAll(async () => {
    vera = await register('Vera N.', 'vera@epost.no')
    ulf = await register('Ulf N.', 'ulf@epost.no')
    sofa = await list(vera.token, 'Sofa, tre seter')
    lamp = await list(ulf.token, 'Stålampe')
    await call('POST', `/items/${lamp}/like`, { token: vera.token })
    agreed = (await call('POST', `/items/${sofa}/like`, { token: ulf.token })).body!['tradeId']
    for (const who of [vera, ulf]) {
      expect((await call('POST', `/trades/${agreed}/accept`, { token: who.token })).status).toBe(200)
    }
    // Written as it was written then: a row, and nothing else.
    await db.execute(sql`insert into blocks (blocker, blocked) values (${vera.id}, ${ulf.id})`)
  })

  test('23. the agreed swap stands, its things still held for it', async () => {
    expect(await tradeState(agreed)).toBe('accepted')
    expect((await itemRow(sofa))['active_trade_id']).toBe(agreed)
    expect((await itemRow(lamp))['active_trade_id']).toBe(agreed)
  })

  test('24. neither of them writes in its conversation', async () => {
    const thread = (await call('GET', `/trades/${agreed}`, { token: vera.token })).body!['threadId']
    for (const who of [vera, ulf]) {
      const res = await call('POST', `/threads/${thread}/messages`, {
        token: who.token, body: { body: 'Hallo?' },
      })
      expect(res.status).toBe(403)
      expect(res.body!['code']).toBe('blocked')
    }
  })

  test('25. a yes taken back is not given again across the block, nor is anything proposed', async () => {
    expect((await call('DELETE', `/trades/${agreed}/accept`, { token: ulf.token })).status).toBe(200)
    expect(await tradeState(agreed)).toBe('pending')

    const yes = await call('POST', `/trades/${agreed}/accept`, { token: ulf.token })
    expect(yes.status).toBe(403)
    expect(yes.body!['code']).toBe('blocked')

    const view = (await call('GET', `/trades/${agreed}`, { token: vera.token })).body!
    const counter = await call('POST', `/trades/${agreed}/counter`, {
      token: vera.token,
      body: {
        items: [
          { itemId: sofa, giverPosition: view['you']['position'] },
          { itemId: lamp, giverPosition: view['receivingFrom']['position'] },
        ],
        cash: {
          payerPosition: view['you']['position'],
          payeePosition: view['receivingFrom']['position'],
          amountNok: 100,
        },
      },
    })
    expect(counter.status).toBe(403)
    expect(counter.body!['code']).toBe('blocked')
    expect((await call('GET', `/trades/${agreed}`, { token: vera.token })).body!['offerSeq']).toBe(1)
  })

  test('26. but either of them can still walk away from it', async () => {
    expect((await call('POST', `/trades/${agreed}/decline`, { token: vera.token })).status).toBe(200)

    expect(await tradeState(agreed)).toBe('cancelled')
    expect(await itemRow(lamp)).toMatchObject({ status: 'available', active_trade_id: null })
  })
})
