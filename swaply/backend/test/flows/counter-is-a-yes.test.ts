// FLOW — Proposing a version is agreeing to it
//
// The rule this exists to pin down: **whoever sends a counter-offer has said
// yes to it.** 09e draws the one who proposed it as «✓ Har godtatt» and gives
// the other side «Godta endringen»; the product owner chose that on
// 02.10.2026. The proposer's yes goes through every guard any yes does, and
// like any owner's yes it holds their things in the new version.
//
// The app says so under «Send motbytte» and sends the terms the person agreed
// to by sending (`termsVersion`). An app that sends none — the one testers
// have from 30.09 — proposes without agreeing, as it always did. And a version
// with a side still empty is proposed without a yes, since nobody can say yes
// to it: it is a question, not a deal.
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

async function register(name: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email: `${name.toLowerCase()}@epost.no`, password: 'byttehandel1' },
  })
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

/** Two people who want each other's things, and the trade their hearts open. */
async function pair(a: { token: string }, b: { token: string }, n: number) {
  const fromA = await list(a.token, `Ting ${n}a`)
  const fromB = await list(b.token, `Ting ${n}b`)
  await call('POST', `/items/${fromB}/like`, { token: a.token })
  const tradeId = (await call('POST', `/items/${fromA}/like`, { token: b.token })).body!['tradeId']
  return { tradeId: tradeId as string, fromA, fromB }
}

async function seat(tradeId: string, userId: string): Promise<number> {
  const [row] = await db.execute<{ position: number }>(
    sql`select position from trade_participants where trade_id = ${tradeId} and user_id = ${userId}`,
  )
  return Number(row!.position)
}

async function yeses(tradeId: string): Promise<{ user_id: string; terms_version: string }[]> {
  return db.execute<{ user_id: string; terms_version: string }>(
    sql`select a.user_id, a.terms_version from trade_acceptances a
        join trade_offers o on o.id = a.offer_id
        where o.trade_id = ${tradeId} and a.revoked_at is null
          and o.seq = (select max(seq) from trade_offers where trade_id = ${tradeId})`,
  )
}

async function told(userId: string, type: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from notifications where user_id = ${userId} and type = ${type}`,
  )
  return row!.n
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('a counter-offer is the proposer’s yes', () => {
  let ola: { token: string; id: string }, kari: { token: string; id: string }
  let tradeId: string, olasThing: string, karisThing: string, karisLamp: string

  beforeAll(async () => {
    ola = await register('Ola')
    kari = await register('Kari')
    ;({ tradeId, fromA: olasThing, fromB: karisThing } = await pair(ola, kari, 1))
    karisLamp = await list(kari.token, 'Byggelampe')
  })

  test('1. Kari sends a counter-offer, and in the same breath has said yes to it', async () => {
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: kari.token,
      body: {
        items: [
          { itemId: olasThing, giverPosition: await seat(tradeId, ola.id) },
          { itemId: karisThing, giverPosition: await seat(tradeId, kari.id) },
          { itemId: karisLamp, giverPosition: await seat(tradeId, kari.id) },
        ],
        termsVersion: '2026-09-06',
      },
    })

    expect(res.status).toBe(200)
    expect(await tradeState(tradeId)).toBe('countered')
    expect(await yeses(tradeId)).toEqual([{ user_id: kari.id, terms_version: '2026-09-06' }])
    expect(res.body!['you']['accepted']).toBe(true)
  })

  test('2. …which holds her things in it, as any owner’s yes does', async () => {
    expect((await itemRow(karisThing))['active_trade_id']).toBe(tradeId)
    expect((await itemRow(karisLamp))['active_trade_id']).toBe(tradeId)
    expect((await itemRow(olasThing))['active_trade_id']).toBeNull()
  })

  test('3. Ola is told once, that there is a new version — not a second time that Kari said yes', async () => {
    expect(await told(ola.id, 'counter_offer')).toBe(1)
    expect(await told(ola.id, 'trade_partly_accepted')).toBe(0)
  })

  test('4. Ola sees it came from Kari, with her yes already on it', async () => {
    const view = (await call('GET', `/trades/${tradeId}`, { token: ola.token })).body!
    expect(view['counterOfferBy']).toBe(kari.id)
    expect(view['you']['accepted']).toBe(false)
    const karis = (view['participants'] as Json[]).find((p) => p['id'] === kari.id)!
    expect(karis['accepted']).toBe(true)
  })

  test('5. so «Godta endringen» is the one yes the trade still needs', async () => {
    const res = await call('POST', `/trades/${tradeId}/accept`, { token: ola.token, body: {} })
    expect(res.status).toBe(200)
    expect(res.body!['everyoneAccepted']).toBe(true)
    expect(await tradeState(tradeId)).toBe('accepted')
  })
})

describe('a counter-offer that is not a yes', () => {
  let per: { token: string; id: string }, anne: { token: string; id: string }

  beforeAll(async () => {
    per = await register('Per')
    anne = await register('Anne')
  })

  test('6. from the app as released, which names no terms, it is a proposal and nothing more', async () => {
    const { tradeId, fromA, fromB } = await pair(per, anne, 2)
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: anne.token,
      body: {
        items: [
          { itemId: fromA, giverPosition: await seat(tradeId, per.id) },
          { itemId: fromB, giverPosition: await seat(tradeId, anne.id) },
        ],
      },
    })

    expect(res.status).toBe(200)
    expect(await tradeState(tradeId)).toBe('countered')
    expect(await yeses(tradeId)).toEqual([])
    expect((await itemRow(fromB))['active_trade_id']).toBeNull()
  })

  test('7. with a side still empty it is a question, so it is sent without a yes and not refused', async () => {
    const { tradeId, fromA } = await pair(per, anne, 3)
    // Anne asks for Per's thing and puts nothing of her own on the table.
    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: anne.token,
      body: {
        items: [{ itemId: fromA, giverPosition: await seat(tradeId, per.id) }],
        termsVersion: '2026-09-06',
      },
    })

    expect(res.status).toBe(200)
    expect(await tradeState(tradeId)).toBe('countered')
    expect(await yeses(tradeId)).toEqual([])
  })
})
