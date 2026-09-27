// FLOW — «Slett kontoen»: a person deleting their own account
//
// The rule this exists to pin down: **a person can erase their account
// themselves, and what happens is what the erasure engine decides — nothing
// more and nothing less.** The engine (trades/erasure.ts) was written and
// tested and nothing called it, so the right to erasure was exercised by
// somebody with database access; App Store review asks for it in the app.
//
// What the engine decides, seen from outside: the trades still going on end
// first, with a reason the other side can read, and whatever of theirs those
// trades were holding goes back on the market; the profile is emptied and the
// row stays as a tombstone in other people's histories; a sealed record keeps
// what a claim would need; every session dies; and the address and the number
// are free to make a new account with.
//
// An account with a password is deleted with its password, because a phone
// left unlocked on a table is not the person. A phone that never made a
// profile has nothing but its token, and that is enough. The key to the test
// tooling is taken away outside the building before its account can go, and
// a test account is retired by the tool, which never ends a trade a real
// person is standing in.
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

async function register(name: string, email: string, extra: Json = {}) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1', ...extra },
  })
  expect(res.status, email).toBe(201)
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 600 },
  })
  return res.body!['id'] as string
}

async function heart(token: string, itemId: string) {
  const res = await call('POST', `/items/${itemId}/like`, { token })
  expect(res.status).toBe(200)
  return res.body!['tradeId'] as string | null
}

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

describe('deleting your own account', () => {
  let ola = '', olaId = ''
  let kari = '', per = ''
  let drill = '', tent = '', kayak = ''
  let trade = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const o = await register('Ola', 'ola@epost.no', { phone: '406 41 522', postalCode: '7030' })
    ;[ola, olaId] = [o.token, o.id]
    kari = (await register('Kari', 'kari@epost.no')).token
    per = (await register('Per', 'per@epost.no')).token

    drill = await list(ola, 'Bosch drill 18V')
    tent = await list(kari, 'Telt')
    kayak = await list(per, 'Kajakk')

    // Ola and Kari have agreed: both have accepted, so each has reserved what
    // they are giving.
    expect(await heart(kari, drill)).toBeNull()
    trade = (await heart(ola, tent))!
    for (const token of [ola, kari]) {
      expect((await call('POST', `/trades/${trade}/accept`, { token })).status).toBe(200)
    }

    // Per wants the tent and Kari wants his kayak. The ring is there, but the
    // tent is held, so nothing can open while Ola's trade stands.
    expect(await heart(per, tent)).toBeNull()
    expect(await heart(kari, kayak)).toBeNull()

    await call('POST', '/me/hidden', { token: ola, body: { itemId: kayak } })
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. the wrong password is refused in words, and nothing is deleted', async () => {
    const res = await call('DELETE', '/me', { token: ola, body: { password: 'feil passord' } })

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'wrong_password', message: 'Feil passord.' })
    expect((await call('GET', '/me', { token: ola })).status).toBe(200)
  })

  test('2. so is no password at all, for an account that has one', async () => {
    const res = await call('DELETE', '/me', { token: ola })

    expect(res.status).toBe(403)
    expect(res.body!['message']).toBe('Feil passord.')
  })

  test('3. with the right password the account is deleted', async () => {
    const res = await call('DELETE', '/me', { token: ola, body: { password: 'byttehandel1' } })

    expect(res.status).toBe(204)
  })

  test('4. the session dies with it, and the address no longer signs in', async () => {
    expect((await call('GET', '/me', { token: ola })).status).toBe(401)

    const login = await call('POST', '/auth/login', {
      body: { email: 'ola@epost.no', password: 'byttehandel1' },
    })
    expect(login.status).toBe(401)
  })

  test('5. Kari’s trade has ended, with a reason she can read', async () => {
    const res = await call('GET', `/trades/${trade}`, { token: kari })

    expect(res.body!['state']).toBe('cancelled')
    expect(res.body!['closeReason']).toBe('Den andre parten slettet kontoen sin')
  })

  test('6. her tent is back on the market, and the ring that was waiting for it opens', async () => {
    const [row] = await db.execute<Record<string, string | null>>(
      sql`select status, active_trade_id from items where id = ${tent}`,
    )
    expect(row).toEqual({ status: 'available', active_trade_id: null })

    // An item becoming available again is one of the three search triggers.
    const waiting = (await call('GET', '/trades', { token: per })).body!['waiting'] as Json[]
    expect(waiting).toHaveLength(1)
    expect(waiting[0]!['youGet'].map((i: Json) => i['id'])).toEqual([tent])
    expect(waiting[0]!['youGive'].map((i: Json) => i['id'])).toEqual([kayak])
  })

  test('7. on the other side of her history he is a tombstone, not a person', async () => {
    const res = await call('GET', `/users/${olaId}`, { token: kari })

    expect(res.body!['displayName']).toBe('Slettet bruker')
    expect(res.body!['town']).toBeNull()
    expect(res.body!['items']).toEqual([])
  })

  test('8. what was only about him is gone, and the sealed record says he asked', async () => {
    const [user] = await db.execute<Record<string, string | null>>(
      sql`select email, phone, password_hash, postal_code, anonymised_at from users where id = ${olaId}`,
    )
    expect(user).toMatchObject({ email: null, phone: null, password_hash: null, postal_code: null })
    expect(user!['anonymised_at']).not.toBeNull()

    for (const table of ['likes', 'hidden_listings']) {
      const column = table === 'likes' ? 'from_user' : 'user_id'
      const rows = await db.execute(
        sql`select 1 from ${sql.identifier(table)} where ${sql.identifier(column)} = ${olaId}`,
      )
      expect(rows, table).toHaveLength(0)
    }

    // Kept three years from today: Ola never completed a trade — the one he
    // was in ended with his account — and a trade that went wrong is the
    // claim the record is for.
    const [sealed] = await db.execute<Record<string, string | boolean | null>>(
      sql`select email, reason,
                 purge_after = (current_date + interval '3 years')::date as from_deletion
          from retained.identities where user_id = ${olaId}`,
    )
    expect(sealed).toEqual({ email: 'ola@epost.no', reason: 'user_request', from_deletion: true })
  })

  test('9. the address and the number are free to make a new account with', async () => {
    const again = await register('Ola', 'ola@epost.no', { phone: '406 41 522' })

    expect(again.id).not.toBe(olaId)
  })

  describe('a phone that never made a profile', () => {
    const deviceId = 'device-deletion-0123456789abcdef'
    let phone = '', phoneId = ''

    test('10. is deleted with no password, since its token is all it ever had', async () => {
      const start = await call('POST', '/auth/anonymous', { body: { deviceId } })
      ;[phone, phoneId] = [start.body!['token'], start.body!['user']['id']]
      await heart(phone, kayak)

      const res = await call('DELETE', '/me', { token: phone })

      expect(res.status).toBe(204)
      expect((await call('GET', '/me', { token: phone })).status).toBe(401)
    })

    test('11. and the phone comes back as a stranger', async () => {
      const again = await call('POST', '/auth/anonymous', { body: { deviceId } })

      expect(again.status).toBe(201)
      expect(again.body!['user']['id']).not.toBe(phoneId)
    })
  })

  describe('in the middle of a withdrawal', () => {
    test('12. a trade paused on a question ends too, and answering it later cannot bring it back', async () => {
      const siri = await register('Siri', 'siri@epost.no')
      const tor = await register('Tor', 'tor@epost.no')
      const guitar = await list(siri.token, 'Gitar')
      const skis = await list(tor.token, 'Ski')
      await heart(siri.token, skis)
      const paused = (await heart(tor.token, guitar))!
      for (const token of [siri.token, tor.token]) {
        await call('POST', `/trades/${paused}/accept`, { token })
      }
      // Siri asks to get out, which pauses the trade while Tor answers.
      await call('POST', `/trades/${paused}/withdrawal`, { token: siri.token })
      expect((await call('GET', `/trades/${paused}`, { token: tor.token })).body!['state']).toBe('paused')

      const gone = await call('DELETE', '/me', { token: siri.token, body: { password: 'byttehandel1' } })
      expect(gone.status).toBe(204)

      const answer = await call('POST', `/trades/${paused}/withdrawal/respond`, {
        token: tor.token,
        body: { approve: false },
      })
      expect(answer.status).toBe(404)
      const view = await call('GET', `/trades/${paused}`, { token: tor.token })
      expect(view.body!['state']).toBe('cancelled')
      expect(view.body!['closeReason']).toBe('Den andre parten slettet kontoen sin')
    })
  })

  describe('and the test tooling', () => {
    let gabriel = ''

    beforeAll(async () => {
      const g = await register('Gabriel', 'gabriel@epost.no')
      gabriel = g.token
      await grantAdmin(g.id)
    })

    test('13. the account holding the key is refused, and told what to do first', async () => {
      const res = await call('DELETE', '/me', { token: gabriel, body: { password: 'byttehandel1' } })

      expect(res.status).toBe(409)
      expect(res.body!['code']).toBe('admin_account')
      expect((await call('GET', '/me', { token: gabriel })).status).toBe(200)
    })

    test('14. acting as a test account, «Slett kontoen» retires it through the tool, with no password', async () => {
      const made = await call('POST', '/admin/accounts', { token: gabriel, body: { withItems: 0 } })
      const as = await call('POST', `/admin/accounts/${made.body!['id']}/session`, { token: gabriel })

      const res = await call('DELETE', '/me', { token: as.body!['token'] })

      expect(res.status).toBe(204)
      const [sealed] = await db.execute<Record<string, string>>(
        sql`select reason from retained.identities where user_id = ${made.body!['id']}`,
      )
      expect(sealed!['reason']).toBe('test_account')
      // The admin is still themselves, and the ring is one account smaller.
      const overview = await call('GET', '/admin/overview', { token: gabriel })
      expect(overview.body!['accounts']).toEqual([])
    })

    test('15. but not while a real person is standing in a trade with it', async () => {
      const made = await call('POST', '/admin/accounts', { token: gabriel, body: { withItems: 1 } })
      const as = (await call('POST', `/admin/accounts/${made.body!['id']}/session`, { token: gabriel }))
        .body!['token'] as string
      const theirs = (await call('GET', '/me', { token: as })).body!['items'][0]['id'] as string
      const saw = await list(kari, 'Sag')
      await heart(kari, theirs)
      expect(await heart(as, saw)).not.toBeNull()

      const res = await call('DELETE', '/me', { token: as })

      expect(res.status).toBe(409)
      expect(res.body!['code']).toBe('real_person')
      expect((await call('GET', '/me', { token: as })).status).toBe(200)
    })
  })
})
