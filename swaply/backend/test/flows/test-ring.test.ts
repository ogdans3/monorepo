// FLOW — A test account and a real person never meet
//
// The rule this exists to pin down: **a test account deals only with its own
// ring — the admin who made it and the admin's other test accounts — and the
// admin is a real person, free to deal with real people.** `docs/ADMIN.md`
// bound #2: once a test account and a real person are in one trade, the
// account can neither be reset nor deleted, because it is somebody's history.
//
// Hiding test listings on Oppdag was the only thing holding that. A heart, a
// first message and the cycle search all walked past it: the admin acting as
// Kari could heart a real tester's bike and the tester was told; a tester with
// a link could write to Kari; and a ring through the admin, Kari and a tester
// opened a real three-way trade. Now each is refused as `test_ring`, a ring
// that would hold a test account and anybody outside its ring is never found,
// liked-by does not show likes across the ring, and «Nullstill → gjenstander»
// leaves a listing a real person is negotiating about where it is.
//
// And the same of a listing as of an account: the «[test] …» things «Bygg et
// bytte» makes on the admin's OWN account are in the admin's ring, though
// the admin is a real person whose own things everybody sees. By owner alone
// they were on every real person's Oppdag and in 09a's «DU FÅR», and a real
// heart on one opened a real trade with the admin over a thing that exists
// to be spent by the tool. `items.made_by_scenario` marks them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { createInvite } from '../../src/lib/invites.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { close, db, reset, tradeState } from '../helpers.js'

let app: FastifyInstance

type Json = Record<string, any>
type Person = { token: string; id: string }

async function call(method: string, url: string, opts: { token?: string; body?: Json } = {}) {
  const res = await app.inject({
    method: method as 'GET',
    url,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    ...(opts.body ? { payload: opts.body } : {}),
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

async function register(name: string, email: string): Promise<Person> {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1' },
  })
  expect(res.status, name).toBe(201)
  return { token: res.body!['token'], id: res.body!['user']['id'] }
}

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

/** A test account made by [admin], and a session the switcher minted for it. */
async function testAccount(admin: Person, displayName: string): Promise<Person> {
  const made = await call('POST', '/admin/accounts', {
    token: admin.token, body: { displayName, withItems: 0 },
  })
  expect(made.status).toBe(201)
  const id = made.body!['id'] as string
  const session = await call('POST', `/admin/accounts/${id}/session`, { token: admin.token })
  return { token: session.body!['token'], id }
}

async function list(who: Person, title: string) {
  const res = await call('POST', '/items', {
    token: who.token, body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  expect(res.status, title).toBe(201)
  return res.body!['id'] as string
}

const refusal = { code: 'test_ring', message: 'Testkontoer kan bare bytte med hverandre og med eieren sin.' }
const testListing = { code: 'test_ring', message: 'Dette er en testannonse, og den er ikke til bytte.' }

async function tradesBetween(a: string, b: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from trades t
        where exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${a})
          and exists (select 1 from trade_participants p where p.trade_id = t.id and p.user_id = ${b})`,
  )
  return row!.n
}

describe('a test account and a real person', () => {
  let gabriel: Person, henrik: Person, tora: Person, tove: Person
  let kari: Person, per: Person, lise: Person
  let bike = '', lamp = '', scarf = '', drill = '', saw = '', helmet = ''
  let kayak = '', canoe = '', tent = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    gabriel = await register('Gabriel', 'gabriel@epost.no')
    await grantAdmin(gabriel.id)
    henrik = await register('Henrik', 'henrik@epost.no')
    await grantAdmin(henrik.id)
    tora = await register('Tora T.', 'tora@epost.no')
    tove = await register('Tove T.', 'tove@epost.no')

    kari = await testAccount(gabriel, 'Kari Test')
    per = await testAccount(gabriel, 'Per Test')
    lise = await testAccount(henrik, 'Lise Test')

    bike = await list(tora, 'Sykkel')
    lamp = await list(tora, 'Lampe')
    scarf = await list(tove, 'Skjerf')
    drill = await list(gabriel, 'Bosch drill 18V')
    saw = await list(gabriel, 'Stikksag')
    helmet = await list(gabriel, 'Sykkelhjelm')
    kayak = await list(kari, 'Kajakk')
    canoe = await list(kari, 'Kano')
    tent = await list(per, 'Telt')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Gabriel, acting as Kari, hearts a real tester’s bike: refused, and Tora is told nothing', async () => {
    const res = await call('POST', `/items/${bike}/like`, { token: kari.token })

    expect(res.status).toBe(403)
    expect(res.body).toEqual(refusal)
    const [like] = await db.execute(sql`select 1 from likes where from_user = ${kari.id}`)
    expect(like).toBeUndefined()
    const told = (await call('GET', '/notifications', { token: tora.token })).body!['notifications']
    expect(told).toEqual([])
  })

  test('2. nor can Tora, holding a link to Kari’s kayak, heart it', async () => {
    const res = await call('POST', `/items/${kayak}/like`, { token: tora.token })

    expect(res.status).toBe(403)
    expect(res.body).toEqual(refusal)
  })

  test('3. and a first message is refused in either direction, so no trade opens', async () => {
    const hers = await call('POST', `/items/${bike}/message`, {
      token: kari.token, body: { body: 'Hei! Er sykkelen ledig?' },
    })
    const theirs = await call('POST', `/items/${kayak}/message`, {
      token: tora.token, body: { body: 'Hei! Er kajakken ledig?' },
    })

    expect(hers.body).toEqual(refusal)
    expect(theirs.body).toEqual(refusal)
    expect(await tradesBetween(kari.id, tora.id)).toBe(0)
  })

  test('4. Gabriel himself is a real person, and deals with real people', async () => {
    expect((await call('POST', `/items/${bike}/like`, { token: gabriel.token })).status).toBe(200)

    const res = await call('POST', `/items/${lamp}/message`, {
      token: gabriel.token, body: { body: 'Er lampen ledig?' },
    })
    expect(res.status).toBe(201)
  })

  test('5. another admin’s ring is outside this one, and so is that admin', async () => {
    expect((await call('POST', `/items/${kayak}/like`, { token: lise.token })).body).toEqual(refusal)
    expect((await call('POST', `/items/${kayak}/like`, { token: henrik.token })).body).toEqual(refusal)
  })

  test('6. inside the ring everything still works: Kari and Per’s hearts open a trade', async () => {
    expect((await call('POST', `/items/${tent}/like`, { token: kari.token })).body!['tradeId']).toBeNull()

    const closing = await call('POST', `/items/${kayak}/like`, { token: per.token })

    expect(closing.body!['tradeId']).toBeTruthy()
    expect(await tradeState(closing.body!['tradeId'])).toBe('pending')
  })

  test('7. a ring through Gabriel, Kari and a real person never opens, though every wish is there', async () => {
    // Tove wants Gabriel's saw; Kari wants Tove's scarf, a wish from before
    // the heart refused one; Gabriel's heart on Kari's canoe would close it.
    expect((await call('POST', `/items/${saw}/like`, { token: tove.token })).body!['tradeId']).toBeNull()
    await db.execute(sql`insert into likes (from_user, target_item) values (${kari.id}, ${scarf})`)

    const closing = await call('POST', `/items/${canoe}/like`, { token: gabriel.token })

    expect(closing.status).toBe(200)
    expect(closing.body!['tradeId']).toBeNull()
    expect(await sweepForCycles(db)).toEqual([])
    expect(await tradesBetween(kari.id, tove.id)).toBe(0)
  })

  test('8. liked-by shows a like across the ring to nobody, and counts it nowhere', async () => {
    // From before the heart refused it, as in step 7.
    await db.execute(sql`insert into likes (from_user, target_item) values (${kari.id}, ${lamp})`)
    expect((await call('POST', `/items/${drill}/like`, { token: kari.token })).status).toBe(200)

    const toras = (await call('GET', '/me/liked-by', { token: tora.token })).body!['items'] as Json[]
    const ofLamp = toras.find((row) => row['item']['id'] === lamp)!
    expect(ofLamp['likers']).toEqual([])
    expect(ofLamp['item']['likeCount']).toBe(0)
    const ofBike = toras.find((row) => row['item']['id'] === bike)!
    expect(ofBike['likers'].map((u: Json) => u['displayName'])).toEqual(['Gabriel'])

    // Inside the ring a like is shown like any other.
    const gabriels = (await call('GET', '/me/liked-by', { token: gabriel.token })).body!['items'] as Json[]
    const ofDrill = gabriels.find((row) => row['item']['id'] === drill)!
    expect(ofDrill['likers'].map((u: Json) => u['displayName'])).toEqual(['Kari Test'])
  })

  test('9. «Nullstill → gjenstander» leaves what a real person is negotiating about, and says so', async () => {
    // Tora writes to Gabriel about his helmet; Kari writes about his drill.
    const toras = await call('POST', `/items/${helmet}/message`, {
      token: tora.token, body: { body: 'Er hjelmen ledig?' },
    })
    const karis = await call('POST', `/items/${drill}/message`, {
      token: kari.token, body: { body: 'Er drillen ledig?' },
    })

    const res = await call('POST', `/admin/accounts/${gabriel.id}/reset`, {
      token: gabriel.token, body: { parts: ['items'] },
    })

    expect(res.status).toBe(200)
    expect(res.body!['done']).toContain('1 gjenstand som Tora T. forhandler om ble ikke rørt')
    // Tora's negotiation stands, about a helmet that is still there.
    expect(await tradeState(toras.body!['tradeId'])).toBe('talking')
    expect((await call('GET', `/items/${helmet}`, { token: tora.token })).status).toBe(200)
    // Kari's, inside the ring, ended with the drill, as removing it ends one.
    const ended = (await call('GET', `/trades/${karis.body!['tradeId']}`, { token: kari.token })).body!
    expect(ended['closeCode']).toBe('listing_removed')
  })

  // What «Bygg et bytte» made: one «[test]» thing on Gabriel's own account
  // and one on Per's, and the trade between them. Per, because Gabriel's
  // heart on Kari's canoe (step 7) still stands, and with a scenario's hearts
  // it closes a pair of its own first.
  let scenarioTrade = '', mine = '', his = ''
  const ids = (res: { body: Json | null }) => (res.body!['items'] as Json[]).map((i) => i['id'])

  test('10. a scenario’s «[test]» thing on Gabriel’s own account is on nobody’s Oppdag outside his ring', async () => {
    const built = await call('POST', '/admin/scenarios', {
      token: gabriel.token, body: { state: 'pending', with: [per.id] },
    })
    expect(built.status, JSON.stringify(built.body)).toBe(200)
    scenarioTrade = built.body!['tradeId']
    const view = (await call('GET', `/trades/${scenarioTrade}`, { token: gabriel.token })).body!
    mine = view['youGive'][0]['id']
    his = view['youGet'][0]['id']
    const title = view['youGive'][0]['title'] as string
    expect(title.startsWith('[test] ')).toBe(true)
    const category = (await call('GET', `/items/${mine}`, { token: gabriel.token })).body!['category']

    // Tora, Henrik — another admin, whom anybody may meet — and a phone with
    // no account: not on the page, not found by its name, not in the rows.
    for (const [who, token] of [['Tora', tora.token], ['Henrik', henrik.token], ['nobody', undefined]] as const) {
      expect(ids(await call('GET', '/discover', { token })), who).not.toContain(mine)
      expect(ids(await call('GET', `/discover?q=${encodeURIComponent(title.slice(7))}`, { token })), who)
        .not.toContain(mine)
    }
    const rows = (await call('GET', '/discover/rows', { token: tora.token })).body!['rows'] as Json[]
    expect(rows.flatMap((r) => (r['items'] as Json[]).map((i) => i['id']))).not.toContain(mine)
    // Gabriel's own things are everybody's, as they always were.
    expect(ids(await call('GET', '/discover', { token: tora.token }))).toContain(helmet)

    // Inside the ring it is a listing like any other: Kari, who is not in the
    // trade, finds it on Oppdag and in its category's row.
    expect(ids(await call('GET', '/discover', { token: kari.token }))).toContain(mine)
    await call('PUT', '/me/interests', { token: kari.token, body: { interests: [category] } })
    const karis = (await call('GET', '/discover/rows', { token: kari.token })).body!['rows'] as Json[]
    expect(karis.flatMap((r) => (r['items'] as Json[]).map((i) => i['id']))).toContain(mine)
  })

  test('11. a link still opens it, as it opens a test account’s, and the heart and the first message say no', async () => {
    expect((await call('GET', `/items/${mine}`, { token: tora.token })).status).toBe(200)

    for (const who of [tora, henrik]) {
      expect((await call('POST', `/items/${mine}/like`, { token: who.token })).body).toEqual(testListing)
      const res = await call('POST', `/items/${mine}/message`, {
        token: who.token, body: { body: 'Hei! Er denne ledig?' },
      })
      expect(res.status).toBe(403)
      expect(res.body).toEqual(testListing)
    }
    const [like] = await db.execute(
      sql`select 1 from likes where target_item = ${mine} and from_user in (${tora.id}, ${henrik.id})`,
    )
    expect(like).toBeUndefined()
    const told = await db.execute(
      sql`select 1 from notifications where user_id = ${gabriel.id}
          and payload->>'itemId' = ${mine}
          and payload->>'byUserId' in (${tora.id}, ${henrik.id})`,
    )
    expect(told).toEqual([])
  })

  test('12. Gabriel’s profile shows Tora his things and not the tool’s, and counts what it shows', async () => {
    const toTora = (await call('GET', `/users/${gabriel.id}`, { token: tora.token })).body!
    expect(ids({ body: toTora })).toContain(helmet)
    expect(ids({ body: toTora })).not.toContain(mine)
    expect(toTora['itemCount']).toBe(toTora['items'].length)
    const page = (await call('GET', `/items/${helmet}`, { token: tora.token })).body!
    expect(page['owner']['itemCount']).toBe(toTora['items'].length)

    const toKari = (await call('GET', `/users/${gabriel.id}`, { token: kari.token })).body!
    expect(ids({ body: toKari })).toContain(mine)
    expect(toKari['itemCount']).toBe(toTora['itemCount'] + 1)
  })

  test('13. it cannot be shared, and a link shared before that shows nothing of it', async () => {
    // The page behind a link is for somebody with no account, who is in no
    // ring — whoever shares it, Gabriel included.
    for (const who of [gabriel, kari, tora]) {
      const res = await call('POST', `/items/${mine}/share`, { token: who.token })
      expect(res.status).toBe(403)
      expect(res.body).toEqual({ code: 'test_ring', message: 'Dette er en testannonse, og den kan ikke deles.' })
    }

    const before = await createInvite(db, { inviterId: gabriel.id, itemId: mine })
    const page = (await call('GET', `/invites/${before.token}`)).body!
    expect(page['item']).toBeNull()
    expect(page['itemRetired']).toBe(true)
  })

  test('14. a ring through Gabriel and Tora over it never opens, though both wishes are there', async () => {
    // Tora's heart on it from before it was hidden; Gabriel already wants
    // her bike (step 4). Gabriel gives the «[test]» thing, Tora the bike.
    await db.execute(sql`insert into likes (from_user, target_item) values (${tora.id}, ${mine})`)
    const before = await tradesBetween(gabriel.id, tora.id)

    await sweepForCycles(db)
    expect(await tradesBetween(gabriel.id, tora.id)).toBe(before)
    // Nor when the heart is pressed anew.
    await call('DELETE', `/items/${bike}/like`, { token: gabriel.token })
    const again = await call('POST', `/items/${bike}/like`, { token: gabriel.token })
    expect(again.status).toBe(200)
    expect(again.body!['tradeId']).toBeNull()
    expect(await tradesBetween(gabriel.id, tora.id)).toBe(before)
  })

  test('15. Tora’s like on it from before is shown nowhere and counted nowhere', async () => {
    const gabriels = (await call('GET', '/me/liked-by', { token: gabriel.token })).body!['items'] as Json[]
    const ofMine = gabriels.find((row) => row['item']['id'] === mine)!
    expect(ofMine['likers'].map((u: Json) => u['id'])).not.toContain(tora.id)
    expect(ofMine['item']['likeCount']).toBe(ofMine['likers'].length)
    expect((await call('GET', `/items/${mine}`, { token: gabriel.token })).body!['likeCount'])
      .toBe(ofMine['likers'].length)

    // And not in Tora's own list of what she likes, which is a list of things
    // she is shown. Tove's scarf is.
    expect((await call('POST', `/items/${scarf}/like`, { token: tora.token })).status).toBe(200)
    const likes = (await call('GET', '/me/likes', { token: tora.token })).body!['items'] as Json[]
    expect(likes.map((i) => i['id'])).toEqual([scarf])
  })

  test('16. in a real trade with Gabriel, neither side is offered it, and a counter-offer naming it is refused', async () => {
    // Tora's conversation about the helmet, from step 9.
    const [row] = await db.execute<{ id: string }>(
      sql`select t.id from trades t join trade_offers o on o.trade_id = t.id
          join trade_offer_items oi on oi.offer_id = o.id
          where oi.item_id = ${helmet} and t.state = 'talking' limit 1`,
    )
    const trade = row!.id
    for (const who of [tora, gabriel]) {
      const picks = (await call('GET', `/trades/${trade}/candidates`, { token: who.token })).body!
      const offered = [...picks['yours'], ...picks['theirs']].map((i: Json) => i['id'])
      expect(offered, who === tora ? 'Tora' : 'Gabriel').toContain(helmet)
      expect(offered).not.toContain(mine)
    }

    const view = (await call('GET', `/trades/${trade}`, { token: tora.token })).body!
    const toras = view['you']['position']
    const his = view['receivingFrom']['position']
    for (const who of [tora, gabriel]) {
      const res = await call('POST', `/trades/${trade}/counter`, {
        token: who.token,
        body: { items: [{ itemId: helmet, giverPosition: his }, { itemId: mine, giverPosition: his },
                        { itemId: lamp, giverPosition: toras }] },
      })
      expect(res.status).toBe(403)
      expect(res.body).toEqual(testListing)
    }
    // Without it the same counter-offer is an ordinary one.
    const fine = await call('POST', `/trades/${trade}/counter`, {
      token: tora.token,
      body: { items: [{ itemId: helmet, giverPosition: his }, { itemId: lamp, giverPosition: toras }] },
    })
    expect(fine.status).toBe(200)
  })

  test('17. inside the ring it is offered as any listing is', async () => {
    // Per, in the scenario's own trade, is offered Gabriel's «[test]» thing
    // and his own, and a counter-offer that keeps them goes on the table.
    const picks = (await call('GET', `/trades/${scenarioTrade}/candidates`, { token: per.token })).body!
    expect(picks['theirs'].map((i: Json) => i['id'])).toContain(mine)
    expect(picks['yours'].map((i: Json) => i['id'])).toContain(his)

    const view = (await call('GET', `/trades/${scenarioTrade}`, { token: per.token })).body!
    const res = await call('POST', `/trades/${scenarioTrade}/counter`, {
      token: per.token,
      body: { items: [{ itemId: mine, giverPosition: view['receivingFrom']['position'] },
                      { itemId: his, giverPosition: view['you']['position'] },
                      { itemId: tent, giverPosition: view['you']['position'] }] },
    })
    expect(res.status).toBe(200)
  })

  test('18. the ones scenarios made before the column existed are found by the migration, and nothing else is', async () => {
    // As `somethingToGive` wrote them before 0016, a moment after the press
    // `admin_actions` logs: one on Gabriel's own account, one on Per's.
    const [action] = await db.execute<{ at: string }>(
      sql`insert into admin_actions (admin_id, method, path, created_at)
          values (${gabriel.id}, 'POST', '/admin/scenarios', now() - interval '2 hours')
          returning created_at::text as at`,
    )
    const old = async (owner: string, title: string, at: string) => {
      const [made] = await db.execute<{ id: string }>(
        sql`insert into items (owner_id, kind, title, category, condition, created_at)
            values (${owner}, 'item', ${title}, 'hjem', 'new', ${at}::timestamptz)
            returning id`,
      )
      return made!.id
    }
    const ago = action!.at
    const hisOld = await old(gabriel.id, '[test] Kaffekvern', ago)
    const persOld = await old(per.id, '[test] Skateboard', ago)
    // Gabriel's own «[test] Kaffekvern» an hour later, as an old app listed
    // it, with no key: not in the minute after any press.
    const later = await old(gabriel.id, '[test] Kaffekvern', `${ago}`)
    await db.execute(sql`update items set created_at = created_at + interval '1 hour' where id = ${later}`)
    // Listed with the app's key, a moment after a press: a person's own.
    const keyed = await old(gabriel.id, '[test] Ullgenser M', ago)
    await db.execute(sql`update items set idempotency_key = gen_random_uuid() where id = ${keyed}`)
    // The same words from a real person, and a title that is no catalogue's.
    const torasOwn = await old(tora.id, '[test] Kaffekvern', ago)
    const notOurs = await old(gabriel.id, '[test] Kaffekvern med kopp', ago)

    const file = readFileSync(join(process.cwd(), 'drizzle', '0016_scenario_listings.sql'), 'utf8')
    const backfill = file.split('--> statement-breakpoint').at(-1)!
    expect(backfill).toContain('UPDATE "items"')
    await db.execute(sql.raw(backfill))

    const marked = async (id: string) =>
      (await db.execute<{ m: boolean }>(sql`select made_by_scenario as m from items where id = ${id}`))[0]!.m
    expect(await marked(hisOld)).toBe(true)
    expect(await marked(persOld)).toBe(true)
    for (const id of [later, keyed, torasOwn, notOurs]) expect(await marked(id)).toBe(false)
    // What a scenario made since is marked when it is made.
    expect(await marked(mine)).toBe(true)
    expect(await marked(his)).toBe(true)
    // And the old one is now as hidden as a new one.
    expect(ids(await call('GET', '/discover', { token: tora.token }))).not.toContain(hisOld)
  })
})
