// FLOW — Bygg et bytte
//
// The rule this exists to pin down: **a scenario builds a state through the
// engine the product uses, or it does not build it at all.**
//
// Nine of the states `TradeDetailScreen` draws are a multi-account journey
// each, and that is what makes the lever worth having. It is also what makes a
// shortcut tempting: an `insert into trades (state) values ('countered')` is
// one statement and reaches a screen that looks right. `db/seed.ts` took that
// shortcut once and advertised a three-way ring the cycle search would never
// have found — a state reached by a different route is not the state the
// product produces, and testing it proves nothing.
//
// So every step below asserts the *consequences* a real journey would leave
// behind — offers, acceptances, reservations, threads — and not just the
// state column.
import { sql } from 'drizzle-orm'
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

describe('building a trade in a named state', () => {
  let gabriel = '', gabrielId = ''
  let stranger = '', strangerId = ''
  let kariId = '', perId = ''

  const scenario = (state: string, shape = 'two-way') =>
    call('POST', '/admin/scenarios', { token: gabriel, body: { shape, state } })

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await call('POST', '/auth/register', {
      body: { displayName: 'Gabriel', email: 'gabriel@epost.no', password: 'byttehandel1', town: 'Trondheim' },
    })
    gabriel = a.body!['token']
    gabrielId = a.body!['user']['id']
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local swaply.admin_grant = 'on'`)
      await tx.execute(sql`update users set is_admin = true where id = ${gabrielId}`)
    })

    const b = await call('POST', '/auth/register', {
      body: { displayName: 'En Fremmed', email: 'fremmed@epost.no', password: 'byttehandel1', town: 'Oslo' },
    })
    stranger = b.body!['token']
    strangerId = b.body!['user']['id']

    kariId = (await call('POST', '/admin/accounts', {
      token: gabriel, body: { displayName: 'Kari Test', withItems: 2 },
    })).body!['id']
    perId = (await call('POST', '/admin/accounts', {
      token: gabriel, body: { displayName: 'Per Test', withItems: 2 },
    })).body!['id']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a test account’s things are invisible to everybody else', async () => {
    // They are real rows in the database a deployment serves. A stranger who
    // hearts one opens a real trade, and from that moment the account can
    // neither be reset nor deleted: it is somebody's history.
    const theirs = await call('GET', '/discover', { token: stranger })
    expect(theirs.body!['items']).toEqual([])

    const mine = await call('GET', '/discover', { token: gabriel })
    expect(mine.body!['items'].length).toBeGreaterThan(0)
  })

  test('2. «talking» is the half-filled offer, and reserves nothing', async () => {
    const res = await scenario('talking')
    expect(res.status).toBe(200)

    const view = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })
    expect(view.body!['state']).toBe('talking')
    // The opener wants your thing and has put nothing back — which is the state
    // the accept button must not appear in.
    expect(view.body!['youGive']).toHaveLength(1)
    expect(view.body!['youGet']).toEqual([])
    expect(view.body!['threadId']).not.toBeNull()

    const thread = await call('GET', `/threads/${view.body!['threadId']}`, { token: gabriel })
    expect(thread.body!['messages']).toHaveLength(1)
  })

  test('3. «pending» came from a cycle, not from an insert', async () => {
    const res = await scenario('pending')
    const tradeId = res.body!['tradeId']

    const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
    expect(view.body!['state']).toBe('pending')
    expect(view.body!['youGive']).toHaveLength(1)
    expect(view.body!['youGet']).toHaveLength(1)

    // The likes that closed it are on the record, both of them, pointing the
    // opposite way to the goods.
    const likes = await db.execute<Json>(sql`
      select l.from_user from likes l
      join trade_offer_items oi on oi.item_id = l.target_item
      join trade_offers o on o.id = oi.offer_id
      where o.trade_id = ${tradeId}`)
    expect(likes.length).toBeGreaterThanOrEqual(2)

    // Nothing is held: a cycle is a suggestion until an owner says yes.
    const held = await db.execute<Json>(
      sql`select 1 from items where active_trade_id = ${tradeId}`,
    )
    expect(held).toHaveLength(0)
  })

  test('4. «countered» leaves two offer versions and somebody else’s name on the new one',
    async () => {
      const res = await scenario('countered')
      const tradeId = res.body!['tradeId']

      const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
      expect(view.body!['state']).toBe('countered')
      expect(view.body!['offerSeq']).toBe(2)
      expect(view.body!['cash']).toMatchObject({ amountNok: 200, youPay: true })
      // 09e reads «Nytt forslag fra …», so it must not be your own.
      expect(view.body!['counterOfferBy']).not.toBe(gabrielId)
    })

  test('5. «accepted» reserved every owner’s own listing, and only that', async () => {
    const res = await scenario('accepted')
    const tradeId = res.body!['tradeId']

    const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
    expect(view.body!['state']).toBe('accepted')
    expect(view.body!['you']['accepted']).toBe(true)

    const held = await db.execute<Json>(
      sql`select i.owner_id from items i where i.active_trade_id = ${tradeId}`,
    )
    expect(held).toHaveLength(2)
    // An acceptance is keyed to a version of the offer, so there is one per
    // participant against the current one.
    const accepted = await db.execute<Json>(sql`
      select a.user_id from trade_acceptances a
      join trade_offers o on o.id = a.offer_id
      where o.trade_id = ${tradeId} and a.revoked_at is null`)
    expect(accepted).toHaveLength(2)
  })

  test('6. «handover» is accepted with one thing on its way', async () => {
    const res = await scenario('handover')
    const view = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })

    expect(view.body!['state']).toBe('accepted')
    expect(view.body!['participants'].some((p: Json) => p['sentAt'] !== null)).toBe(true)
  })

  test('7. «paused» is a real withdrawal request with a real deadline', async () => {
    const res = await scenario('paused')
    const view = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })

    expect(view.body!['state']).toBe('paused')
    expect(view.body!['withdrawal']).toMatchObject({ state: 'waiting', byYou: false })
    expect(view.body!['withdrawal']['respondsBy']).not.toBeNull()
  })

  test('8. and the deadline can be brought forward, for that trade only', async () => {
    const res = await scenario('paused')
    const tradeId = res.body!['tradeId']

    const expired = await call('POST', `/admin/trades/${tradeId}/expire-withdrawal`, {
      token: gabriel,
    })
    expect(expired.status).toBe(200)

    const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
    // «Svarer ingen innen fristen, fortsetter byttet som vanlig.»
    expect(view.body!['state']).toBe('accepted')
    expect(view.body!['withdrawal']['state']).toBe('expired')
  })

  test('9. «completed» took the snapshot that outlives the listings', async () => {
    const res = await scenario('completed')
    const tradeId = res.body!['tradeId']

    const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
    expect(view.body!['state']).toBe('completed')
    expect(view.body!['snapshots'].length).toBe(2)

    const traded = await db.execute<Json>(sql`
      select i.status from items i
      join trade_item_snapshots s on s.item_id = i.id
      where s.trade_id = ${tradeId}`)
    expect(traded.every((r) => r['status'] === 'traded')).toBe(true)
  })

  test('10. «declined» ended it and put both listings back on the market', async () => {
    const res = await scenario('declined')
    const view = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })

    expect(view.body!['state']).toBe('cancelled')
    expect(view.body!['closeReason']).toBe('Byttet ble avslått')
  })

  test('11. a three-way ring is three people, in giving order', async () => {
    const res = await scenario('pending', 'three-way')
    const view = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })

    expect(view.body!['kind']).toBe('chain')
    expect(view.body!['participants']).toHaveLength(3)
    // The third leg is somebody giving to somebody who is not you — the one
    // thing 07j exists to draw.
    expect(view.body!['otherLegs']).toHaveLength(1)
  })

  test('12. «Som motparten» moves the other side without leaving the screen', async () => {
    const res = await scenario('pending')
    const tradeId = res.body!['tradeId']

    const acted = await call('POST', `/admin/trades/${tradeId}/act`, {
      token: gabriel, body: { as: kariId, action: 'accept' },
    })
    expect(acted.status).toBe(200)

    const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
    expect(view.body!['participants'].some((p: Json) => p['accepted'] === true)).toBe(true)
    expect(view.body!['you']['accepted']).toBe(false)
  })

  test('13. but never in a trade a real person is standing in', async () => {
    // The tool may move a negotiation without asking. The one thing it must
    // never move without asking is somebody else's.
    const mine = await call('GET', '/me', { token: gabriel })
    const item = mine.body!['items'][0]
    const opened = await call('POST', `/items/${item['id']}/message`, {
      token: stranger, body: { body: 'Hei, er denne ledig?' },
    })
    expect(opened.status).toBe(201)

    const acted = await call('POST', `/admin/trades/${opened.body!['tradeId']}/act`, {
      token: gabriel, body: { as: kariId, action: 'decline' },
    })
    expect(acted.status).toBe(409)
    expect(acted.body!['code']).toBe('real_person')
    expect(acted.body!['message']).toContain('En Fremmed')
  })

  test('14. «Få noen til å ville ha denne» is the heart, pressed by somebody else',
    async () => {
      const mine = await call('GET', '/me', { token: gabriel })
      const item = mine.body!['items'].find((i: Json) => i['status'] === 'available')

      const wanted = await call('POST', `/admin/items/${item['id']}/want`, {
        token: gabriel, body: { as: perId },
      })
      expect(wanted.status).toBe(200)

      // A real like row, and a real notification to the owner — not a state
      // poked into the database.
      const like = await db.execute<Json>(
        sql`select 1 from likes where from_user = ${perId} and target_item = ${item['id']}`,
      )
      expect(like).toHaveLength(1)

      const told = await call('GET', '/notifications', { token: gabriel })
      expect(told.body!['notifications'].some((n: Json) => n['type'] === 'item_liked')).toBe(true)
    })

  test('14b. «displaced» actually displaces, rather than reporting that it did',
    async () => {
      // It used to run after the ring was agreed, by which time the contested
      // listing was reserved, no second cycle could form and the lever quietly
      // built an ordinary accepted trade — and said it had built a displaced
      // one. A scenario that reports a state it did not reach is worse than a
      // scenario that fails.
      const res = await call('POST', '/admin/scenarios', {
        token: gabriel, body: { state: 'displaced' },
      })
      expect(res.status).toBe(200)

      const loser = await call('GET', `/trades/${res.body!['tradeId']}`, { token: gabriel })
      expect(loser.body!['state']).toBe('cancelled')
      expect(loser.body!['closeReason']).toBe(
        'En gjenstand i byttet ble reservert av et annet bytte',
      )
    })

  test('14c. a scenario spends listings it made, never the ones already there',
    async () => {
      // An accepted scenario reserves what it is given and a completed one
      // marks it traded for good. Reaching for the nearest available listing
      // spent the owner's real inventory — and displaced anybody whose open
      // offer happened to hold it.
      const before = await call('GET', '/me', { token: gabriel })
      const real = before.body!['items'].filter((i: Json) => !i['title'].startsWith('[test]'))

      await call('POST', '/admin/scenarios', { token: gabriel, body: { state: 'completed' } })

      const after = await call('GET', '/me', { token: gabriel })
      for (const item of real) {
        const now = after.body!['items'].find((i: Json) => i['id'] === item['id'])
        expect(now?.['status'], item['title']).toBe(item['status'])
      }
    })

  test('14d. «Få noen til å ville ha denne» refuses a stranger’s listing', async () => {
    // The same failure the hidden-listings rule exists to prevent, arriving
    // from the other direction: a test account and a real person in one trade.
    const theirs = await call('POST', '/items', {
      token: stranger,
      body: { title: 'Fremmedes ting', category: 'verktoy', condition: 'good' },
    })

    const res = await call('POST', `/admin/items/${theirs.body!['id']}/want`, {
      token: gabriel, body: { as: kariId },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('real_person')
    expect(res.body!['message']).toContain('En Fremmed')
  })

  test('14e. «Som motparten» is refused where the product would refuse it', async () => {
    // «Jeg vil ha» opens a trade with their listing and nothing back, and the
    // accept route refuses that. Through the tool it did not: it called
    // `acceptOffer` directly and reached a state the product cannot produce.
    const talking = await call('POST', '/admin/scenarios', {
      token: gabriel, body: { state: 'talking' },
    })
    const view = await call('GET', `/trades/${talking.body!['tradeId']}`, { token: gabriel })
    const other = view.body!['receivingFrom']['id']

    const res = await call('POST', `/admin/trades/${talking.body!['tradeId']}/act`, {
      token: gabriel, body: { as: other, action: 'accept' },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('incomplete_offer')
  })

  test('14f. and «markerer som mottatt» finishes the trade, as the product’s own does',
    async () => {
      const built = await call('POST', '/admin/scenarios', {
        token: gabriel, body: { state: 'accepted' },
      })
      const tradeId = built.body!['tradeId']
      const view = await call('GET', `/trades/${tradeId}`, { token: gabriel })
      const other = view.body!['receivingFrom']['id']

      for (const marker of ['sent', 'received']) {
        await call('POST', `/trades/${tradeId}/mark`, { token: gabriel, body: { marker } })
      }
      await call('POST', `/admin/trades/${tradeId}/act`, {
        token: gabriel, body: { as: other, action: 'mark-sent' },
      })
      await call('POST', `/admin/trades/${tradeId}/act`, {
        token: gabriel, body: { as: other, action: 'mark-received' },
      })

      const after = await call('GET', `/trades/${tradeId}`, { token: gabriel })
      expect(after.body!['state']).toBe('completed')
      expect(after.body!['snapshots'].length).toBeGreaterThan(0)
    })

  test('14g. «Nullstill → avslutt bytter» leaves a real person’s trade standing',
    async () => {
      const mine = await call('GET', '/me', { token: gabriel })
      const item = mine.body!['items'].find((i: Json) => i['status'] === 'available')
      const opened = await call('POST', `/items/${item['id']}/message`, {
        token: stranger, body: { body: 'Er denne ledig?' },
      })

      const res = await call('POST', `/admin/accounts/${gabrielId}/reset`, {
        token: gabriel, body: { parts: ['trades'] },
      })
      expect(res.status).toBe(200)
      expect(res.body!['done'].join(' ')).toContain('En Fremmed')

      const still = await call('GET', `/trades/${opened.body!['tradeId']}`, { token: gabriel })
      expect(still.body!['state']).toBe('talking')
    })

  test('14h. and a test account in one cannot be deleted out from under them',
    async () => {
      const kariItems = await call('GET', `/users/${kariId}`, { token: gabriel })
      // The stranger writes to a test account — reachable by id, which is
      // deliberate: a link somebody was handed still opens.
      const opened = await call('POST', `/items/${kariItems.body!['items'][0]['id']}/message`, {
        token: stranger, body: { body: 'Hei!' },
      })
      expect(opened.status).toBe(201)

      const res = await call('DELETE', `/admin/accounts/${kariId}`, { token: gabriel })
      expect(res.status).toBe(409)
      expect(res.body!['code']).toBe('real_person')
      expect(res.body!['message']).toContain('En Fremmed')
    })

  test('15. and a stranger can reach none of it', async () => {
    for (const [method, url] of [
      ['POST', '/admin/scenarios'],
      ['POST', '/admin/jobs/sweep-cycles/run'],
      ['GET', '/admin/state'],
    ] as const) {
      const res = await call(method, url, { token: stranger, body: { state: 'pending' } })
      expect(res.status, url).toBe(404)
    }
  })
})
