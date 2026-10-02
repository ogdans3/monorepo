// FLOW — Taking a yes back, and the doors that are shut once it is given
//
// The rule this exists to pin down: an acceptance and a reservation are the
// same act, so undoing one undoes the other. Your yes is what locks your
// things; taking it back has to unlock them, or a listing is frozen by a
// promise nobody is making any more.
//
// Around that sit the three ways out of a trade, and they are not
// interchangeable. While it is still being negotiated you may decline or
// simply withdraw. Once everybody has accepted, the only way out is the
// negotiation on 08a–08c — so decline, withdraw and counter-offer are all
// refused there rather than quietly going around it, in words that say what
// is true, and judged under the trade's lock so that a yes landing in the same
// moment cannot slip between the check and the move.
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

async function register(name: string, email: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1', town: 'Trondheim' },
  })
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string, category = 'verktoy') {
  const res = await call('POST', '/items', {
    token,
    body: { title, category, condition: 'good', estimatedValueNok: 600 },
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

describe('taking a yes back', () => {
  let ola = '', kari = ''
  let drill = '', tent = ''
  let tradeId = ''

  beforeAll(async () => {
    const a = await register('Ola N.', 'ola@epost.no')
    const b = await register('Kari N.', 'kari@epost.no')
    ola = a.token
    kari = b.token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt, 3 personer')

    await call('POST', `/items/${tent}/like`, { token: ola })
    const closing = await call('POST', `/items/${drill}/like`, { token: kari })
    tradeId = closing.body!['tradeId']
  })

  test('1. nothing is marked sent before anybody has accepted', async () => {
    // 06f is the screen these buttons live on, and it only exists once the
    // trade is agreed. Marking a thing sent earlier would close the door on
    // withdrawing from something nobody has said yes to.
    const res = await call('POST', `/trades/${tradeId}/mark`, {
      token: ola, body: { marker: 'sent' },
    })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_accepted')
  })

  test('2. Ola accepts, and the drill is his answer made concrete', async () => {
    const res = await call('POST', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(200)
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
  })

  test('3. de-accepting gives the drill back', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(200)
    expect(res.body!['you']['accepted']).toBe(false)

    const row = await itemRow(drill)
    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
  })

  test('4. de-accepting twice is a refusal, not a second undo', async () => {
    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_accepted')
  })

  test('5. both accept, and any single de-accept holds the whole trade', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: ola })
    await call('POST', `/trades/${tradeId}/accept`, { token: kari })
    expect(await tradeState(tradeId)).toBe('accepted')

    await call('DELETE', `/trades/${tradeId}/accept`, { token: kari })

    expect(await tradeState(tradeId)).toBe('pending')
    // Kari's tent comes back; Ola's yes, and his drill, stay where they were.
    expect((await itemRow(tent))['active_trade_id']).toBeNull()
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
  })

  test('6. an agreed trade cannot be declined out from under the other side', async () => {
    await call('POST', `/trades/${tradeId}/accept`, { token: kari })
    expect(await tradeState(tradeId)).toBe('accepted')

    const declined = await call('POST', `/trades/${tradeId}/decline`, { token: ola })
    expect(declined.status).toBe(409)
    expect(declined.body!['code']).toBe('needs_permission')

    const withdrawn = await call('POST', `/trades/${tradeId}/withdraw-early`, { token: ola })
    expect(withdrawn.status).toBe(409)

    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('7. nor counter-offered, which would undo everyone’s acceptance', async () => {
    const before = await call('GET', `/trades/${tradeId}`, { token: ola })
    const mine = before.body!['you']['position']

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola, body: { items: [{ itemId: drill, giverPosition: mine }] },
    })

    expect(res.status).toBe(409)
    // Said as it is. It used to say «Angre godkjenningen først», which 06f
    // does not offer: once everybody has accepted, the way out is 08a.
    expect(res.body).toEqual({
      code: 'not_negotiable',
      message: 'Alle har godtatt byttet, så det kan ikke endres lenger.',
    })
    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('7b. paused on a question, it is waiting for an answer, which is what it says', async () => {
    // It used to say «Byttet er avsluttet.», of a trade that is not.
    await call('POST', `/trades/${tradeId}/withdrawal`, { token: kari })
    expect(await tradeState(tradeId)).toBe('paused')
    const mine = (await call('GET', `/trades/${tradeId}`, { token: ola })).body!['you']['position']

    const res = await call('POST', `/trades/${tradeId}/counter`, {
      token: ola, body: { items: [{ itemId: drill, giverPosition: mine }] },
    })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      code: 'not_negotiable',
      message: 'Byttet er pauset mens noen svarer på en forespørsel.',
    })
    await call('DELETE', `/trades/${tradeId}/withdrawal`, { token: kari })
    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('8. once something is sent, the yes is no longer yours to take back', async () => {
    await call('POST', `/trades/${tradeId}/mark`, { token: ola, body: { marker: 'sent' } })

    const res = await call('DELETE', `/trades/${tradeId}/accept`, { token: ola })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('already_sent')
    expect((await itemRow(drill))['active_trade_id']).toBe(tradeId)
  })
})

// The same three doors, when the last yes lands in the moment one of them is
// pressed. Each used to read the state before taking the trade's lock: the
// decline saw `pending` and then cancelled what had just been agreed, and the
// counter-offer saw `pending` and put an agreed trade back to `countered`.
// Now each is judged under the lock, so it sees the trade as the yes left it.
describe('a door pressed in the same moment as the last yes', () => {
  let siri = '', tor = ''

  beforeAll(async () => {
    siri = (await register('Siri N.', 'siri@epost.no')).token
    tor = (await register('Tor N.', 'tor@epost.no')).token
  })

  /** Siri's guitar for Tor's skis: a pending trade nobody has said yes to. */
  async function pending(n: number) {
    const guitar = await list(siri, `Gitar ${n}`)
    const skis = await list(tor, `Ski ${n}`)
    await call('POST', `/items/${skis}/like`, { token: siri })
    const tradeId = (await call('POST', `/items/${guitar}/like`, { token: tor })).body!['tradeId']
    expect(await tradeState(tradeId)).toBe('pending')
    return { tradeId, guitar, skis }
  }

  /**
   * Press [door] while another connection holds the trade, and agree the trade
   * there before letting go — which is what the last yes does to it.
   */
  async function whileTheLastYesLands(tradeId: string, door: () => ReturnType<typeof call>) {
    const other = connect()
    try {
      let pressed: ReturnType<typeof call> | undefined
      await other.db.transaction(async (tx) => {
        await tx.execute(sql`select 1 from trades where id = ${tradeId} for no key update`)
        pressed = door()
        // Held until the door is waiting on it. `pg_stat_activity` is read
        // from a snapshot the transaction keeps, so it is let go of each time.
        for (let tries = 0; ; tries++) {
          await tx.execute(sql`select pg_stat_clear_snapshot()`)
          const [waiting] = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from pg_stat_activity
                where datname = current_database() and wait_event_type = 'Lock'`,
          )
          if (waiting!.n > 0) break
          if (tries > 500) throw new Error('the door never came to the trade')
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        await tx.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
      })
      return await pressed!
    } finally {
      await other.client.end()
    }
  }

  test('9. «Avslå» finds the trade agreed, is refused, and the agreement stands', async () => {
    const { tradeId } = await pending(9)

    const res = await whileTheLastYesLands(tradeId, () =>
      call('POST', `/trades/${tradeId}/decline`, { token: tor }))

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('needs_permission')
    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('10. so does «Trekk deg»', async () => {
    const { tradeId } = await pending(10)

    const res = await whileTheLastYesLands(tradeId, () =>
      call('POST', `/trades/${tradeId}/withdraw-early`, { token: siri }))

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('needs_permission')
    expect(await tradeState(tradeId)).toBe('accepted')
  })

  test('11. and a counter-offer, which puts nothing new on the table of an agreed trade', async () => {
    const { tradeId, guitar, skis } = await pending(11)
    const view = await call('GET', `/trades/${tradeId}`, { token: tor })
    const mine = view.body!['you']['position']
    const hers = view.body!['receivingFrom']['position']

    const res = await whileTheLastYesLands(tradeId, () =>
      call('POST', `/trades/${tradeId}/counter`, {
        token: tor,
        body: {
          items: [
            { itemId: skis, giverPosition: mine },
            { itemId: guitar, giverPosition: hers },
          ],
          cash: { payerPosition: mine, payeePosition: hers, amountNok: 100 },
        },
      }))

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('not_negotiable')
    expect(await tradeState(tradeId)).toBe('accepted')
    const after = await call('GET', `/trades/${tradeId}`, { token: tor })
    expect(after.body!['offerSeq']).toBe(1)
  })

  test('12. and an ended trade is refused as ended, rather than ended a second time', async () => {
    const { tradeId } = await pending(12)
    expect((await call('POST', `/trades/${tradeId}/decline`, { token: siri })).status).toBe(200)

    for (const door of ['decline', 'withdraw-early']) {
      const res = await call('POST', `/trades/${tradeId}/${door}`, { token: tor })
      expect(res.status, door).toBe(409)
      expect(res.body, door).toEqual({ code: 'trade_closed', message: 'Byttet er allerede avsluttet.' })
    }
    const counter = await call('POST', `/trades/${tradeId}/counter`, {
      token: tor, body: { items: [{ itemId: (await list(tor, 'Ekstra')), giverPosition: 0 }] },
    })
    expect(counter.status).toBe(409)
    expect(counter.body).toEqual({ code: 'not_negotiable', message: 'Byttet er avsluttet.' })
  })
})
