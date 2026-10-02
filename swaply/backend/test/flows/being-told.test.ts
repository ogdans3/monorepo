// FLOW — Being told when a trade ends, or a question is answered
//
// The rule this exists to pin down: **whoever a trade ends for is told, once,
// with the trade and the code for why — and the one who ended it is not.** The
// sheets behind «Avslå» and «Trekk deg» say «… får beskjed», and until this
// only erasure kept that promise: a decline, an early withdrawal, a trade
// pushed out by somebody else's yes and a yes to a withdrawal all ended a
// trade in silence, and the person left found out when they next looked.
//
// The notification is `trade_cancelled` with `{ tradeId, reason }`, the reason
// being the trade's close code, and never the words: those are the app's, and
// a push must not carry them through Google or Apple. An app that does not
// know a code yet still says the trade ended.
//
// A withdrawal question is answered the same way. A no tells the one who
// asked (`withdrawal_rejected`); a deadline that passes with nobody answering
// tells everybody the trade goes on (`withdrawal_lapsed`).
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { expireWithdrawals } from '../../src/trades/actions.js'
import { cancelTrade } from '../../src/trades/trades.js'
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

let people = 0
async function person(): Promise<Person> {
  people++
  const res = await call('POST', '/auth/register', {
    body: {
      displayName: `Person ${people}`, email: `person${people}@epost.no`, password: 'byttehandel1',
    },
  })
  expect(res.status).toBe(201)
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

async function list(who: Person, title: string) {
  const res = await call('POST', '/items', {
    token: who.token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

/** Two new people who want each other's things, and the trade that opens. */
async function pair() {
  const a = await person()
  const b = await person()
  const fromA = await list(a, 'Drill')
  const fromB = await list(b, 'Telt')
  await call('POST', `/items/${fromB}/like`, { token: a.token })
  const tradeId = (await call('POST', `/items/${fromA}/like`, { token: b.token })).body!['tradeId']
  expect(tradeId).toBeTruthy()
  return { tradeId: tradeId as string, a, b, fromA, fromB }
}

async function agreed() {
  const p = await pair()
  for (const who of [p.a, p.b]) {
    expect((await call('POST', `/trades/${p.tradeId}/accept`, { token: who.token })).status).toBe(200)
  }
  return p
}

/** What a person has been told about one trade, by type, oldest first. */
async function told(who: Person, tradeId: string, type: string): Promise<Json[]> {
  const res = await call('GET', '/notifications', { token: who.token })
  return (res.body!['notifications'] as Json[])
    .filter((n) => n['type'] === type && n['payload']['tradeId'] === tradeId)
    .map((n) => n['payload'])
    .reverse()
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('a trade that ends', () => {
  test('1. «Avslå» tells the other, with the code, and not the one who pressed it', async () => {
    const { tradeId, a, b } = await pair()
    await call('POST', `/trades/${tradeId}/decline`, { token: b.token })

    expect(await told(a, tradeId, 'trade_cancelled')).toEqual([{ tradeId, reason: 'declined' }])
    expect(await told(b, tradeId, 'trade_cancelled')).toEqual([])
  })

  test('2. «Trekk deg» tells the other', async () => {
    const { tradeId, a, b } = await pair()
    await call('POST', `/trades/${tradeId}/withdraw-early`, { token: a.token })

    expect(await told(b, tradeId, 'trade_cancelled'))
      .toEqual([{ tradeId, reason: 'withdrawn_early' }])
    expect(await told(a, tradeId, 'trade_cancelled')).toEqual([])
  })

  test('3. in a ring of three, both others are told', async () => {
    const [ola, kari, per] = [await person(), await person(), await person()]
    const drill = await list(ola, 'Drill')
    const tent = await list(kari, 'Telt')
    const bike = await list(per, 'Sykkel')
    await call('POST', `/items/${tent}/like`, { token: ola.token })
    await call('POST', `/items/${bike}/like`, { token: kari.token })
    const ring = (await call('POST', `/items/${drill}/like`, { token: per.token })).body!['tradeId']

    await call('POST', `/trades/${ring}/decline`, { token: kari.token })

    for (const other of [ola, per]) {
      expect(await told(other, ring, 'trade_cancelled')).toEqual([{ tradeId: ring, reason: 'declined' }])
    }
    expect(await told(kari, ring, 'trade_cancelled')).toEqual([])
  })

  test('4. pushed out by somebody else’s yes: told, and the one who said yes is not', async () => {
    // Liv writes about the drill; its owner then agrees to give it to somebody
    // else, and Liv's conversation ends without her doing anything.
    const { tradeId, a: owner, fromA: drill } = await pair()
    const liv = await person()
    const talking = (await call('POST', `/items/${drill}/message`, {
      token: liv.token, body: { body: 'Er den ledig?' },
    })).body!['tradeId']
    await call('POST', `/trades/${tradeId}/accept`, { token: owner.token })

    expect(await told(liv, talking, 'trade_cancelled')).toEqual([{ tradeId: talking, reason: 'displaced' }])
    expect(await told(owner, talking, 'trade_cancelled')).toEqual([])
  })

  test('5. a yes to a withdrawal tells the one who asked that it ended', async () => {
    const { tradeId, a, b } = await agreed()
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: a.token })
    await call('POST', `/trades/${tradeId}/withdrawal/respond`, { token: b.token, body: { approve: true } })

    expect(await told(a, tradeId, 'trade_cancelled'))
      .toEqual([{ tradeId, reason: 'withdrawal_approved' }])
    expect(await told(b, tradeId, 'trade_cancelled')).toEqual([])
  })

  test('6. a trade ends once, and is told once', async () => {
    const { tradeId, a, b } = await pair()
    await call('POST', `/trades/${tradeId}/decline`, { token: b.token })
    // A second ending lands on a trade that has ended, and moves nothing.
    await cancelTrade(db, tradeId, 'withdrawn_early', { actor: b.id })

    expect(await told(a, tradeId, 'trade_cancelled')).toEqual([{ tradeId, reason: 'declined' }])
  })

  test('7. nobody already erased is told anything', async () => {
    const { tradeId, a, b } = await pair()
    // A tombstone still sits in the trade: the ending reaches past it.
    await db.execute(sql`update users set anonymised_at = now() where id = ${a.id}`)
    await call('POST', `/trades/${tradeId}/withdraw-early`, { token: b.token })

    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from notifications
          where user_id = ${a.id} and type = 'trade_cancelled'`,
    )
    expect(row!.n).toBe(0)
  })

  test('8. the tool’s «Nullstill» ends trades inside its own ring, and tells nobody', async () => {
    const { tradeId, a, b } = await pair()
    await cancelTrade(db, tradeId, 'ended_by_admin')

    expect(await told(a, tradeId, 'trade_cancelled')).toEqual([])
    expect(await told(b, tradeId, 'trade_cancelled')).toEqual([])
  })
})

describe('a withdrawal question that is answered', () => {
  test('9. a no tells the one who asked, and the trade goes on', async () => {
    const { tradeId, a, b } = await agreed()
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: a.token })
    await call('POST', `/trades/${tradeId}/withdrawal/respond`, { token: b.token, body: { approve: false } })

    expect(await tradeState(tradeId)).toBe('accepted')
    expect(await told(a, tradeId, 'withdrawal_rejected')).toEqual([{ tradeId }])
    expect(await told(b, tradeId, 'withdrawal_rejected')).toEqual([])
  })

  test('10. so does a yes that has to be a no, because the one answering has sent', async () => {
    const { tradeId, a, b } = await agreed()
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: a.token })
    await call('POST', `/trades/${tradeId}/mark`, { token: b.token, body: { marker: 'sent' } })
    const res = await call('POST', `/trades/${tradeId}/withdrawal/respond`, {
      token: b.token, body: { approve: true },
    })

    expect(res.body!['blockedBySent']).toBe(true)
    expect(await told(a, tradeId, 'withdrawal_rejected')).toEqual([{ tradeId }])
  })

  test('11. a deadline that passes with nobody answering tells everybody the trade goes on', async () => {
    const { tradeId, a, b } = await agreed()
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: a.token })
    await db.execute(
      sql`update trade_withdrawals set responds_by = now() - interval '1 minute'
          where trade_id = ${tradeId} and state = 'waiting'`,
    )

    expect(await expireWithdrawals(db)).toBe(1)
    expect(await tradeState(tradeId)).toBe('accepted')
    for (const who of [a, b]) {
      expect(await told(who, tradeId, 'withdrawal_lapsed')).toEqual([{ tradeId }])
    }
  })

  test('12. and a deadline that passes again finds nothing to say', async () => {
    expect(await expireWithdrawals(db)).toBe(0)
  })
})
