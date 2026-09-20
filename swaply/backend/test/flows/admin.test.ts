// FLOW — The test tooling, and the key that opens it
//
// The rule this exists to pin down: **an admin key is cut outside the building.
// Nothing inside can cut another, and it opens only the doors marked as test.**
//
// The section exists because almost every interesting state in Swaply needs two
// or three people who want each other's things, and the owner is one person
// with one phone. That makes it a tool with real power — it can act as somebody
// else — pointed at a database that also serves a live deployment. So the
// safety model is not care, it is construction: the flag has a trigger in front
// of it that only the CLI can pass, the set of accounts the tool may touch can
// only grow by being born, and a session the switcher minted is never itself an
// admin.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

async function register(name: string, email: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1', town: 'Trondheim' },
  })
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

/**
 * The message the database actually raised.
 *
 * Drizzle wraps a driver error in «Failed query: …», so the sentence the
 * trigger wrote is one or two `cause` hops down. These tests are about that
 * sentence — it is what a person will see in a log — so they read it rather
 * than the wrapper.
 */
async function refusal(run: Promise<unknown>): Promise<string> {
  try {
    await run
  } catch (error) {
    const messages: string[] = []
    for (let e: any = error, depth = 0; e && depth < 5; e = e.cause, depth++) {
      if (typeof e.message === 'string') messages.push(e.message)
    }
    return messages.join(' | ')
  }
  throw new Error('the statement was not refused')
}

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

describe('the test tooling', () => {
  let gabriel = '', gabrielId = ''
  let stranger = '', strangerId = ''
  let kariId = '', kariToken = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    const a = await register('Gabriel', 'gabriel@epost.no')
    const b = await register('En Fremmed', 'fremmed@epost.no')
    ;[gabriel, gabrielId] = [a.token, a.id]
    ;[stranger, strangerId] = [b.token, b.id]
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. before the key is cut, the section does not exist', async () => {
    // 404 and not 403: whether this deployment has an admin section is not
    // something the API volunteers to somebody who is not in it.
    const res = await call('GET', '/admin/overview', { token: gabriel })

    expect(res.status).toBe(404)
    expect(res.body!['code']).toBe('not_found')
  })

  test('2. and nothing reachable over HTTP can cut one', async () => {
    // The trigger in drizzle/0004_admin.sql, from the outside: whatever a route
    // might one day be talked into running, this is what happens.
    expect(
      await refusal(db.execute(sql`update users set is_admin = true where id = ${gabrielId}`)),
    ).toMatch(/admin CLI/)

    const still = await db.execute<{ is_admin: boolean }>(
      sql`select is_admin from users where id = ${gabrielId}`,
    )
    expect(still[0]!.is_admin).toBe(false)
  })

  test('3. the CLI opens the guard, and only for as long as its transaction', async () => {
    await grantAdmin(gabrielId)

    const res = await call('GET', '/admin/overview', { token: gabriel })
    expect(res.status).toBe(200)
    expect(res.body!['you']['displayName']).toBe('Gabriel')
    expect(res.body!['accounts']).toEqual([])

    // The GUC did not outlive the transaction that set it.
    expect(
      await refusal(db.execute(sql`update users set is_admin = true where id = ${strangerId}`)),
    ).toMatch(/admin CLI/)
  })

  test('4. an ordinary account still sees nothing at all', async () => {
    for (const url of ['/admin/overview', '/admin/state']) {
      expect((await call('GET', url, { token: stranger })).status, url).toBe(404)
    }
    expect((await call('POST', '/admin/accounts', { token: stranger })).status).toBe(404)
  })

  test('5. a test account is born claimed, furnished, and with no password', async () => {
    const made = await call('POST', '/admin/accounts', {
      token: gabriel, body: { displayName: 'Kari Testbruker', town: 'Bergen', withItems: 2 },
    })
    expect(made.status).toBe(201)
    kariId = made.body!['id']

    const overview = await call('GET', '/admin/overview', { token: gabriel })
    expect(overview.body!['accounts']).toHaveLength(1)
    expect(overview.body!['accounts'][0]).toMatchObject({
      displayName: 'Kari Testbruker',
      town: 'Bergen',
      itemCount: 2,
      claimed: true,
    })

    // No credential of its own: the switcher is the only door, so the account
    // cannot outlive the key.
    const row = await db.execute<{ password_hash: string | null; email: string }>(
      sql`select password_hash, email from users where id = ${kariId}`,
    )
    expect(row[0]!.password_hash).toBeNull()
    expect(row[0]!.email).toMatch(/@swaply\.test$/)
    const login = await call('POST', '/auth/login', {
      body: { email: row[0]!.email, password: 'byttehandel1' },
    })
    expect(login.status).toBe(401)
  })

  test('6. switching mints an ordinary session that says who minted it', async () => {
    const switched = await call('POST', `/admin/accounts/${kariId}/session`, { token: gabriel })
    expect(switched.status).toBe(200)
    kariToken = switched.body!['token']

    const me = await call('GET', '/me', { token: kariToken })
    expect(me.body!['id']).toBe(kariId)
    // Server truth, so a refresh or a cold start cannot lose it — this is what
    // the floor above the bottom nav draws itself from.
    expect(me.body!['actingAs']).toMatchObject({ adminId: gabrielId, adminName: 'Gabriel' })
    expect(me.body!['isAdmin']).toBe(false)
    expect(me.body!['testAccount']).toBe(true)

    // And Gabriel's own session is unchanged by any of it.
    expect((await call('GET', '/me', { token: gabriel })).body!['actingAs']).toBeNull()
  })

  test('7. the key does not travel with the person you are being', async () => {
    // Acting as Kari must not be a way of being an admin called Kari, or one
    // forgotten switch turns into a tool acting on a tool.
    expect((await call('GET', '/admin/overview', { token: kariToken })).status).toBe(404)
    expect((await call('POST', '/admin/accounts', { token: kariToken })).status).toBe(404)
  })

  test('8. and it reaches nobody the admin did not make', async () => {
    const switched = await call('POST', `/admin/accounts/${strangerId}/session`, { token: gabriel })
    expect(switched.status).toBe(404)

    expect((await call('DELETE', `/admin/accounts/${strangerId}`, { token: gabriel })).status).toBe(404)
    expect(
      (await call('POST', `/admin/accounts/${strangerId}/reset`, {
        token: gabriel, body: { parts: ['likes'] },
      })).status,
    ).toBe(404)
  })

  test('9. nor can the set grow sideways: an account is born test, never adopted', async () => {
    // The other half of the trigger, and the reason the safety model holds:
    // if a request could point `test_account_of` at a row that already exists,
    // the tool could take ownership of a real person and then act as them.
    expect(
      await refusal(
        db.execute(sql`update users set test_account_of = ${gabrielId} where id = ${strangerId}`),
      ),
    ).toMatch(/never adopted/)
  })

  test('10. an admin is never somebody’s test account', async () => {
    expect(
      await refusal(
        db.transaction(async (tx) => {
          await tx.execute(sql`set local swaply.admin_grant = 'on'`)
          await tx.execute(sql`update users set is_admin = true where id = ${kariId}`)
        }),
      ),
    ).toMatch(/admin_is_not_a_test_account/)
  })

  test('11. every admin change leaves a row somebody can find afterwards', async () => {
    const rows = await db.execute<Json>(
      sql`select method, path, acting_as from admin_actions
          where admin_id = ${gabrielId} order by created_at`,
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r['path'] === '/admin/accounts' && r['method'] === 'POST')).toBe(true)
    // Written by the hook that authorises the request, not by a route, so a
    // route cannot forget it.
    expect(rows.some((r) => r['path'].includes('/session'))).toBe(true)
    // Reading is not a change. The tool screen loads its own overview every
    // time it opens, and twenty rows of that would bury the twenty it shows.
    expect(rows.every((r) => r['method'] !== 'GET')).toBe(true)
  })

  test('12. and so does every write made while acting as somebody', async () => {
    await call('POST', '/items', {
      token: kariToken,
      body: { title: 'Lagt ut som Kari', category: 'verktoy', condition: 'good' },
    })

    const rows = await db.execute<Json>(
      sql`select path, acting_as from admin_actions
          where admin_id = ${gabrielId} and acting_as = ${kariId}`,
    )
    expect(rows.some((r) => r['path'] === '/items')).toBe(true)
  })

  test('13. resetting an account opens the doors the product closes once', async () => {
    // Interests are three to five or none and `PUT /me/interests` takes three
    // at minimum, so screen 02 is otherwise once per account; BankID is set
    // once and nothing unsets it.
    await call('POST', '/me/bankid', { token: kariToken, body: { subject: 'test-kari' } })
    expect((await call('GET', '/me', { token: kariToken })).body!['bankidVerified']).toBe(true)

    const res = await call('POST', `/admin/accounts/${kariId}/reset`, {
      token: gabriel, body: { parts: ['bankid', 'interests', 'items'] },
    })
    expect(res.status).toBe(200)

    const me = await call('GET', '/me', { token: kariToken })
    expect(me.body!['bankidVerified']).toBe(false)
    expect(me.body!['interests']).toEqual([])
    expect(me.body!['items']).toEqual([])
  })

  test('14. the tool never deletes the account that owns it', async () => {
    const res = await call('DELETE', `/admin/accounts/${gabrielId}`, { token: gabriel })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('not_yourself')
  })

  test('15. retiring a test account goes through the erasure engine', async () => {
    const doomed = await call('POST', '/admin/accounts', {
      token: gabriel, body: { displayName: 'Til Sletting', withItems: 1 },
    })
    const id = doomed.body!['id']

    expect((await call('DELETE', `/admin/accounts/${id}`, { token: gabriel })).status).toBe(200)

    const row = await db.execute<Json>(
      sql`select display_name, email, device_id, anonymised_at from users where id = ${id}`,
    )
    expect(row[0]!['display_name']).toBeNull()
    expect(row[0]!['anonymised_at']).not.toBeNull()

    // Sealed as a test account, so a made-up identity is never mistaken for one
    // we would hand a court.
    const sealed = await db.execute<Json>(
      sql`select reason from retained.identities where user_id = ${id}`,
    )
    expect(sealed[0]!['reason']).toBe('test_account')

    // And it is out of the ring.
    const overview = await call('GET', '/admin/overview', { token: gabriel })
    expect(overview.body!['accounts'].some((a: Json) => a['id'] === id)).toBe(false)
  })

  test('16. no route writes to `is_admin`, and one reads it', () => {
    // The cheapest possible guard against the next person adding a convenient
    // `update users set is_admin = …` to a handler. The trigger refuses it at
    // runtime; this refuses it at review time, which is cheaper still.
    //
    // Reading is fine and two routes do it: `serialize.ts` puts the flag on the
    // wire so the app knows whether to draw the section at all, and
    // `discovery.ts` uses it to decide whose test listings you may see.
    const dir = join(process.cwd(), 'src/routes')
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'))
    const source = (name: string) => readFileSync(join(dir, name), 'utf8')

    const writers = files.filter((name) => /is_admin\s*=/.test(source(name)))
    expect(writers).toEqual([])

    const readers = files.filter((name) => source(name).includes('is_admin'))
    expect(readers.sort()).toEqual(['discovery.ts', 'serialize.ts'])
  })
})
