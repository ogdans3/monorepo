// FLOW — A postcode says a town, wherever a person types one
//
// The rule this exists to pin down: **a postcode is looked up, and the town it
// belongs to is what is kept and shown — on a profile as on a listing.** The
// schema said so of `users.postal_code` («only the town it resolves to is shown
// to others») while register and PATCH /me stored the postcode and left the
// town to whatever the client sent, which was usually nothing.
//
// A postcode that belongs to no town is refused in words and changes nothing,
// the way 10b refuses one. And the lookup itself is open to anybody, without a
// session: it is reference data from a register carried in the build, it says
// nothing about anybody, and it lets a form show «Trondheim» under «7030»
// while the person is still typing.
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

describe('a postcode says a town', () => {
  let ola = ''
  let olaId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. anybody may ask which town a postcode belongs to, without a session', async () => {
    const res = await call('GET', '/postcodes/7030')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ postalCode: '7030', town: 'Trondheim' })
  })

  test('2. the answer is the town as a sentence writes it', async () => {
    const towns: Record<string, string> = {
      '0001': 'Oslo',
      '7030': 'Trondheim',
      '8622': 'Mo i Rana',
      '4610': 'Kristiansand S',
    }
    for (const [code, town] of Object.entries(towns)) {
      const res = await call('GET', `/postcodes/${code}`)
      expect(res.body!['town'], code).toBe(town)
    }
  })

  test('3. a postcode that belongs to no town is not found, and it says so in words', async () => {
    const res = await call('GET', '/postcodes/0000')

    expect(res.status).toBe(404)
    expect(res.body!['code']).toBe('unknown_postal_code')
    expect(res.body!['message']).toBe('Fant ikke postnummer 0000. Sjekk det, eller la feltet stå tomt.')
  })

  test('4. something that is not four digits is not a postcode at all', async () => {
    for (const code of ['703', '70300', 'abcd']) {
      const res = await call('GET', `/postcodes/${code}`)
      expect(res.status, code).toBe(400)
      expect(res.body!['message'], code).toBe('Et postnummer har fire sifre.')
    }
  })

  test('5. signing up with a postcode puts the account in its town, over a town sent with it', async () => {
    const res = await call('POST', '/auth/register', {
      body: {
        displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123',
        postalCode: '8622', town: 'Oslo',
      },
    })

    expect(res.status).toBe(201)
    expect(res.body!['user']['postalCode']).toBe('8622')
    expect(res.body!['user']['town']).toBe('Mo i Rana')
    ola = res.body!['token']
    olaId = res.body!['user']['id']
  })

  test('6. signing up with a postcode that is no postcode is refused, and makes no account', async () => {
    const res = await call('POST', '/auth/register', {
      body: { displayName: 'Kari', email: 'kari@epost.no', password: 'fiskestang1', postalCode: '0000' },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('unknown_postal_code')

    // The address is still free: nothing was written on the way to the refusal.
    const again = await call('POST', '/auth/register', {
      body: { displayName: 'Kari', email: 'kari@epost.no', password: 'fiskestang1', postalCode: '7030' },
    })
    expect(again.status).toBe(201)
    expect(again.body!['user']['town']).toBe('Trondheim')
  })

  test('7. moving is a new postcode on the profile, and the town follows it', async () => {
    const res = await call('PATCH', '/me', { token: ola, body: { postalCode: '4610' } })

    expect(res.status).toBe(200)
    expect(res.body!['postalCode']).toBe('4610')
    expect(res.body!['town']).toBe('Kristiansand S')
  })

  test('8. a correction with a postcode that is no postcode changes nothing', async () => {
    const res = await call('PATCH', '/me', { token: ola, body: { postalCode: '0000' } })
    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('unknown_postal_code')

    const me = await call('GET', '/me', { token: ola })
    expect(me.body!['postalCode']).toBe('4610')
    expect(me.body!['town']).toBe('Kristiansand S')
  })

  test('9. a phone looking around may say where it is the same way', async () => {
    // Where you are is about looking, which a device may do.
    const phone = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-postcodes-0123456789abcdef' },
    })
    const res = await call('PATCH', '/me', {
      token: phone.body!['token'],
      body: { postalCode: '7030' },
    })

    expect(res.status).toBe(200)
    expect(res.body!['town']).toBe('Trondheim')
  })

  test('10. somebody else sees the town, and never the postcode', async () => {
    const kari = await call('POST', '/auth/login', {
      body: { email: 'kari@epost.no', password: 'fiskestang1' },
    })
    const res = await call('GET', `/users/${olaId}`, { token: kari.body!['token'] })

    expect(res.body!['town']).toBe('Kristiansand S')
    expect(res.body).not.toHaveProperty('postalCode')
    expect(JSON.stringify(res.body)).not.toContain('"4610"')
  })
})
