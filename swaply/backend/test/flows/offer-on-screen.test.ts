// FLOW — «Godta» is for the version on the screen
//
// The rule this exists to pin down: **a yes is given for the version somebody
// was shown, and only while it is the one on the table.** The app sends the
// offer 06c drew with «Godta bytte» (`offerId`) and the one a counter-offer
// answers (`baseOfferId`). If a newer version has landed since, the answer is
// 409 `offer_changed` and nothing moves: no acceptance, no reservation, no new
// version. Judged under the trade's lock, so a counter-offer landing between
// the read and the write is caught too.
//
// An app that sends neither — the one testers have from 30.09 — is answered as
// before: its yes is for the newest version. Except in that same moment, where
// it used to be a yes to the *older* version, read a moment before the lock.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { connect } from '../../src/db/index.js'
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

async function acceptances(tradeId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from trade_acceptances a
        join trade_offers o on o.id = a.offer_id where o.trade_id = ${tradeId}`,
  )
  return row!.n
}

const changed = {
  code: 'offer_changed',
  message: 'Forslaget er endret. Se over det nye før du godtar.',
}

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('the version on the screen', () => {
  let ola = { token: '', id: '' }, kari = { token: '', id: '' }
  let trade = { tradeId: '', fromA: '', fromB: '' }
  let v1 = '', v2 = ''

  beforeAll(async () => {
    ola = await register('Ola')
    kari = await register('Kari')
    trade = await pair(ola, kari, 1)
  })

  test('1. both are shown the first version', async () => {
    v1 = (await call('GET', `/trades/${trade.tradeId}`, { token: kari.token })).body!['offerId']
    expect((await call('GET', `/trades/${trade.tradeId}`, { token: ola.token })).body!['offerId'])
      .toBe(v1)
  })

  test('2. Ola answers it with a counter-offer, saying which version he answers', async () => {
    const view = (await call('GET', `/trades/${trade.tradeId}`, { token: ola.token })).body!
    const res = await call('POST', `/trades/${trade.tradeId}/counter`, {
      token: ola.token,
      body: {
        items: [
          { itemId: trade.fromA, giverPosition: view['you']['position'] },
          { itemId: trade.fromB, giverPosition: view['receivingFrom']['position'] },
        ],
        cash: {
          payerPosition: view['receivingFrom']['position'],
          payeePosition: view['you']['position'],
          amountNok: 150,
        },
        baseOfferId: v1,
      },
    })

    expect(res.status).toBe(200)
    v2 = res.body!['offerId']
    expect(v2).not.toBe(v1)
  })

  test('3. Kari, still looking at the first, swipes «Godta», and is told it has changed', async () => {
    const res = await call('POST', `/trades/${trade.tradeId}/accept`, {
      token: kari.token, body: { termsVersion: '2026-09-06', offerId: v1 },
    })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(changed)
  })

  test('4. and nothing moved: no yes on either version, and her thing is not held', async () => {
    expect(await acceptances(trade.tradeId)).toBe(0)
    expect((await itemRow(trade.fromB))['active_trade_id']).toBeNull()
    expect(await tradeState(trade.tradeId)).toBe('countered')
  })

  test('5. a counter-offer answering the first version is refused the same way', async () => {
    const view = (await call('GET', `/trades/${trade.tradeId}`, { token: kari.token })).body!
    const res = await call('POST', `/trades/${trade.tradeId}/counter`, {
      token: kari.token,
      body: {
        items: [
          { itemId: trade.fromB, giverPosition: view['you']['position'] },
          { itemId: trade.fromA, giverPosition: view['receivingFrom']['position'] },
        ],
        baseOfferId: v1,
      },
    })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      code: 'offer_changed',
      message: 'Forslaget er endret. Se over det nye før du foreslår noe annet.',
    })
    expect(view['offerSeq']).toBe(2)
    expect((await call('GET', `/trades/${trade.tradeId}`, { token: kari.token })).body!['offerSeq'])
      .toBe(2)
  })

  test('6. a version from another trade is never the one on this table', async () => {
    const other = await pair(ola, kari, 6)
    const elsewhere = (await call('GET', `/trades/${other.tradeId}`, { token: kari.token }))
      .body!['offerId']

    const res = await call('POST', `/trades/${trade.tradeId}/accept`, {
      token: kari.token, body: { offerId: elsewhere },
    })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(changed)
    expect(await acceptances(other.tradeId)).toBe(0)
  })

  test('7. shown the second version, her yes lands and holds her thing', async () => {
    const res = await call('POST', `/trades/${trade.tradeId}/accept`, {
      token: kari.token, body: { termsVersion: '2026-09-06', offerId: v2 },
    })

    expect(res.status).toBe(200)
    expect((await itemRow(trade.fromB))['active_trade_id']).toBe(trade.tradeId)
  })

  test('8. an app that names no version says yes to the newest, as it always has', async () => {
    const res = await call('POST', `/trades/${trade.tradeId}/accept`, { token: ola.token })

    expect(res.status).toBe(200)
    expect(res.body!['everyoneAccepted']).toBe(true)
    expect(await tradeState(trade.tradeId)).toBe('accepted')
  })
})

describe('a counter-offer landing between the read and the lock', () => {
  let siri = { token: '', id: '' }, tor = { token: '', id: '' }

  beforeAll(async () => {
    siri = await register('Siri')
    tor = await register('Tor')
  })

  /**
   * Press «Godta» while another connection holds the trade, and put a second
   * version on the table there before letting go — which is what a
   * counter-offer arriving in that moment does.
   */
  async function whileACounterLands(
    trade: { tradeId: string; fromA: string },
    press: () => ReturnType<typeof call>,
  ) {
    const other = connect()
    try {
      let pressed: ReturnType<typeof call> | undefined
      await other.db.transaction(async (tx) => {
        await tx.execute(sql`select 1 from trades where id = ${trade.tradeId} for no key update`)
        pressed = press()
        for (let tries = 0; ; tries++) {
          await tx.execute(sql`select pg_stat_clear_snapshot()`)
          const [waiting] = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from pg_stat_activity
                where datname = current_database() and wait_event_type = 'Lock'`,
          )
          if (waiting!.n > 0) break
          if (tries > 500) throw new Error('«Godta» never came to the trade')
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        const [offer] = await tx.execute<{ id: string }>(
          sql`insert into trade_offers (trade_id, seq, proposed_by)
              values (${trade.tradeId}, 2, ${siri.id}) returning id`,
        )
        await tx.execute(
          sql`insert into trade_offer_items (offer_id, item_id, giver_position)
              select ${offer!.id}, oi.item_id, oi.giver_position from trade_offer_items oi
              join trade_offers o on o.id = oi.offer_id
              where o.trade_id = ${trade.tradeId} and o.seq = 1`,
        )
        await tx.execute(sql`update trades set state = 'countered' where id = ${trade.tradeId}`)
      })
      return await pressed!
    } finally {
      await other.client.end()
    }
  }

  test('9. Tor’s yes to the version he was shown finds a newer one, and is refused', async () => {
    const trade = await pair(siri, tor, 9)
    const shown = (await call('GET', `/trades/${trade.tradeId}`, { token: tor.token })).body!['offerId']

    const res = await whileACounterLands(trade, () =>
      call('POST', `/trades/${trade.tradeId}/accept`, { token: tor.token, body: { offerId: shown } }))

    expect(res.status).toBe(409)
    expect(res.body).toEqual(changed)
    expect(await acceptances(trade.tradeId)).toBe(0)
    expect((await itemRow(trade.fromB))['active_trade_id']).toBeNull()
  })

  test('10. and so is a yes from an app that names no version, rather than a yes to the old one', async () => {
    const trade = await pair(siri, tor, 10)

    const res = await whileACounterLands(trade, () =>
      call('POST', `/trades/${trade.tradeId}/accept`, { token: tor.token }))

    expect(res.status).toBe(409)
    expect(res.body).toEqual(changed)
    expect(await acceptances(trade.tradeId)).toBe(0)
    expect((await itemRow(trade.fromB))['active_trade_id']).toBeNull()
  })
})
