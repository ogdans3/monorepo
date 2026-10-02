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
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { issueSession } from '../../src/auth/sessions.js'
import { close, db, makeItem, reset } from '../helpers.js'

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

  test('4b. a slip in a short word finds it too, when nothing matches better', async () => {
    // pg_trgm's own threshold is 0.6, and one letter wrong in a short word
    // scores under it: «drll» and «boch» against «Bosch drill 18V» are 0.4,
    // «sykel» against «Sykkelhjelm» 0.5. With nothing found at all, the
    // title is asked again at 0.4 rather than answering «Ingen treff».
    expect(titles(await call('GET', '/discover?q=drll', { token: kari }))).toEqual([
      'Bosch drill 18V',
    ])
    expect(titles(await call('GET', '/discover?q=boch', { token: kari }))).toEqual([
      'Bosch drill 18V',
    ])
    expect(titles(await call('GET', '/discover?q=sykel', { token: ola }))).toEqual([
      'Sykkelhjelm',
    ])
    // The count is the looser answer's too, or the page would say «0 treff»
    // over what it shows.
    expect((await call('GET', '/discover?q=drll', { token: kari })).body!['total']).toBe(1)
  })

  test('4c. but it is the same search otherwise, and your own drill is still not in it', async () => {
    expect(titles(await call('GET', '/discover?q=drll', { token: ola }))).toEqual([])
    // And a search that finds something is not padded out with near misses.
    expect(titles(await call('GET', '/discover?q=sykkel', { token: ola }))).toEqual([
      'Sykkelhjelm',
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

  test('14. paging through Oppdag shows every listing once, in every order', async () => {
    // Listings that tie on everything a sort looks at — the same moment, the
    // same value, the same town — are where a page used to repeat one listing
    // and never show another. A seed or a script writes many in one moment.
    const per = (await register('Per H.', 'per@epost.no')).token
    const toys: string[] = []
    for (let n = 1; n <= 8; n++) {
      const res = await call('POST', '/items', {
        token: per,
        body: { title: `Leke ${n}`, category: 'barn', condition: 'good', estimatedValueNok: 100 },
      })
      toys.push(res.body!['id'])
    }
    await db.execute(sql`update items set created_at = '2026-10-01T12:00:00Z' where category = 'barn'`)

    for (const sort of ['newest', 'nearest', 'value']) {
      const seen: string[] = []
      for (let offset = 0; offset < toys.length; offset++) {
        const page = await call('GET', `/discover?category=barn&sort=${sort}&limit=3&offset=${offset}`, {
          token: ola,
        })
        seen.push(page.body!['items'][0]['id'])
      }
      expect(seen.sort(), sort).toEqual([...toys].sort())
    }
  })

  test('15. the looser search hides what the search hides: a block, a kind, a test account', async () => {
    // Per's kayak is found by «kjakk» (0.5), and only by the looser search.
    const per = await call('POST', '/auth/login', {
      body: { email: 'per@epost.no', password: 'byttehandel1' },
    })
    const perToken = per.body!['token']
    const kayak = (await call('POST', '/items', {
      token: perToken,
      body: { title: 'Kajakk', category: 'bat', condition: 'good', estimatedValueNok: 3000 },
    })).body!['id']
    expect(titles(await call('GET', '/discover?q=kjakk', { token: ola }))).toEqual(['Kajakk'])

    // Ola asks not to be shown it, and then to be shown everything again.
    await call('POST', '/me/hidden', { token: ola, body: { itemId: kayak } })
    expect(titles(await call('GET', '/discover?q=kjakk', { token: ola }))).toEqual([])
    await call('DELETE', '/me/hidden', { token: ola })

    // Per blocks Ola, and then lets him back.
    const olaId = (await call('GET', '/me', { token: ola })).body!['id']
    await call('POST', `/blocks/${olaId}`, { token: perToken })
    expect(titles(await call('GET', '/discover?q=kjakk', { token: ola }))).toEqual([])
    await call('DELETE', `/blocks/${olaId}`, { token: perToken })
    expect(titles(await call('GET', '/discover?q=kjakk', { token: ola }))).toEqual(['Kajakk'])

    // A lamp of a test account's: «lmpe» (0.4) finds it for its admin, and
    // for nobody outside the ring.
    const [admin] = await db.execute<{ id: string }>(
      sql`insert into users (display_name, email) values ('Gabriel', 'gabriel@epost.no') returning id`,
    )
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local swaply.admin_grant = 'on'`)
      await tx.execute(sql`update users set is_admin = true where id = ${admin!.id}`)
    })
    const [tester] = await db.execute<{ id: string }>(
      sql`insert into users (display_name, email, test_account_of)
          values ('Tor Test', 'tor@swaply.test', ${admin!.id}) returning id`,
    )
    await makeItem(tester!.id, 'Lampe')
    const gabriel = await issueSession(db, admin!.id)
    expect(titles(await call('GET', '/discover?q=lmpe', { token: gabriel }))).toEqual(['Lampe'])
    expect(titles(await call('GET', '/discover?q=lmpe', { token: ola }))).toEqual([])
  })

  test('16. 05b offers each kind once, and only of what Oppdag would show', async () => {
    // Offered a kind that only your own things, a reserved one or a blocked
    // person's carry, the search found nothing and said «Vis 0 treff».
    const offered = async (token: string, category: string) =>
      (await call('GET', `/discover/subcategories?category=${category}`, { token })).body![
        'subcategories'
      ] as string[]
    const per = (await call('POST', '/auth/login', {
      body: { email: 'per@epost.no', password: 'byttehandel1' },
    })).body!['token']
    const list = async (token: string, title: string, subcategory: string) =>
      (await call('POST', '/items', {
        token,
        body: { title, category: 'musikk', subcategory, condition: 'good' },
      })).body!['id'] as string

    // One kind, typed two ways by two people.
    await list(kari, 'Gitar', 'Gitarer')
    await list(per, 'El-gitar', 'gitarer')
    await list(per, 'Fiolin', 'Strykere')
    // Ola's own, a traded piano, drums taken down, and a flute whose
    // subcategory an edit once emptied to ''.
    await list(ola, 'Munnspill', 'Munnspill')
    const piano = await list(kari, 'Piano', 'Tangenter')
    await db.execute(sql`update items set status = 'traded' where id = ${piano}`)
    const drums = await list(per, 'Trommer', 'Slagverk')
    await call('DELETE', `/items/${drums}`, { token: per })
    const flute = await list(kari, 'Fløyte', 'Blåsere')
    await db.execute(sql`update items set subcategory = '' where id = ${flute}`)
    // And a synth of the test account's from step 15.
    await db.execute(
      sql`insert into items (owner_id, kind, title, category, subcategory, condition)
          select id, 'item', 'Synth', 'musikk', 'Synther', 'good' from users
          where email = 'tor@swaply.test'`,
    )

    expect(await offered(ola, 'musikk')).toEqual(['Gitarer', 'Strykere'])
    // The bike a trade holds since step 8 was the last «Sykler», and the
    // helmet taken down in step 9 the last «Utstyr».
    expect(await offered(ola, 'sykling')).toEqual([])

    // The test account's kind is its admin's to be offered, and nobody else's.
    const [admin] = await db.execute<{ id: string }>(
      sql`select id from users where email = 'gabriel@epost.no'`,
    )
    expect(await offered(await issueSession(db, admin!.id), 'musikk')).toEqual([
      'Gitarer', 'Munnspill', 'Strykere', 'Synther',
    ])

    // Picking it finds every spelling of it.
    expect(
      titles(await call('GET', '/discover?category=musikk&subcategory=GITARER', { token: ola })),
    ).toEqual(['El-gitar', 'Gitar'])

    // Per blocks Ola, and his violin's kind goes from Ola's list with it.
    const olaId = (await call('GET', '/me', { token: ola })).body!['id']
    await call('POST', `/blocks/${olaId}`, { token: per })
    expect(await offered(ola, 'musikk')).toEqual(['Gitarer'])
    await call('DELETE', `/blocks/${olaId}`, { token: per })
  })
})
