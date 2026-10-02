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
//
// And an address is one address whatever its case. A mail server delivers
// «Ola@epost.no» and «ola@epost.no» to the same mailbox, and a phone keyboard
// capitalises the first letter of a field by itself; kept as typed, the same
// person got two accounts, or a sign-in that said the password was wrong.
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

  test('6. the same address with capitals in it is the same address, and taken', async () => {
    const res = await post('/auth/register', {
      displayName: 'Ola igjen',
      email: 'Ola@Epost.no',
      password: 'et langt passord',
    })

    expect(res.status).toBe(409)
    expect(res.body['code']).toBe('email_taken')
  })

  test('7. signing in with a capital letter finds the account', async () => {
    const res = await post('/auth/login', { email: 'Ola@epost.no', password: 'et langt passord' })

    expect(res.status).toBe(200)
    expect(res.body['user']['email']).toBe('ola@epost.no')
  })

  test('8. an address is kept lower-cased, without the space autocomplete leaves', async () => {
    const res = await post('/auth/register', {
      displayName: 'Siri',
      email: ' Siri.Berg@Epost.NO ',
      password: 'et langt passord',
    })

    expect(res.status).toBe(201)
    expect(res.body['user']['email']).toBe('siri.berg@epost.no')

    const again = await post('/auth/login', { email: 'siri.berg@epost.no', password: 'et langt passord' })
    expect(again.status).toBe(200)
  })

  test('9. changing to somebody else’s address in other capitals is refused in words', async () => {
    const per = await post('/auth/login', { email: 'per@epost.no', password: 'et langt passord' })
    expect(per.status).toBe(200)

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${per.body['token']}` },
      payload: { email: 'KARI@epost.no' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()['code']).toBe('email_taken')
    expect(res.json()['message']).toContain('e-posten')
  })

  test('10. and the database holds the rule for a write that forgets to lower-case', async () => {
    // Straight into the table, the way a script or a route written next year
    // might. The unique index is on lower(email), so case is no way around it.
    // It is still called what the case-sensitive constraint was, because an
    // image from before the migration — a rollback — only knows that name.
    await expect(
      db.execute(sql`insert into users (display_name, email) values ('Kopi', 'OLA@EPOST.NO')`),
    ).rejects.toMatchObject({ cause: { constraint_name: 'users_email_unique' } })
  })

  test('11. a name or a number that does not fit says which box it is about', async () => {
    // Under four boxes, «Dette feltet kan ikke være tomt.» and «Skriv minst 6
    // tegn.» did not say which one to fix.
    const name = await post('/auth/register', {
      displayName: '  ', email: 'navnlos@epost.no', password: 'et langt passord',
    })
    expect(name.status).toBe(400)
    expect(name.body).toMatchObject({ message: 'Skriv et visningsnavn.', field: 'displayName' })

    for (const phone of ['12345', '+47 412 34 567 89 00 11']) {
      const res = await post('/auth/register', {
        displayName: 'Tor', email: 'tor@epost.no', phone, password: 'et langt passord',
      })
      expect(res.status, phone).toBe(400)
      expect(res.body).toMatchObject({
        message: 'Telefonnummeret må ha mellom 6 og 20 tegn.',
        field: 'phone',
      })
    }

    // «Rediger profil» says the same about the same boxes.
    for (const [body, message] of [
      [{ displayName: '' }, 'Skriv et visningsnavn.'],
      [{ phone: '1234' }, 'Telefonnummeret må ha mellom 6 og 20 tegn.'],
    ] as const) {
      const res = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { authorization: `Bearer ${olaToken}` },
        payload: body,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()['message']).toBe(message)
    }
  })
})
