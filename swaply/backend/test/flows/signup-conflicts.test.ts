// FLOW — Signing up with something somebody already has
//
// The rule this exists to pin down: **a person who types a value the database
// will not accept is told what to fix, in Norwegian, and never handed a 500.**
// An e-mail address and a phone number are both unique columns, so both are
// ways an ordinary person walks into a rule by typing. A 500 blames us for
// what they can correct themselves, and says nothing they can act on.
//
// Two layers, and both are tested here: the route checks before it writes, so
// the ordinary case reads well; and the error handler translates the unique
// index itself, so the race between check and insert — and every route that
// has no check of its own — answers the same way.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, reset } from '../helpers.js'

let app: FastifyInstance

type Json = Record<string, any>

async function post(url: string, body: Json, token?: string) {
  const res = await app.inject({
    method: 'POST',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body,
  })
  return { status: res.statusCode, body: res.json() as Json }
}

describe('signing up with something taken', () => {
  let olaToken = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    await app.ready()

    const first = await post('/auth/register', {
      displayName: 'Ola',
      email: 'ola@epost.no',
      phone: '406 41 522',
      password: 'et langt passord',
    })
    expect(first.status).toBe(201)
    olaToken = first.body['token']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. the e-mail is taken: 409, and it says which field', async () => {
    const res = await post('/auth/register', {
      displayName: 'Kari',
      email: 'ola@epost.no',
      password: 'et langt passord',
    })

    expect(res.status).toBe(409)
    expect(res.body['code']).toBe('email_taken')
    expect(res.body['message']).toContain('e-posten')
  })

  test('2. the phone number is taken: 409, not a 500', async () => {
    const res = await post('/auth/register', {
      displayName: 'Kari',
      email: 'kari@epost.no',
      phone: '406 41 522',
      password: 'et langt passord',
    })

    expect(res.status).toBe(409)
    expect(res.body['code']).toBe('phone_taken')
    expect(res.body['message']).toContain('telefonnummeret')
  })

  test('3. without a phone number nothing collides, however many sign up', async () => {
    for (const name of ['Kari', 'Per']) {
      const res = await post('/auth/register', {
        displayName: name,
        email: `${name.toLowerCase()}@epost.no`,
        password: 'et langt passord',
      })
      expect(res.status, name).toBe(201)
    }

    const rows = await db.execute<{ n: string }>(
      sql`select count(*)::text as n from users where phone is null`,
    )
    expect(Number(rows[0]!.n)).toBe(2)
  })

  test('4. a route with no check of its own answers the same way', async () => {
    // PATCH /me writes straight into the unique column; the index is what
    // catches it, and the handler is what turns that into words.
    const kari = await post('/auth/register', {
      displayName: 'Kari K.',
      email: 'kari.k@epost.no',
      password: 'et langt passord',
    })
    expect(kari.status).toBe(201)

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${kari.body['token']}` },
      payload: { phone: '406 41 522' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()['code']).toBe('phone_taken')
  })

  test('5. the account that got there first is untouched', async () => {
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${olaToken}` },
    })

    expect(me.statusCode).toBe(200)
    expect(me.json()['phone']).toBe('406 41 522')
  })
})
