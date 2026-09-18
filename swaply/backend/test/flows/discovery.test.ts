// FLOW — Looking for something on Oppdag
//
// The rule this exists to pin down: `docs/DESIGN.md` promises «free-text
// search, Postgres-native, no extra infra: tsvector over title/description/tags
// (GIN index) + pg_trgm for typo tolerance, with category/location/condition
// filters on top». Every clause of that sentence is a thing a person will try,
// and «terrengsykel» is what they type while they try it.
//
// The other half is what must never appear: your own things, things a trade is
// holding, things already traded, and things that have been taken down. The
// collage is the front page of the product and a thing you cannot have on it is
// worse than an empty one.
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

const titles = (res: { body: Json | null }) =>
  (res.body!['items'] as Json[]).map((i) => i['title']).sort()

describe('searching the collage', () => {
  let ola = '', kari = ''
  let kariId = ''
  let bike = '', helmet = '', drill = '', mowing = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    ola = (await register('Ola N.', 'ola@epost.no')).token
    const k = await register('Kari N.', 'kari@epost.no')
    kari = k.token
    kariId = k.id

    const add = async (token: string, body: Json) =>
      (await call('POST', '/items', { token, body })).body!['id'] as string

    bike = await add(kari, {
      title: 'Terrengsykkel 26"', description: 'God sykkel, brukt på turer i skogen',
      category: 'sykling', subcategory: 'Sykler', condition: 'good', estimatedValueNok: 2500,
    })
    helmet = await add(kari, {
      title: 'Sykkelhjelm', category: 'sykling', subcategory: 'Utstyr',
      condition: 'new', estimatedValueNok: 250,
    })
    mowing = await add(kari, {
      kind: 'service', title: 'Plenklipping', description: 'Jeg klipper plenen din',
      category: 'hjem', estimatedValueNok: 400,
    })
    drill = await add(ola, {
      title: 'Bosch drill 18V', category: 'verktoy', condition: 'worn', estimatedValueNok: 600,
    })
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a word finds the thing, and your own things are never among them', async () => {
    expect(titles(await call('GET', '/discover?q=sykkel', { token: ola }))).toEqual([
      'Sykkelhjelm',
      'Terrengsykkel 26"',
    ])
    expect(titles(await call('GET', '/discover?q=drill', { token: ola }))).toEqual([])
  })

  test('2. it reads the description too, not only the title', async () => {
    expect(titles(await call('GET', '/discover?q=plenen', { token: ola }))).toEqual([
      'Plenklipping',
    ])
  })

  test('3. and a Norwegian word is found by its stem', async () => {
    // «skog» for «skogen», «tur» for «turer»: the tsvector is built with the
    // Norwegian dictionary, not by matching letters.
    expect(titles(await call('GET', '/discover?q=skog', { token: ola }))).toEqual([
      'Terrengsykkel 26"',
    ])
    expect(titles(await call('GET', '/discover?q=tur', { token: ola }))).toEqual([
      'Terrengsykkel 26"',
    ])
  })

  test('4. and a misspelling of it still finds it', async () => {
    // What pg_trgm is in the schema for. It is trigrams over the title, so it
    // catches a word typed wrong — «terrengsykel» — rather than a different,
    // shorter word: no index makes «sykel» a way of asking for a
    // «terrengsykkel», and the stemmer does not split compounds either.
    expect(titles(await call('GET', '/discover?q=terrengsykel', { token: ola }))).toEqual([
      'Terrengsykkel 26"',
    ])
    expect(titles(await call('GET', '/discover?q=terengsykkel', { token: ola }))).toEqual([
      'Terrengsykkel 26"',
    ])
  })

  test('5. the filters stack: category, subcategory, condition, value', async () => {
    expect(titles(await call('GET', '/discover?category=sykling', { token: ola }))).toEqual([
      'Sykkelhjelm',
      'Terrengsykkel 26"',
    ])
    expect(
      titles(await call('GET', '/discover?category=sykling&subcategory=Utstyr', { token: ola })),
    ).toEqual(['Sykkelhjelm'])
    expect(titles(await call('GET', '/discover?condition=new', { token: ola }))).toEqual([
      'Sykkelhjelm',
    ])
    expect(titles(await call('GET', '/discover?minValue=1000', { token: ola }))).toEqual([
      'Terrengsykkel 26"',
    ])
    expect(titles(await call('GET', '/discover?maxValue=300', { token: ola }))).toEqual([
      'Sykkelhjelm',
    ])
  })

  test('6. the subcategories offered are the ones that exist', async () => {
    const res = await call('GET', '/discover/subcategories?category=sykling', { token: ola })

    expect(res.body!['subcategories']).toEqual(['Sykler', 'Utstyr'])
  })

  test('7. the count is the whole answer, not the page of it', async () => {
    const page = await call('GET', '/discover?limit=1', { token: ola })

    expect(page.body!['items']).toHaveLength(1)
    expect(page.body!['total']).toBe(3)
  })

  test('8. a listing a trade is holding leaves the collage', async () => {
    await call('POST', `/items/${bike}/like`, { token: ola })
    const trade = (await call('POST', `/items/${drill}/like`, { token: kari })).body!['tradeId']
    // Nothing is held until the owner says yes, so it is still there.
    expect(titles(await call('GET', '/discover?q=sykkel', { token: ola }))).toContain(
      'Terrengsykkel 26"',
    )

    await call('POST', `/trades/${trade}/accept`, { token: kari })

    expect(titles(await call('GET', '/discover?q=sykkel', { token: ola }))).toEqual([
      'Sykkelhjelm',
    ])
  })

  test('9. so does one that has been taken down', async () => {
    expect((await call('DELETE', `/items/${helmet}`, { token: kari })).status).toBe(204)

    expect(titles(await call('GET', '/discover?q=sykkel', { token: ola }))).toEqual([])
  })

  test('10. a service is a listing like any other, and has no condition', async () => {
    const service = await call('GET', `/items/${mowing}`, { token: ola })

    expect(service.body!['kind']).toBe('service')
    expect(service.body!['condition']).toBeNull()
    expect(titles(await call('GET', '/discover?category=hjem', { token: ola }))).toEqual([
      'Plenklipping',
    ])
  })

  test('11. an unclaimed device may look, and sees nothing of its own', async () => {
    const anon = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-looking-0123456789' },
    })
    const token = anon.body!['token']

    const seen = await call('GET', '/discover', { token })
    expect(seen.body!['items'].length).toBeGreaterThan(0)
    // No wishes yet, so nothing comes back marked as one.
    expect((seen.body!['items'] as Json[]).every((i) => i['likedByMe'] === false)).toBe(true)
  })

  test('12. what is not a real category is a bad request, not an empty page', async () => {
    const res = await call('GET', '/discover?category=fotball', { token: ola })

    expect(res.status).toBe(400)
  })

  test('13. and the person behind a listing is never a stranger to it', async () => {
    const res = await call('GET', `/items/${mowing}`, { token: ola })

    expect(res.body!['owner']).toMatchObject({ id: kariId, displayName: 'Kari N.' })
    expect(res.body!['owner']['email']).toBeUndefined()
  })
})
