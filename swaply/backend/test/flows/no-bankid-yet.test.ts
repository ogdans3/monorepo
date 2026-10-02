// FLOW — Nobody is BankID-verified until BankID is real
//
// The rule this exists to pin down: **there is no BankID in the product until
// there is an agreement with a provider, and every account reads
// `bankidVerified: false`.** The product owner's decision, 02.10.2026. What
// stood in for a provider took any subject the app sent it, so any tester
// could make themselves «BankID-verifisert» to everybody, and the badge said
// something nobody had checked.
//
// The field stays in every answer that carries a person, because the build
// testers have from 30.09 reads it, and false draws nothing there. The route
// that build asks stays as well, to refuse in words: the build shows a
// refusal's words in a toast, and «Fant ikke det du ba om» would be about
// nothing it asked. The columns stay for the day BankID is real, and until
// then nothing writes them.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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
  expect(res.status).toBe(201)
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

/** Every `bankidVerified` in an answer, wherever it is: one per person in it. */
function verifiedFlags(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(verifiedFlags)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key === 'bankidVerified' ? [inner] : verifiedFlags(inner),
  )
}

async function columns(userId: string) {
  const [row] = await db.execute<Json>(
    sql`select bankid_subject, bankid_verified_at from users where id = ${userId}`,
  )
  return row!
}

describe('nobody is BankID-verified', () => {
  let ola = { token: '', id: '' }
  let kari = { token: '', id: '' }
  let gabriel = { token: '', id: '' }
  let testAccount = ''
  let drill = '', tent = '', tradeId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    ola = await register('Ola N.', 'ola@epost.no')
    kari = await register('Kari N.', 'kari@epost.no')
    gabriel = await register('Gabriel', 'gabriel@epost.no')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  /** Each answer that carries a person, as Ola and the people around him see them. */
  async function everyProfile() {
    const signedIn = await call('POST', '/auth/login', {
      body: { email: 'ola@epost.no', password: 'byttehandel1' },
    })
    const answers: Array<[string, { status: number; body: Json | null }]> = [
      ['POST /auth/login', signedIn],
      ['GET /me', await call('GET', '/me', { token: ola.token })],
      ['GET /users/:id', await call('GET', `/users/${kari.id}`, { token: ola.token })],
      ['GET /items/:id', await call('GET', `/items/${tent}`, { token: ola.token })],
      ['GET /me/liked-by', await call('GET', '/me/liked-by', { token: ola.token })],
      ['GET /trades/:id', await call('GET', `/trades/${tradeId}`, { token: kari.token })],
    ]
    for (const [what, answer] of answers) {
      expect(answer.status, what).toBe(200)
      const flags = verifiedFlags(answer.body)
      // Still said, for the build from 30.09 that reads it.
      expect(flags.length, what).toBeGreaterThan(0)
      expect(flags.every((flag) => flag === false), what).toBe(true)
    }
  }

  test('1. asking to be verified is refused in words, and writes nothing', async () => {
    // What the build from 30.09 sends from «Verifiser», after a first accept
    // and on 16b. The refusal is a toast there.
    const res = await call('POST', '/me/bankid', {
      token: ola.token, body: { subject: `dev-${ola.id}` },
    })

    expect(res.status).toBe(410)
    expect(res.body).toEqual({
      code: 'bankid_unavailable',
      message: 'BankID er ikke på plass ennå.',
    })
    expect(await columns(ola.id)).toEqual({ bankid_subject: null, bankid_verified_at: null })
    expect((await call('GET', '/me', { token: ola.token })).body!['bankidVerified']).toBe(false)
  })

  test('2. the test tooling makes nobody verified either', async () => {
    await grantAdmin(gabriel.id)

    // Asked for in so many words, which the tool used to honour.
    const made = await call('POST', '/admin/accounts', {
      token: gabriel.token, body: { displayName: 'Tea T.', bankid: true },
    })
    expect(made.status).toBe(201)
    testAccount = made.body!['id']
    expect(await columns(testAccount)).toEqual({ bankid_subject: null, bankid_verified_at: null })

    // The ring no longer says who is verified, since nobody is.
    const overview = await call('GET', '/admin/overview', { token: gabriel.token })
    expect(overview.body!['accounts']).toHaveLength(1)
    expect(overview.body!['accounts'][0]).not.toHaveProperty('bankid')

    // «Nullstill BankID» is still a lever in the build from 30.09. It is
    // refused in words rather than with a 500.
    const lever = await call('POST', `/admin/accounts/${testAccount}/reset`, {
      token: gabriel.token, body: { parts: ['bankid'] },
    })
    expect(lever.status).toBe(400)
    expect(lever.body).toMatchObject({
      code: 'invalid_request',
      message: 'Velg et av alternativene.',
    })
  })

  test('3. every answer that carries a person says false', async () => {
    const listed = async (token: string, title: string, category: string) => {
      const res = await call('POST', '/items', {
        token, body: { title, category, condition: 'good', estimatedValueNok: 600 },
      })
      expect(res.status).toBe(201)
      return res.body!['id'] as string
    }
    drill = await listed(ola.token, 'Bosch drill 18V', 'verktoy')
    tent = await listed(kari.token, 'Telt, 3 personer', 'friluft')

    // Each wants what the other has, so a trade opens with both of them in it.
    expect((await call('POST', `/items/${tent}/like`, { token: ola.token })).status).toBe(200)
    const closing = await call('POST', `/items/${drill}/like`, { token: kari.token })
    expect(closing.status).toBe(200)
    tradeId = closing.body!['tradeId']
    expect(tradeId).toBeTruthy()

    await everyProfile()
  })

  test('4. and so does every account the stand-in verified before 0014', async () => {
    // What the old route, the test tooling and the seed wrote, put back the
    // way they wrote it — and a tombstone, whose subject erasure emptied and
    // whose timestamp it left.
    await db.execute(
      sql`update users set bankid_subject = 'dev-' || id::text, bankid_verified_at = now()
          where id in (${ola.id}, ${kari.id})`,
    )
    await db.execute(
      sql`update users set bankid_subject = 'test-0a1b2c3d', bankid_verified_at = now()
          where id = ${testAccount}`,
    )
    const [tombstone] = await db.execute<Json>(
      sql`insert into users (anonymised_at, bankid_verified_at) values (now(), now())
          returning id`,
    )

    // The answers read the column, which is why the rows had to be cleared.
    expect((await call('GET', '/me', { token: ola.token })).body!['bankidVerified']).toBe(true)

    const file = readFileSync(join(process.cwd(), 'drizzle', '0014_bankid_stubs_cleared.sql'), 'utf8')
    await db.execute(sql.raw(file))

    const left = await db.execute<Json>(
      sql`select id from users
          where bankid_subject is not null or bankid_verified_at is not null`,
    )
    expect(left).toEqual([])
    expect(await columns(tombstone!['id'])).toEqual({ bankid_subject: null, bankid_verified_at: null })
    await everyProfile()
  })

  test('5. nothing under src/ writes the columns until BankID is real', async () => {
    // Erasure empties the subject, and that is all: anything else written
    // here is somebody verified again, by something nobody checked. When a
    // provider is in place this test goes, on purpose, with the decision.
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

    // In SQL — the timestamp set to anything, the subject to anything but
    // null, either named in an insert into `users` — or through the query
    // builder, which names them `bankidSubject` and `bankidVerifiedAt`.
    const sqlWrite = [
      /\bbankid_verified_at"?\s*=(?!=)/,
      /\bbankid_subject"?\s*=(?!=)(?!\s*null\b)/i,
      /insert\s+into\s+"?users"?\s*\([^)]*\bbankid_(subject|verified_at)\b/is,
    ]
    const writers = files
      .filter((path) => {
        const source = readFileSync(path, 'utf8')
        const builder =
          /\bbankid(Subject|VerifiedAt)\b/.test(source) && !path.endsWith(join('db', 'schema.ts'))
        return builder || sqlWrite.some((write) => write.test(source))
      })
      .map((path) => relative(src, path))
    expect(writers).toEqual([])
  })
})
