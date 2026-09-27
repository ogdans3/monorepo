// FLOW — A device nobody claimed, left alone for twelve months
//
// The rule this exists to pin down: **an account that never made a profile is
// erased once twelve months have passed without a single request from its own
// token — and strictly so.** Opening the app is a request (the app asks
// `GET /me` when it starts and when it comes back from the background), so
// opening it once keeps the account another twelve months. Nothing that is
// not the account's own request counts: somebody liking the listing it liked,
// its owner looking at who wants it, an admin reading its profile or acting as
// it through the switcher, the cycle sweep passing over its wish.
//
// «Twelve months» is the database's clock and the calendar's months, and
// «more than» means more than: a minute short is kept, a minute past is not.
// The sessions are a second witness — a session seen inside the window keeps
// the account even if the account's own mark failed to move.
//
// Only a device: a claimed account and a test account are kept whatever their
// age. The device goes through the same erasure engine as everybody, so its
// likes, what it hid and its interests go, and so does its device id — the
// phone that comes back is a stranger. It leaves no sealed record, because it
// never had anything to seal.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { eraseInactiveDevices } from '../../src/trades/erasure.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
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
  expect(res.status).toBe(201)
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', subcategory: 'Elektroverktøy', condition: 'good' },
  })
  expect(res.status).toBe(201)
  return res.body!['id'] as string
}

/** A phone opening the app for the first time. */
async function device(deviceId: string) {
  const res = await call('POST', '/auth/anonymous', { body: { deviceId } })
  expect(res.status).toBe(201)
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string, deviceId }
}

/**
 * Put an account's last request `ago` in the past — its own mark and every
 * session it has. The one thing a test of a twelve-month rule cannot wait for.
 */
async function lastUsed(userId: string, ago: string) {
  await db.execute(
    sql`update users set last_active_at = now() - ${ago}::interval where id = ${userId}`,
  )
  await db.execute(
    sql`update sessions set last_seen_at = now() - ${ago}::interval where user_id = ${userId}`,
  )
}

async function account(userId: string) {
  const [row] = await db.execute<Record<string, any>>(
    sql`select device_id, anonymised_at, cardinality(interests) as interests,
               last_active_at < now() - interval '12 months' as idle
        from users where id = ${userId}`,
  )
  return row!
}

/** What the admin CLI does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

describe('a device left alone for twelve months', () => {
  let kari = { token: '', id: '' }
  let per = { token: '', id: '' }
  let gabriel = { token: '', id: '' }
  let drill = '', tent = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    kari = await register('Kari')
    per = await register('Per')
    gabriel = await register('Gabriel')
    await grantAdmin(gabriel.id)
    drill = await list(kari.token, 'Bosch drill 18V')
    tent = await list(kari.token, 'Telt')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  describe('the edge of the window', () => {
    let short = { token: '', id: '', deviceId: '' }
    let long = { token: '', id: '', deviceId: '' }

    beforeAll(async () => {
      short = await device('phone-short-0123456789abcdef')
      long = await device('phone-long-0123456789abcdef0')

      // The long one did everything a device may: wished, hid a kind, and
      // chose what it is interested in.
      expect((await call('POST', `/items/${drill}/like`, { token: long.token })).status).toBe(200)
      expect((await call('POST', '/me/hidden', { token: long.token, body: { itemId: tent } })).status).toBe(200)
      const chosen = await call('PUT', '/me/interests', {
        token: long.token, body: { interests: ['verktoy', 'friluft', 'sykling'] },
      })
      expect(chosen.status).toBe(200)
    })

    test('1. a minute short of twelve months is kept', async () => {
      await lastUsed(short.id, '12 months -1 minute')

      expect(await eraseInactiveDevices(db)).toBe(0)

      const row = await account(short.id)
      expect(row['anonymised_at']).toBeNull()
      expect(row['device_id']).toBe(short.deviceId)
    })

    test('2. a minute past it is erased', async () => {
      await lastUsed(long.id, '12 months 1 minute')

      expect(await eraseInactiveDevices(db)).toBe(1)

      const row = await account(long.id)
      expect(row['anonymised_at']).not.toBeNull()
      // Its only credential, gone, along with the token.
      expect(row['device_id']).toBeNull()
      expect((await call('GET', '/me', { token: long.token })).status).toBe(401)
    })

    test('3. its wishes, what it hid and what it chose go with it', async () => {
      const likes = await db.execute(sql`select 1 from likes where from_user = ${long.id}`)
      expect(likes).toHaveLength(0)
      const hidden = await db.execute(sql`select 1 from hidden_listings where user_id = ${long.id}`)
      expect(hidden).toHaveLength(0)
      expect(Number((await account(long.id))['interests'])).toBe(0)

      // Kari is not left counting a wish from nobody.
      const me = await call('GET', '/me', { token: kari.token })
      expect(me.body!['likedByCount']).toBe(0)
    })

    test('4. and it leaves no sealed record, having had nothing to seal', async () => {
      const sealed = await db.execute(
        sql`select 1 from retained.identities where user_id = ${long.id}`,
      )
      expect(sealed).toHaveLength(0)
    })

    test('5. the phone, if it comes back, is a stranger', async () => {
      const again = await call('POST', '/auth/anonymous', { body: { deviceId: long.deviceId } })

      expect(again.status).toBe(201)
      expect(again.body!['user']['id']).not.toBe(long.id)
      // Nothing of the old one follows it back.
      expect(again.body!['user']['hiddenCount']).toBe(0)
    })
  })

  describe('who is never swept', () => {
    test('6. a claimed account, however long it has been', async () => {
      await lastUsed(per.id, '5 years')

      await eraseInactiveDevices(db)

      expect((await account(per.id))['anonymised_at']).toBeNull()
    })

    test('7. a test account, claimed or not, however long it has been', async () => {
      const made: string[] = []
      for (const claimed of [false, true]) {
        const res = await call('POST', '/admin/accounts', {
          token: gabriel.token, body: { claimed, withItems: 0 },
        })
        expect(res.status).toBe(201)
        made.push(res.body!['id'])
        await lastUsed(res.body!['id'], '5 years')
      }

      await eraseInactiveDevices(db)

      for (const id of made) expect((await account(id))['anonymised_at'], id).toBeNull()
    })
  })

  describe('what counts as activity', () => {
    let switched = ''

    test('8. one request from its own token — what the app sends when it is opened — resets the clock', async () => {
      const opened = await device('phone-opened-0123456789abcd')
      await lastUsed(opened.id, '13 months')

      expect((await call('GET', '/me', { token: opened.token })).status).toBe(200)

      expect((await account(opened.id))['idle']).toBe(false)
      await eraseInactiveDevices(db)
      expect((await account(opened.id))['anonymised_at']).toBeNull()
    })

    test('9. so does coming back with its device id after losing the token', async () => {
      const back = await device('phone-back-0123456789abcdef')
      await lastUsed(back.id, '13 months')

      const again = await call('POST', '/auth/anonymous', { body: { deviceId: back.deviceId } })
      expect(again.status).toBe(200)
      expect(again.body!['user']['id']).toBe(back.id)

      await eraseInactiveDevices(db)
      expect((await account(back.id))['anonymised_at']).toBeNull()
    })

    test('10. a session seen inside the window keeps it, even when its own mark did not move', async () => {
      const witnessed = await device('phone-witness-0123456789abc')
      await lastUsed(witnessed.id, '13 months')
      await db.execute(
        sql`update sessions set last_seen_at = now() - interval '11 months'
            where user_id = ${witnessed.id}`,
      )

      await eraseInactiveDevices(db)

      expect((await account(witnessed.id))['anonymised_at']).toBeNull()
    })

    test('11. nothing anybody else does counts', async () => {
      const quiet = await device('phone-quiet-0123456789abcde')
      expect((await call('POST', `/items/${drill}/like`, { token: quiet.token })).status).toBe(200)
      await lastUsed(quiet.id, '13 months')

      // Per likes the same drill, and something else of Kari's.
      await call('POST', `/items/${drill}/like`, { token: per.token })
      await call('POST', `/items/${tent}/like`, { token: per.token })
      // Kari looks at who wants her things, and at the device that does.
      expect((await call('GET', '/me', { token: kari.token })).body!['likedByCount']).toBeGreaterThan(0)
      expect((await call('GET', `/users/${quiet.id}`, { token: kari.token })).status).toBe(200)
      // An admin reads it, and the cycle sweep passes over its wish.
      expect((await call('GET', `/users/${quiet.id}`, { token: gabriel.token })).status).toBe(200)
      expect((await call('GET', '/admin/state', { token: gabriel.token })).status).toBe(200)
      await sweepForCycles(db)

      expect((await account(quiet.id))['idle']).toBe(true)
      expect(await eraseInactiveDevices(db)).toBe(1)
      expect((await account(quiet.id))['anonymised_at']).not.toBeNull()
    })

    test('12. nor does an admin using it through the switcher: that is the admin, not the account', async () => {
      const made = await call('POST', '/admin/accounts', {
        token: gabriel.token, body: { claimed: false, withItems: 0 },
      })
      expect(made.status).toBe(201)
      switched = made.body!['id']
      const session = await call('POST', `/admin/accounts/${switched}/session`, { token: gabriel.token })
      expect(session.status).toBe(200)
      await lastUsed(switched, '13 months')

      expect((await call('GET', '/me', { token: session.body!['token'] })).status).toBe(200)

      // The session was seen — it is the admin's, and was used — but the
      // account's own mark did not move.
      expect((await account(switched))['idle']).toBe(true)
    })

    test('13. and the switcher’s session is no witness for it either', async () => {
      // A test account is never swept, so today step 12 is the whole of it.
      // The column does let go on its own, though — `test_account_of` is set
      // null when its admin's row goes — and then the account is a device like
      // any other, whose only recent session is the admin's.
      await db.execute(sql`update users set test_account_of = null where id = ${switched}`)

      expect(await eraseInactiveDevices(db)).toBe(1)
      expect((await account(switched))['anonymised_at']).not.toBeNull()
    })

    test('14. and only the account’s own requests write the mark, in one file', () => {
      // A route that stamped it on the way past — «the owner looked at who
      // liked it», «an admin opened it» — would keep a forgotten device alive
      // on somebody else's behalf. Reading it is fine; the sweep does.
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name)
          if (statSync(path).isDirectory()) walk(path)
          else if (name.endsWith('.ts')) files.push(path)
        }
      }
      const src = join(process.cwd(), 'src')
      walk(src)

      // Written in SQL — `set last_active_at =`, quoted or not, or named in
      // an insert's columns — or through the query builder, which names the
      // column `lastActiveAt` and is usually handed `new Date()`: the API's
      // clock, where the sweep compares in the database's. Reading it through
      // the builder would be harmless, but nothing does, so any mention
      // outside the schema is held to be a write.
      const sqlWrite = [
        /"?last_active_at"?\s*=(?!=)/,
        /insert\s+into\s+"?users"?\s*\([^)]*\blast_active_at\b/is,
      ]
      const writers = files
        .filter((path) => {
          const source = readFileSync(path, 'utf8')
          const builder = /\blastActiveAt\b/.test(source) && !path.endsWith(join('db', 'schema.ts'))
          return builder || sqlWrite.some((write) => write.test(source))
        })
        .map((path) => relative(src, path))
      expect(writers).toEqual(['auth/sessions.ts'])
    })

    test('15. and the migration that made the mark drew the same line over what came before it', async () => {
      // drizzle/0007 filled the column in from what each account had already
      // done, and its best witness was the sessions, touched on every request.
      // Only the account's own, though: step 12 holds for the past too, or a
      // test account let go of later would carry the admin's last visit as its
      // own. Run here as the file has it, over rows made to look as old as the
      // live ones were.
      const made = await call('POST', '/admin/accounts', {
        token: gabriel.token, body: { claimed: false, withItems: 0 },
      })
      expect(made.status).toBe(201)
      const shelved = made.body!['id'] as string
      const minted = await call('POST', `/admin/accounts/${shelved}/session`, { token: gabriel.token })
      expect(minted.status).toBe(200)
      expect((await call('GET', '/me', { token: minted.body!['token'] })).status).toBe(200)
      const used = await device('phone-backfill-0123456789a')

      // Both made 28 months ago and marked idle, as the column's default is
      // not; the device last opened two months ago.
      for (const id of [shelved, used.id]) {
        await db.execute(
          sql`update users set created_at = now() - interval '28 months',
                               last_active_at = now() - interval '20 months'
              where id = ${id}`,
        )
      }
      await db.execute(
        sql`update sessions set last_seen_at = now() - interval '2 months'
            where user_id = ${used.id}`,
      )

      const file = readFileSync(join(process.cwd(), 'drizzle', '0007_last_active.sql'), 'utf8')
      const backfill = file
        .split('--> statement-breakpoint')
        .map((part) => part.trim())
        .find((part) => part.startsWith('UPDATE'))
      expect(backfill).toBeDefined()
      await db.execute(sql.raw(backfill!))

      // The device's own session speaks for it…
      expect((await account(used.id))['idle']).toBe(false)
      // …and the switcher's, seen a moment ago, does not speak for the test
      // account, which is left with the day it was made.
      expect((await account(shelved))['idle']).toBe(true)
      const [row] = await db.execute<{ same: boolean }>(
        sql`select last_active_at = created_at as same from users where id = ${shelved}`,
      )
      expect(row!.same).toBe(true)
    })
  })
})
