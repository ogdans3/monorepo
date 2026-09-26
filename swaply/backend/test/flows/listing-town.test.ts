// FLOW — Where a listing is (10b's postcode)
//
// The rule this exists to pin down: **a listing shows the town its postcode
// belongs to, and never the postcode.** 10b asks for a postcode and says «Kun
// by vises for andre» under it; the server used to take the postcode and throw
// it away, so the town came from the owner's profile — and a profile made on
// 10c, which is how most people get one, has no town. The listing went out
// with none.
//
// The postcode comes before the owner's town, because a thing kept at the
// cabin is at the cabin. Without one, the owner's town is still the answer,
// and with neither there is no town rather than an invented one. A postcode
// that belongs to no town is refused in words, since passing over it is the
// same silence as before and a typo is the likeliest reason for one.
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

/** 10b as the app sends it: a postcode only when one was typed. */
function list(token: string, title: string, postalCode?: string) {
  return call('POST', '/items', {
    token,
    body: {
      title, category: 'verktoy', condition: 'good', estimatedValueNok: 600,
      ...(postalCode === undefined ? {} : { postalCode }),
    },
  })
}

async function listingCount(token: string) {
  return ((await call('GET', '/me', { token })).body!['items'] as Json[]).length
}

describe('where a listing is', () => {
  let ola = '', kari = '', per = ''
  let drill = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    // Ola as most people arrive: a phone looking around, then a profile made
    // on 10c on the way to listing something. 10c asks for no place at all.
    const phone = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-listing-town-0123456789ab' },
    })
    const claimed = await call('POST', '/auth/register', {
      token: phone.body!['token'],
      body: { displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123' },
    })
    ola = claimed.body!['token']
    expect(claimed.body!['user']['town']).toBeNull()

    const k = await call('POST', '/auth/register', {
      body: { displayName: 'Kari N.', email: 'kari@epost.no', password: 'fiskestang1', town: 'Bergen' },
    })
    kari = k.body!['token']

    // Somebody who gave a postcode and no town when they signed up.
    const p = await call('POST', '/auth/register', {
      body: { displayName: 'Per H.', email: 'per@epost.no', password: 'sykkelsete1', postalCode: '8601' },
    })
    per = p.body!['token']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a profile with no town lists with 7030, and the listing is in Trondheim', async () => {
    const res = await list(ola, 'Bosch drill 18V', '7030')

    expect(res.status).toBe(201)
    expect(res.body!['town']).toBe('Trondheim')
    drill = res.body!['id']
  })

  test('2. that is the town the other side sees, on the listing and on Oppdag', async () => {
    const page = await call('GET', `/items/${drill}`, { token: kari })
    expect(page.body!['town']).toBe('Trondheim')

    const found = await call('GET', '/discover?q=drill', { token: kari })
    expect(found.body!['items'][0]['town']).toBe('Trondheim')
  })

  test('3. and the postcode itself is said nowhere', async () => {
    // «Kun by vises for andre»: it is looked up, not kept.
    for (const res of [
      await call('GET', `/items/${drill}`, { token: kari }),
      await call('GET', '/discover?q=drill', { token: kari }),
    ]) {
      expect(JSON.stringify(res.body)).not.toContain('"7030"')
    }
  })

  test('4. a town is written the way a sentence writes it, not the way Bring does', async () => {
    // The register is in capitals: «MO I RANA», «KRISTIANSAND S», «NY-ÅLESUND».
    expect((await list(ola, 'Hammer', '8601')).body!['town']).toBe('Mo i Rana')
    expect((await list(ola, 'Sag', '4608')).body!['town']).toBe('Kristiansand S')
    expect((await list(ola, 'Tang', '9173')).body!['town']).toBe('Ny-Ålesund')
  })

  test('5. the postcode wins over the town on the profile', async () => {
    // Kari lives in Bergen; the drill she is listing is at the cabin.
    expect((await list(kari, 'Hyttedrill', '7030')).body!['town']).toBe('Trondheim')
  })

  test('6. without a postcode the listing is where its owner is', async () => {
    expect((await list(kari, 'Skrutrekker')).body!['town']).toBe('Bergen')
    // Per said where he is with a postcode and nothing else.
    expect((await list(per, 'Sykkelsete')).body!['town']).toBe('Mo i Rana')
  })

  test('7. with neither, there is no town rather than a made-up one', async () => {
    expect((await list(ola, 'Vater')).body!['town']).toBeNull()
  })

  test('8. a postcode that belongs to no town is refused in words, and nothing is listed', async () => {
    const before = await listingCount(ola)

    const res = await list(ola, 'Borrekrone', '0000')

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('unknown_postal_code')
    expect(res.body!['message']).toBe('Fant ikke postnummer 0000. Sjekk det, eller la feltet stå tomt.')
    expect(await listingCount(ola)).toBe(before)
  })

  test('9. so is one that is not four digits', async () => {
    const res = await list(ola, 'Borrekrone', '703')

    expect(res.status).toBe(400)
    expect(res.body!['message']).toBe('Et postnummer har fire sifre.')
  })

  test('10. correcting a listing with a postcode moves it; correcting anything else leaves it', async () => {
    const moved = await call('PATCH', `/items/${drill}`, { token: ola, body: { postalCode: '5003' } })
    expect(moved.status).toBe(200)
    expect(moved.body!['town']).toBe('Bergen')

    const retitled = await call('PATCH', `/items/${drill}`, {
      token: ola, body: { title: 'Bosch drill 18V med koffert' },
    })
    expect(retitled.body!['town']).toBe('Bergen')
  })

  test('11. and a correction with a postcode that is no postcode changes nothing', async () => {
    const res = await call('PATCH', `/items/${drill}`, {
      token: ola, body: { title: 'Ny tittel', postalCode: '0000' },
    })
    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('unknown_postal_code')

    const page = await call('GET', `/items/${drill}`, { token: kari })
    expect(page.body!['town']).toBe('Bergen')
    expect(page.body!['title']).toBe('Bosch drill 18V med koffert')
  })
})
