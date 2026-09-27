// FLOW — A withdrawal question on a trade that has already ended
//
// The rule this exists to pin down: **nothing said about a withdrawal can move
// a trade that has ended.** Every answer to the question on 08b — Tor's yes or
// no, Siri's «Angre forespørselen» — finishes by putting the trade back to
// `accepted`, so each of them reads the trade's state first, under a lock, and
// refuses a cancelled or completed one in words: 409, «Byttet er allerede
// avsluttet.»
//
// A question can outlive its trade more ways than one. The other side deletes
// their account; the test tooling ends the trade; everybody sends and
// receives while it is still waiting, because handover stays open during the
// pause. Before this, «Angre forespørselen» on a cancelled trade brought it
// back to `accepted` with nothing reserved, and on a completed one it
// un-completed it. Wherever a trade ends now, a question still waiting closes
// as lapsed with it — and the refusal holds even for a row that did not.
//
// The lock that check is read under is the trade's own, taken first, the way
// everything that changes a trade takes its locks (`backend/src/trades/index.ts`)
// — so a yes and a deletion in the same moment queue instead of deadlocking.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { connect } from '../../src/db/index.js'
import { cancelTrade } from '../../src/trades/trades.js'
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
  expect(res.status).toBe(201)
  return res.body!['token'] as string
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 600 },
  })
  return res.body!['id'] as string
}

let siri = '', tor = ''

/** Siri's guitar for Tor's skis, agreed by both, with both reserved. */
async function agreedTrade(n: number) {
  const guitar = await list(siri, `Gitar ${n}`)
  const skis = await list(tor, `Ski ${n}`)
  await call('POST', `/items/${skis}/like`, { token: siri })
  const closing = await call('POST', `/items/${guitar}/like`, { token: tor })
  const tradeId = closing.body!['tradeId'] as string
  for (const token of [siri, tor]) {
    expect((await call('POST', `/trades/${tradeId}/accept`, { token })).status).toBe(200)
  }
  expect(await tradeState(tradeId)).toBe('accepted')
  return { tradeId, guitar, skis }
}

async function question(tradeId: string) {
  const [row] = await db.execute<Record<string, string>>(
    sql`select state from trade_withdrawals where trade_id = ${tradeId}
        order by requested_at desc limit 1`,
  )
  return row!['state']
}

const closed = { code: 'trade_closed', message: 'Byttet er allerede avsluttet.' }

beforeAll(async () => {
  await reset()
  app = await buildApp(db)
  siri = await register('Siri')
  tor = await register('Tor')
})

afterAll(async () => {
  await app.close()
  await close()
})

describe('a trade ended while the question waits', () => {
  let trade = { tradeId: '', guitar: '', skis: '' }

  beforeAll(async () => {
    trade = await agreedTrade(1)
  })

  test('1. Siri asks to get out, and the trade waits for Tor', async () => {
    const res = await call('POST', `/trades/${trade.tradeId}/withdrawal`, { token: siri })

    expect(res.status).toBe(200)
    expect(res.body!['trade']['state']).toBe('paused')
  })

  test('2. the trade is ended under it, and the question closes with it', async () => {
    // Through the function every cancellation goes through — the tool's
    // «Nullstill → bytter» is one. Erasure has closed the question since it was
    // written; this did not.
    await cancelTrade(db, trade.tradeId, 'ended_by_admin')

    expect(await tradeState(trade.tradeId)).toBe('cancelled')
    expect(await question(trade.tradeId)).toBe('expired')
  })

  test('3. «Angre forespørselen» is refused in words, and the trade stays ended', async () => {
    const res = await call('DELETE', `/trades/${trade.tradeId}/withdrawal`, { token: siri })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(closed)
    expect(await tradeState(trade.tradeId)).toBe('cancelled')
    // Back on the market, and nobody's again.
    expect((await itemRow(trade.guitar))['active_trade_id']).toBeNull()
  })

  test('4. so is Tor’s answer, yes or no, and the reason it ended with stands', async () => {
    for (const approve of [true, false]) {
      const res = await call('POST', `/trades/${trade.tradeId}/withdrawal/respond`, {
        token: tor, body: { approve },
      })
      expect(res.status, String(approve)).toBe(409)
      expect(res.body).toEqual(closed)
    }

    const view = await call('GET', `/trades/${trade.tradeId}`, { token: tor })
    expect(view.body!['state']).toBe('cancelled')
    expect(view.body!['closeReason']).toBe('Byttet ble avsluttet fra testverktøyet')
    expect(view.body!['closeCode']).toBe('ended_by_admin')
  })

  test('5. and so is asking again', async () => {
    const res = await call('POST', `/trades/${trade.tradeId}/withdrawal`, { token: siri })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(closed)
  })
})

describe('a question left waiting on a cancelled trade, as rows from before this could be', () => {
  let tradeId = ''

  test('6. «Angre forespørselen» cannot bring it back to life', async () => {
    tradeId = (await agreedTrade(2)).tradeId
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: siri })
    // What the tool's reset used to leave behind: the trade cancelled, the
    // question still waiting. 0008 closes the ones already in the database;
    // the refusal is what holds for any that slip through.
    await db.execute(
      sql`update trades set state = 'cancelled', closed_at = now(),
                 close_reason = 'Byttet ble avsluttet fra testverktøyet'
          where id = ${tradeId}`,
    )
    expect(await question(tradeId)).toBe('waiting')

    const res = await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: siri })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(closed)
    expect(await tradeState(tradeId)).toBe('cancelled')
    expect(await question(tradeId)).toBe('waiting')
  })

  test('7. nor can a no, which is the same line from the other side', async () => {
    const res = await call('POST', `/trades/${tradeId}/withdrawal/respond`, {
      token: tor, body: { approve: false },
    })

    expect(res.status).toBe(409)
    expect(await tradeState(tradeId)).toBe('cancelled')
  })
})

describe('a trade that completes while the question waits', () => {
  let tradeId = ''

  test('8. both send and receive during the pause, and the trade is done', async () => {
    tradeId = (await agreedTrade(3)).tradeId
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: siri })
    expect(await tradeState(tradeId)).toBe('paused')

    let last: Json | null = null
    for (const token of [siri, tor]) {
      for (const marker of ['sent', 'received']) {
        last = (await call('POST', `/trades/${tradeId}/mark`, { token, body: { marker } })).body
      }
    }

    expect(last!['complete']).toBe(true)
    expect(await tradeState(tradeId)).toBe('completed')
    // Moot, and closed as lapsed rather than left open for an answer.
    expect(await question(tradeId)).toBe('expired')
  })

  test('9. «Angre forespørselen» cannot un-complete it', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: siri })

    expect(res.status).toBe(409)
    expect(res.body).toEqual(closed)
    expect(await tradeState(tradeId)).toBe('completed')
  })
})

describe('a yes given in the same moment the other side deletes the account', () => {
  // The deletion takes the trade first and then what it holds, the order
  // everything that changes a trade takes its locks in, and so does Tor's
  // yes. Before that order was one order, the deletion let go of the things
  // and then reached for the trade while the yes held the trade and reached
  // for the things; the two met halfway and Postgres ended one of them as a
  // deadlock — a 500 for Tor, or a deletion that failed. Now the yes waits
  // for the trade and finds it ended.
  test('10. the deletion finishes, and Tor is told the trade has already ended', async () => {
    const { tradeId, guitar } = await agreedTrade(4)
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: siri })
    expect(await tradeState(tradeId)).toBe('paused')

    const other = connect()
    try {
      let answering: ReturnType<typeof call> | undefined
      await other.db.transaction(async (tx) => {
        // What `anonymiseUser` takes first: the trade.
        await tx.execute(sql`select 1 from trades where id = ${tradeId} for no key update`)
        answering = call('POST', `/trades/${tradeId}/withdrawal/respond`, {
          token: tor, body: { approve: true },
        })
        // Held until Tor's yes is waiting on it. Postgres answers
        // `pg_stat_activity` from a snapshot it keeps for the transaction, so
        // it is let go of before every look.
        for (let tries = 0; ; tries++) {
          await tx.execute(sql`select pg_stat_clear_snapshot()`)
          const [waiting] = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from pg_stat_activity
                where datname = current_database() and wait_event_type = 'Lock'`,
          )
          if (waiting!.n > 0) break
          if (tries > 500) throw new Error('the yes never came to the trade')
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        // …and then what it does next: the things the trade holds, and the
        // trade, with nothing of either in the yes's hands.
        await tx.execute(
          sql`update items set active_trade_id = null, status = 'available'
              where active_trade_id = ${tradeId}`,
        )
        await tx.execute(
          sql`update trades set state = 'cancelled', closed_at = now(),
                     close_code = 'account_deleted',
                     close_reason = 'Den andre parten slettet kontoen sin'
              where id = ${tradeId}`,
        )
        await tx.execute(
          sql`update trade_withdrawals set state = 'expired', resolved_at = now()
              where trade_id = ${tradeId} and state = 'waiting'`,
        )
      })
      const res = await answering!

      expect(res.status).toBe(409)
      expect(res.body).toEqual(closed)
      expect(await tradeState(tradeId)).toBe('cancelled')
      expect(await question(tradeId)).toBe('expired')
      expect((await itemRow(guitar))['active_trade_id']).toBeNull()
    } finally {
      await other.client.end()
    }
  })
})
