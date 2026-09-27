// FLOW — Why a trade ended, said so it is true for whoever reads it
//
// The rule this exists to pin down: **a cancelled trade says why as a code —
// `closeCode` on the trade — and the app picks its own words from it; the
// words stored beside it, `closeReason`, are true for every person in the
// trade.** For the one who ended it as much as for the ones left, and in a
// ring of three as much as in a pair.
//
// Erasure used to write «Den andre parten slettet kontoen sin» into every
// trade it ended. In a ring of three there are two other parties, and the
// sentence named one of them. «Trekk deg» wrote «Den andre parten trakk seg»,
// which the one who pulled out read about themselves. One sentence cannot say
// «du» to the right person, which is why the code exists; the words are the
// record, and what a client that has not learnt a code falls back on.
import { readFile } from 'node:fs/promises'

import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { cancelTrade } from '../../src/trades/trades.js'
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

async function register(name: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  expect(res.status, name).toBe(201)
  return res.body!['token'] as string
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 600 },
  })
  expect(res.status, title).toBe(201)
  return res.body!['id'] as string
}

async function heart(token: string, itemId: string) {
  const res = await call('POST', `/items/${itemId}/like`, { token })
  expect(res.status).toBe(200)
  return res.body!['tradeId'] as string | null
}

/**
 * Two new people who each want the other's thing, and the trade their hearts
 * open. New every time: an old heart between the same two would close a
 * different ring first.
 */
async function pair(n: number) {
  const a = await register(`Anne${n}`)
  const b = await register(`Bjorn${n}`)
  const fromA = await list(a, `Ting ${n}a`)
  const fromB = await list(b, `Ting ${n}b`)
  expect(await heart(b, fromA)).toBeNull()
  return { tradeId: (await heart(a, fromB))!, a, b, fromA, fromB }
}

async function view(tradeId: string, token: string) {
  const res = await call('GET', `/trades/${tradeId}`, { token })
  expect(res.status).toBe(200)
  return res.body!
}

async function erase(token: string) {
  const res = await call('DELETE', '/me', { token, body: { password: 'byttehandel1' } })
  expect(res.status).toBe(204)
}

let ola = '', kari = '', per = '', liv = ''

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
  ola = await register('Ola')
  kari = await register('Kari')
  per = await register('Per')
  liv = await register('Liv')
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('somebody in a ring of three deletes their account', () => {
  let ring = ''

  test('1. three wishes close a ring, and a trade still going on has no code', async () => {
    const drill = await list(ola, 'Bosch drill 18V')
    const tent = await list(kari, 'Telt')
    const bike = await list(per, 'Sykkel')
    expect(await heart(ola, tent)).toBeNull()
    expect(await heart(kari, bike)).toBeNull()
    ring = (await heart(per, drill))!

    const opened = await view(ring, ola)
    expect(opened['kind']).toBe('chain')
    expect(opened['participants']).toHaveLength(3)
    expect(opened['closeCode']).toBeNull()
    expect(opened['closeReason']).toBeNull()
  })

  test('2. Kari deletes hers, and the ring ends', async () => {
    await erase(kari)

    expect((await view(ring, ola))['state']).toBe('cancelled')
  })

  test('3. Ola and Per both read the code, and words that do not name one of them', async () => {
    for (const token of [ola, per]) {
      const ended = await view(ring, token)

      expect(ended['closeCode']).toBe('account_deleted')
      // There are two others in a ring of three, and either of them might be
      // the one reading.
      expect(ended['closeReason']).toBe('En av de andre slettet kontoen sin')
    }
  })

  test('4. in a pair there is exactly one other, and the words say so', async () => {
    const { tradeId, a, b } = await pair(4)
    await erase(b)

    const ended = await view(tradeId, a)
    expect(ended['closeCode']).toBe('account_deleted')
    expect(ended['closeReason']).toBe('Den andre parten slettet kontoen sin')
  })
})

describe('every other way a trade is cancelled has a code of its own', () => {
  test('5. «Avslå» is declined', async () => {
    const { tradeId, a, b } = await pair(5)
    await call('POST', `/trades/${tradeId}/decline`, { token: b })

    const ended = await view(tradeId, a)
    expect(ended['closeCode']).toBe('declined')
    expect(ended['closeReason']).toBe('Byttet ble avslått')
  })

  test('6. «Trekk deg» is withdrawn_early, in words true for the one who pulled out too', async () => {
    const { tradeId, a, b } = await pair(6)
    await call('POST', `/trades/${tradeId}/withdraw-early`, { token: a })

    for (const token of [a, b]) {
      const ended = await view(tradeId, token)
      expect(ended['closeCode']).toBe('withdrawn_early')
      expect(ended['closeReason']).toBe('En av dere trakk seg før byttet var godtatt')
    }
  })

  test('7. a yes to a withdrawal is withdrawal_approved', async () => {
    const { tradeId, a, b } = await pair(7)
    for (const token of [a, b]) {
      expect((await call('POST', `/trades/${tradeId}/accept`, { token })).status).toBe(200)
    }
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: a })
    await call('POST', `/trades/${tradeId}/withdrawal/respond`, {
      token: b, body: { approve: true },
    })

    const ended = await view(tradeId, a)
    expect(ended['closeCode']).toBe('withdrawal_approved')
    expect(ended['closeReason']).toBe('Byttet ble avbrutt etter avtale mellom partene')
  })

  test('8. losing a listing to another trade’s yes is displaced', async () => {
    // Liv writes about the thing its owner then agrees to give somebody else.
    const { tradeId, b: owner, fromB: wanted } = await pair(8)
    const talking = await call('POST', `/items/${wanted}/message`, {
      token: liv, body: { body: 'Er den ledig?' },
    })
    expect(talking.status).toBe(201)
    expect((await call('POST', `/trades/${tradeId}/accept`, { token: owner })).status).toBe(200)

    const ended = await view(talking.body!['tradeId'], liv)
    expect(ended['closeCode']).toBe('displaced')
    expect(ended['closeReason']).toBe('En gjenstand i byttet ble reservert av et annet bytte')
  })

  test('9. the test tooling ending it is ended_by_admin', async () => {
    const { tradeId, a } = await pair(9)
    // The function «Nullstill → bytter» ends trades through.
    await cancelTrade(db, tradeId, 'ended_by_admin')

    expect((await view(tradeId, a))['closeCode']).toBe('ended_by_admin')
  })

  test('10. a trade ends once, and a second ending does not write over the first reason', async () => {
    const { tradeId, a, b } = await pair(10)
    await call('POST', `/trades/${tradeId}/decline`, { token: b })
    await cancelTrade(db, tradeId, 'ended_by_admin')

    expect((await view(tradeId, a))['closeCode']).toBe('declined')
  })
})

describe('trades cancelled before there were codes', () => {
  // What drizzle/0010 does to the rows it finds: the code from the words
  // they were closed with, every one of which was a fixed sentence the code
  // wrote. Run again here over rows written the old way.
  const old: Record<string, string> = {
    'En gjenstand i byttet ble reservert av et annet bytte': 'displaced',
    'Byttet ble avslått': 'declined',
    'Den andre parten trakk seg før byttet var godtatt': 'withdrawn_early',
    'Byttet ble avbrutt etter avtale mellom partene': 'withdrawal_approved',
    'Den andre parten slettet kontoen sin': 'account_deleted',
    'Byttet ble avsluttet fra testverktøyet': 'ended_by_admin',
  }

  test('11. get their code from their words, and words nobody wrote a code for get none', async () => {
    const ids = new Map<string, string>()
    for (const words of [...Object.keys(old), 'Ola trakk seg']) {
      const [row] = await db.execute<{ id: string }>(
        sql`insert into trades (state, closed_at, close_reason)
            values ('cancelled', now(), ${words}) returning id`,
      )
      ids.set(words, row!.id)
    }

    const migration = await readFile(
      new URL('../../drizzle/0010_trade_close_code.sql', import.meta.url),
      'utf8',
    )
    const backfill = migration.split('--> statement-breakpoint').at(-1)!
    expect(backfill).toContain('UPDATE "trades"')
    await db.execute(sql.raw(backfill))

    for (const [words, id] of ids) {
      const [row] = await db.execute<{ close_code: string | null; close_reason: string }>(
        sql`select close_code, close_reason from trades where id = ${id}`,
      )
      expect(row!.close_code, words).toBe(old[words] ?? null)
      // The words are history, and stay as they were.
      expect(row!.close_reason).toBe(words)
    }
  })

  test('12. and the rows that already had one keep it', async () => {
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from trades
          where close_reason = 'En av de andre slettet kontoen sin'
            and close_code = 'account_deleted'`,
    )
    expect(row!.n).toBe(1)
  })
})
