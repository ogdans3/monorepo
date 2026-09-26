// FLOW — Asking somebody who only wants to put something out (10a)
//
// The rule this exists to pin down: **while a person has listed nothing, the
// heart that brings their likes to five offers 10a, and after that every
// tenth — fifteen, twenty-five, thirty-five.** Wishes with nothing to give are
// a dead end, because a loop needs something going the other way, so the first
// nudge comes early. Somebody who said «Senere» meant it, so after that the
// nudge is quieter. Anybody who has listed one thing is never asked.
//
// The export's title is «10a Prompt etter 10 likes». The product owner moved it
// to five and then every ten on 26.09.2026, and the screen keeps the live
// count, so it reads «Du har likt 5 ting».
//
// And the half that keeps it honest: **only a heart that made a like is
// news.** Pressed on something already liked — a stale card, a double tap — it
// changes nothing, so it neither asks, nor tells the owner a second time, nor
// runs the loop search again. That last one is not tidiness: a pending trade
// reserves nothing, so the search finds the same ring it found the first time
// and would open it twice.
//
// Which makes the count the thing to get right. Two hearts pressed at once
// are counted one after the other, or both land on six and the fifth is
// nobody's. And a heart that made a like stays news when the loop search
// behind it fails: the owner is told with the like, not after the search, and
// the search is left to the sweep rather than turning the heart back — a
// second press would be a repeat, and the prompt it was owed would be gone.
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { FastifyInstance } from 'fastify'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { schema } from '../../src/db/index.js'
import { env } from '../../src/env.js'
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

async function register(name: string, email: string) {
  const res = await call('POST', '/auth/register', {
    body: { displayName: name, email, password: 'byttehandel1', town: 'Trondheim' },
  })
  return { token: res.body!['token'] as string, id: res.body!['user']['id'] as string }
}

async function list(token: string, title: string) {
  const res = await call('POST', '/items', {
    token,
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 500 },
  })
  return res.body!['id'] as string
}

const heart = (token: string, item: string) => call('POST', `/items/${item}/like`, { token })

/** How many times `owner` has been told that `by` liked `item`. */
async function told(ownerToken: string, item: string, by: string) {
  const res = await call('GET', '/notifications', { token: ownerToken })
  return (res.body!['notifications'] as Json[]).filter(
    (n) =>
      n['type'] === 'item_liked' && n['payload']['itemId'] === item && n['payload']['byUserId'] === by,
  ).length
}

describe('asking somebody who only wants to put something out', () => {
  let kari = '', ola = '', olaId = '', per = '', lise = ''
  let stranger = '', strangerId = ''
  let tent = '', bike = '', lamp = ''
  // Kari's shelf: enough for the stranger to reach twenty-six hearts.
  const shelf: string[] = []

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    ;({ token: kari } = await register('Kari N.', 'kari@epost.no'))
    ;({ token: ola, id: olaId } = await register('Ola N.', 'ola@epost.no'))
    ;({ token: per } = await register('Per H.', 'per@epost.no'))
    ;({ token: lise } = await register('Lise M.', 'lise@epost.no'))

    for (let i = 1; i <= 30; i++) shelf.push(await list(kari, `Ting nummer ${i}`))
    tent = await list(ola, 'Telt, 3 personer')
    bike = await list(per, 'Sykkel')
    lamp = await list(lise, 'Lampe')

    // The person 10a is for: a phone that started looking around without an
    // account, and has nothing to give.
    const phone = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-listing-prompt-0123456789' },
    })
    stranger = phone.body!['token']
    strangerId = phone.body!['user']['id']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. the first four hearts say nothing, and each one tells the owner', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await heart(stranger, shelf[i]!)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ liked: true, promptToList: false, likedCount: i + 1 })
      expect(await told(kari, shelf[i]!, strangerId)).toBe(1)
    }
  })

  test('2. the fifth offers 10a', async () => {
    const res = await heart(stranger, shelf[4]!)

    expect(res.body).toMatchObject({ promptToList: true, likedCount: 5 })
  })

  test('3. pressed again on something already liked, the heart is not a like', async () => {
    // Still at five, which is a count that asks — and it does not ask, because
    // nothing happened. The owner hears about it once.
    const res = await heart(stranger, shelf[4]!)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ liked: true, tradeId: null, promptToList: false, likedCount: 5 })
    expect(await told(kari, shelf[4]!, strangerId)).toBe(1)
  })

  test('4. taking a heart back and giving it again is a like, and five asks again', async () => {
    // The server keeps no memory of having asked; it only knows the count. The
    // app remembers, per account, the highest count it has shown 10a at, and
    // stays quiet here — so this is not somebody being asked twice.
    expect((await call('DELETE', `/items/${shelf[4]}/like`, { token: stranger })).status).toBe(204)

    const res = await heart(stranger, shelf[4]!)

    expect(res.body).toMatchObject({ promptToList: true, likedCount: 5 })
  })

  test('5. six through fourteen say nothing: somebody who said «Senere» is left alone', async () => {
    for (let i = 5; i < 14; i++) {
      const res = await heart(stranger, shelf[i]!)
      expect(res.body, `heart ${i + 1}`).toMatchObject({ promptToList: false, likedCount: i + 1 })
    }
  })

  test('6. the fifteenth asks again', async () => {
    const res = await heart(stranger, shelf[14]!)

    expect(res.body).toMatchObject({ promptToList: true, likedCount: 15 })
  })

  test('7. and then every tenth: nothing until twenty-five', async () => {
    for (let i = 15; i < 24; i++) {
      const res = await heart(stranger, shelf[i]!)
      expect(res.body, `heart ${i + 1}`).toMatchObject({ promptToList: false, likedCount: i + 1 })
    }

    const res = await heart(stranger, shelf[24]!)
    expect(res.body).toMatchObject({ promptToList: true, likedCount: 25 })
  })

  test('8. a heart that is refused counts for nothing', async () => {
    // Blocked is refused as it always was, and the count it did not make is
    // not made: the next heart that lands is the twenty-sixth.
    expect((await call('POST', `/blocks/${strangerId}`, { token: lise })).status).toBe(204)

    const refused = await heart(stranger, lamp)
    expect(refused.status).toBe(403)
    expect(refused.body!['code']).toBe('blocked')

    const next = await heart(stranger, shelf[25]!)
    expect(next.body).toMatchObject({ promptToList: false, likedCount: 26 })
  })

  test('9. and a heart on your own listing is refused, as it always was', async () => {
    const own = await heart(per, bike)

    expect(own.status).toBe(400)
    expect(own.body!['code']).toBe('own_item')
  })

  test('10. anybody with one listing is never asked, at five or at fifteen', async () => {
    // Per has his bike out. The prompt is for a dead end, and he is not one.
    for (let i = 0; i < 15; i++) {
      const res = await heart(per, shelf[i]!)
      expect(res.body, `heart ${i + 1}`).toMatchObject({ promptToList: false, likedCount: i + 1 })
    }
  })

  test('11. a second press on a heart that closed a loop opens nothing more', async () => {
    // Kari wants Ola's tent; Ola's heart on her first thing closes the ring.
    await heart(kari, tent)
    const closing = await heart(ola, shelf[0]!)
    expect(closing.body!['tradeId']).not.toBeNull()

    const again = await heart(ola, shelf[0]!)

    expect(again.status).toBe(200)
    expect(again.body!['tradeId']).toBeNull()
    const trades = await call('GET', '/trades', { token: ola })
    expect(trades.body!['waiting'].map((t: Json) => t['id'])).toEqual([closing.body!['tradeId']])
    expect(await told(kari, shelf[0]!, olaId)).toBe(1)
  })

  test('12. two hearts pressed at the same moment are counted one after the other', async () => {
    // Two cards tapped in quick succession are two requests in flight at
    // once. Counted side by side, both said six — or, each blind to the
    // other's like, both said five — and the fifth was never one heart.
    //
    // The suite's own connection is one, which takes turns by itself, so
    // these two go through a server with room for both, as a deployed one
    // has. And a like here takes a moment to commit — the wait is deferred to
    // the end of its transaction — so that the two are certainly in flight
    // together rather than only usually.
    const phone = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-listing-prompt-both-at-once' },
    })
    const quick = phone.body!['token'] as string
    for (let i = 0; i < 4; i++) await heart(quick, shelf[i]!)

    await db.execute(sql.raw(`
      create function listing_prompt_slow_like() returns trigger language plpgsql
        as $$ begin perform pg_sleep(0.3); return new; end $$`))
    await db.execute(sql.raw(`
      create constraint trigger listing_prompt_slow_like after insert on likes
        deferrable initially deferred
        for each row execute function listing_prompt_slow_like()`))
    const client = postgres(env.DATABASE_URL!, { max: 4, onnotice: () => {} })
    const wide = await buildApp(drizzle(client, { schema }))
    let both: Json[]
    try {
      // Connections open, so neither heart starts late waiting for one.
      await Promise.all([client`select 1`, client`select 1`, client`select 1`, client`select 1`])
      both = await Promise.all(
        [shelf[4]!, shelf[5]!].map(async (item) =>
          (
            await wide.inject({
              method: 'POST',
              url: `/items/${item}/like`,
              headers: { authorization: `Bearer ${quick}` },
            })
          ).json() as Json,
        ),
      )
    } finally {
      await wide.close()
      await client.end()
      await db.execute(sql.raw('drop trigger listing_prompt_slow_like on likes'))
      await db.execute(sql.raw('drop function listing_prompt_slow_like()'))
    }

    const answers = both.sort((a, b) => a['likedCount'] - b['likedCount'])
    expect(answers.map((a) => a['likedCount'])).toEqual([5, 6])
    expect(answers.map((a) => a['promptToList'])).toEqual([true, false])
  })

  test('13. a heart whose loop search fails still lands, and the owner is still told', async () => {
    // Siri wants Nils's kayak; Nils's heart on her skis closes the ring, and
    // opening the trade is refused by the database this once.
    const nils = await register('Nils B.', 'nils@epost.no')
    const siri = await register('Siri T.', 'siri@epost.no')
    const kayak = await list(nils.token, 'Kajakk')
    const skis = await list(siri.token, 'Ski')
    await heart(siri.token, kayak)

    await db.execute(sql.raw(`
      create function listing_prompt_refuse_trade() returns trigger language plpgsql
        as $$ begin raise exception 'no trades just now'; end $$`))
    await db.execute(sql.raw(`
      create trigger listing_prompt_refuse_trade before insert on trades
        for each row execute function listing_prompt_refuse_trade()`))
    let res: Awaited<ReturnType<typeof heart>>
    try {
      res = await heart(nils.token, skis)
    } finally {
      await db.execute(sql.raw('drop trigger listing_prompt_refuse_trade on trades'))
      await db.execute(sql.raw('drop function listing_prompt_refuse_trade()'))
    }

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ liked: true, tradeId: null, likedCount: 1 })
    expect(await told(siri.token, skis, nils.id)).toBe(1)

    // The loop is the sweep's now, and it is still there to be found.
    const opened = await sweepForCycles(db)
    expect(opened).toHaveLength(1)
    const people = await db.execute<Json>(
      sql`select user_id::text as id from trade_participants where trade_id = ${opened[0]!}`,
    )
    expect(people.map((p) => p['id']).sort()).toEqual([nils.id, siri.id].sort())
  })
})
