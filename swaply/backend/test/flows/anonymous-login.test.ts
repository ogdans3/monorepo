// FLOW — Signing in on a phone that has been looking around
//
// The rule this exists to pin down: **the stranger on a phone and the account
// its holder signs in to are one person, and what the stranger wished for is
// theirs.** The app starts without asking anybody to make an account, so a
// person who already has one arrives on a new phone as a stranger first. When
// they sign in, the phone's account is folded into theirs in one transaction:
// the wishes move, the blocks and the reports follow, the invitation they took
// names them, and the phone's account is gone.
//
// And the half that keeps it safe. It happens only after the password, only
// when the phone's account is one nobody has claimed, and never across the test
// tooling's ring in either direction. A wrong password, a session that belongs
// to somebody with a profile, or a switched one: each signs in exactly as it
// did before this existed, and moves nothing.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { FATE_OF_REFERENCES } from '../../src/auth/merge.js'
import { connect } from '../../src/db/index.js'
import { findInvite } from '../../src/lib/invites.js'
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
    body: { title, category: 'verktoy', condition: 'good', estimatedValueNok: 600 },
  })
  return res.body!['id'] as string
}

async function likedBy(token: string) {
  const res = await call('GET', '/me/likes', { token })
  return (res.body!['items'] as Json[]).map((i) => i['id'] as string).sort()
}

async function exists(userId: string) {
  const rows = await db.execute(sql`select 1 from users where id = ${userId}`)
  return rows.length === 1
}

const signIn = (email: string, token?: string, password = 'byttehandel1') =>
  call('POST', '/auth/login', { ...(token ? { token } : {}), body: { email, password } })

/** What `pnpm admin grant` does, and the only way past the trigger. */
async function grantAdmin(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    await tx.execute(sql`update users set is_admin = true where id = ${userId}`)
  })
}

describe('signing in on a phone that has been looking around', () => {
  let ola = '', olaId = ''
  let kari = '', kariId = ''
  let per = ''
  let nilsId = ''
  let lise = '', liseId = ''
  let tent = '', drill = '', kayak = '', bike = '', helmet = '', lamp = '', chair = ''
  let shared = ''

  const phone = 'device-new-phone-0123456789abcdef'
  let looking = '', lookingAgain = '', phoneId = ''

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)

    ;({ token: ola, id: olaId } = await register('Ola N.', 'ola@epost.no'))
    ;({ token: kari, id: kariId } = await register('Kari N.', 'kari@epost.no'))
    ;({ token: per } = await register('Per H.', 'per@epost.no'))
    const nils = await register('Nils B.', 'nils@epost.no')
    nilsId = nils.id
    ;({ token: lise, id: liseId } = await register('Lise M.', 'lise@epost.no'))

    tent = await list(ola, 'Telt, 3 personer')
    drill = await list(kari, 'Bosch drill 18V')
    kayak = await list(kari, 'Kajakk')
    bike = await list(per, 'Sykkel')
    helmet = await list(per, 'Sykkelhjelm')
    lamp = await list(nils.token, 'Lampe')
    chair = await list(lise, 'Stol')

    // Kari wants Ola's tent, and nothing of Kari's is wanted back yet, so no
    // loop is open. Ola, on her old phone, already wants Per's bike.
    await call('POST', `/items/${tent}/like`, { token: kari })
    await call('POST', `/items/${bike}/like`, { token: ola })

    // The link Kari sends, which is how the new phone gets in.
    shared = (await call('POST', `/items/${drill}/share`, { token: kari })).body!['token']
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. a phone that asks twice is the same stranger both times', async () => {
    const first = await call('POST', '/auth/anonymous', { body: { deviceId: phone, invite: shared } })
    expect(first.status).toBe(201)
    expect(first.body!['user']['anonymous']).toBe(true)
    looking = first.body!['token']
    phoneId = first.body!['user']['id']

    // A cold start with the token lost asks again; the device id is the
    // credential, and it opens the same account rather than a second one.
    const again = await call('POST', '/auth/anonymous', { body: { deviceId: phone } })
    expect(again.status).toBe(200)
    expect(again.body!['user']['id']).toBe(phoneId)
    lookingAgain = again.body!['token']
  })

  test('2. the stranger picks what it is into and wishes for six things', async () => {
    const picked = await call('PUT', '/me/interests', {
      token: looking, body: { interests: ['friluft', 'verktoy', 'sykling'] },
    })
    expect(picked.status).toBe(200)

    // The drill and the helmet are wishes Ola could have made herself. The
    // bike she already has; the tent is her own; the lamp and the chair are
    // about to be on the far side of a block.
    for (const item of [drill, helmet, bike, tent, lamp, chair]) {
      const like = await call('POST', `/items/${item}/like`, { token: looking })
      expect(like.status, item).toBe(200)
      expect(like.body!['tradeId'], item).toBeNull()
    }
  })

  test('3. it blocks Nils, is blocked and reported by Lise, reports things and rates the app', async () => {
    expect((await call('POST', `/blocks/${nilsId}`, { token: looking })).status).toBe(204)
    // And Ola, which is to say itself: the one block the merge has to drop,
    // because carried across it would be a block on herself.
    expect((await call('POST', `/blocks/${olaId}`, { token: looking })).status).toBe(204)
    // Lise saw a stranger want her chair on 12 and did not want it to.
    expect((await call('POST', `/blocks/${phoneId}`, { token: lise })).status).toBe(204)

    const report = await call('POST', '/reports', {
      token: looking, body: { targetItem: lamp, reason: 'spam' },
    })
    expect(report.status).toBe(201)
    expect((await call('POST', '/reports', {
      token: lise, body: { targetUser: phoneId, reason: 'spam' },
    })).status).toBe(201)
    // Two reports between the stranger and Ola, one each way. Folded
    // together they would be Ola reporting herself.
    expect((await call('POST', '/reports', {
      token: looking, body: { targetUser: olaId, reason: 'other' },
    })).status).toBe(201)
    expect((await call('POST', '/reports', {
      token: ola, body: { targetUser: phoneId, reason: 'other' },
    })).status).toBe(201)
    expect((await call('POST', '/feedback', { token: looking, body: { score: 4 } })).status)
      .toBe(201)

    // Nothing has closed: a wish from nobody in particular does not.
    expect(await db.execute(sql`select 1 from trades`)).toHaveLength(0)
  })

  test('4. a wrong password moves nothing and removes nothing', async () => {
    const res = await signIn('ola@epost.no', looking, 'feil passord')

    expect(res.status).toBe(401)
    expect(await exists(phoneId)).toBe(true)
    expect(await likedBy(looking)).toHaveLength(6)
    expect(await likedBy(ola)).toEqual([bike])
  })

  test('5. the right one folds the phone into Ola and says how many wishes came along', async () => {
    const res = await signIn('ola@epost.no', looking)

    expect(res.status).toBe(200)
    expect(res.body!['user']['id']).toBe(olaId)
    expect(res.body!['user']['anonymous']).toBe(false)
    // The drill and the helmet. The four left behind are not counted: the
    // number is what the app tells her was brought along.
    expect(res.body!['carried']).toEqual({ likes: 2 })
    // She had never been through 02, and has now, on this phone.
    expect(res.body!['user']['interests']).toEqual(['friluft', 'verktoy', 'sykling'])
    ola = res.body!['token']
  })

  test('6. what moved is what Ola could have wished for herself', async () => {
    // Not the tent, which is hers; the bike once, not twice; and nothing
    // across a block, from either side.
    expect(await likedBy(ola)).toEqual([bike, drill, helmet].sort())
  })

  test('7. the blocks came along, both ways, and none of them is on herself', async () => {
    const rows = await db.execute<Json>(sql`select blocker, blocked from blocks`)

    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        { blocker: olaId, blocked: nilsId },
        { blocker: liseId, blocked: olaId },
      ]),
    )
    // Lise's block holds against Ola now: her things are hidden from her.
    expect((await call('GET', `/items/${chair}`, { token: ola })).status).toBe(404)
  })

  test('8. the phone’s account is gone, and both of its tokens with it', async () => {
    expect(await exists(phoneId)).toBe(false)
    expect((await call('GET', '/me', { token: looking })).status).toBe(401)
    expect((await call('GET', '/me', { token: lookingAgain })).status).toBe(401)
  })

  test('9. the invitation the phone took now names Ola', async () => {
    const invite = await findInvite(db, shared)

    expect(invite!['used_by']).toBe(olaId)
    expect(invite!['used_at']).not.toBeNull()
  })

  test('10. the reports and the feedback are hers, and none of the reports is about herself', async () => {
    const reports = await db.execute<Json>(
      sql`select reporter, target_user, target_item from reports`,
    )
    expect(reports).toHaveLength(2)
    expect(reports).toEqual(
      expect.arrayContaining([
        { reporter: olaId, target_user: null, target_item: lamp },
        // Lise's is about Ola now, as a report outlives the account it named.
        { reporter: liseId, target_user: olaId, target_item: null },
      ]),
    )

    const feedback = await db.execute<Json>(sql`select user_id, score from app_feedback`)
    expect(feedback).toEqual([{ user_id: olaId, score: 4 }])
  })

  test('11. the drill closes the loop it would have closed had she pressed it herself', async () => {
    // Kari wanted the tent all along. A wish from the phone could not close
    // anything; the same wish from Ola, who has the tent to give, does.
    const trades = await db.execute<Json>(
      sql`select t.id, t.state,
                 array(select p.user_id::text from trade_participants p
                       where p.trade_id = t.id) as people,
                 array(select oi.item_id::text from trade_offer_items oi
                       join trade_offers o on o.id = oi.offer_id
                       where o.trade_id = t.id) as things
          from trades t`,
    )

    expect(trades).toHaveLength(1)
    expect(trades[0]!['state']).toBe('pending')
    expect([...trades[0]!['people']].sort()).toEqual([olaId, kariId].sort())
    expect([...trades[0]!['things']].sort()).toEqual([drill, tent].sort())

    // Kari is told about the trade. She was told about the heart when it was
    // pressed, and is not told a second time.
    const told = await db.execute<Json>(
      sql`select type from notifications where user_id = ${kariId} order by type`,
    )
    expect(told.map((n) => n['type'])).toEqual(['item_liked', 'trade_opened'])
  })

  test('12. the phone comes back as a stranger, with nothing of Ola’s', async () => {
    // The device id is not a way into Ola's account. The account it named is
    // gone, so the same id makes a new stranger rather than being refused as
    // claimed, or opening hers.
    const res = await call('POST', '/auth/anonymous', { body: { deviceId: phone } })

    expect(res.status).toBe(201)
    expect(res.body!['user']['id']).not.toBe(phoneId)
    expect(res.body!['user']['id']).not.toBe(olaId)
    expect(res.body!['user']['anonymous']).toBe(true)
    expect(await likedBy(res.body!['token'])).toEqual([])
  })

  test('13. interests come along only to an account that has none', async () => {
    await call('PUT', '/me/interests', {
      token: per, body: { interests: ['sykling', 'sport', 'musikk'] },
    })
    const other = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-per-second-phone-0123456789' },
    })
    await call('PUT', '/me/interests', {
      token: other.body!['token'], body: { interests: ['barn', 'hjem', 'bat'] },
    })

    const res = await signIn('per@epost.no', other.body!['token'])

    expect(res.status).toBe(200)
    // A merge ran and moved nothing, and the answer says so rather than
    // leaving the field out.
    expect(res.body!['carried']).toEqual({ likes: 0 })
    expect(res.body!['user']['interests']).toEqual(['sykling', 'sport', 'musikk'])
    expect(await exists(other.body!['user']['id'])).toBe(false)
  })

  test('14. with no session, or with somebody’s own, a sign-in is what it always was', async () => {
    const plain = await signIn('ola@epost.no')
    expect(plain.status).toBe(200)
    expect(plain.body!['carried']).toBeUndefined()

    // Kari's phone, signing in as Ola. Kari has a profile, so she is not a
    // stranger to be folded into anybody.
    const res = await signIn('ola@epost.no', kari)
    expect(res.status).toBe(200)
    expect(res.body!['carried']).toBeUndefined()
    expect(await exists(kariId)).toBe(true)
    expect(await likedBy(kari)).toEqual([tent])
    expect((await call('GET', '/me', { token: kari })).body!['id']).toBe(kariId)
  })

  describe('and the test tooling’s ring', () => {
    let gabriel = ''
    let testDeviceId = '', switched = ''

    beforeAll(async () => {
      const a = await register('Gabriel', 'gabriel@epost.no')
      gabriel = a.token
      await grantAdmin(a.id)

      const made = await call('POST', '/admin/accounts', {
        token: gabriel, body: { claimed: false, withItems: 0 },
      })
      testDeviceId = made.body!['id']
      switched = (await call('POST', `/admin/accounts/${testDeviceId}/session`, { token: gabriel }))
        .body!['token']
      await call('POST', `/items/${kayak}/like`, { token: switched })
    })

    test('15. a switched session carries nothing out of the ring', async () => {
      const res = await signIn('per@epost.no', switched)

      expect(res.status).toBe(200)
      expect(res.body!['carried']).toBeUndefined()
      expect(await exists(testDeviceId)).toBe(true)
      expect(await likedBy(switched)).toEqual([kayak])
    })

    test('16. nor does a test account reached by its device id, which is not switched', async () => {
      // The ring shows a test device its id, and `/auth/anonymous` hands out an
      // ordinary session for it. The switcher's mark is not on that session,
      // and this one has never been acted as, so nothing in `admin_actions`
      // points at it either: the account's own mark is what has to refuse.
      const made = await call('POST', '/admin/accounts', {
        token: gabriel, body: { claimed: false, withItems: 0 },
      })
      const id = made.body!['id'] as string
      const [row] = await db.execute<Json>(sql`select device_id from users where id = ${id}`)
      const ordinary = await call('POST', '/auth/anonymous', {
        body: { deviceId: row!['device_id'] },
      })
      expect(ordinary.body!['user']['id']).toBe(id)
      await call('POST', `/items/${kayak}/like`, { token: ordinary.body!['token'] })

      const res = await signIn('per@epost.no', ordinary.body!['token'])

      expect(res.status).toBe(200)
      expect(res.body!['carried']).toBeUndefined()
      expect(await exists(id)).toBe(true)
      expect(await likedBy(per)).toEqual([])
    })

    test('17. and nothing is carried into a test account that has been given a password', async () => {
      // Claiming through the switcher is how a test account comes to have
      // one, and after that it can be signed in to like anybody's.
      const made = await call('POST', '/admin/accounts', {
        token: gabriel, body: { claimed: false, withItems: 0 },
      })
      const acting = await call('POST', `/admin/accounts/${made.body!['id']}/session`, {
        token: gabriel,
      })
      const claimed = await call('POST', '/auth/register', {
        token: acting.body!['token'],
        body: { displayName: 'Testperson', email: 'testperson@swaply.test',
                password: 'byttehandel1' },
      })
      expect(claimed.status).toBe(201)

      const stranger = await call('POST', '/auth/anonymous', {
        body: { deviceId: 'device-somebody-else-0123456789' },
      })
      await call('POST', `/items/${helmet}/like`, { token: stranger.body!['token'] })

      const res = await signIn('testperson@swaply.test', stranger.body!['token'])

      expect(res.status).toBe(200)
      expect(res.body!['carried']).toBeUndefined()
      expect(await exists(stranger.body!['user']['id'])).toBe(true)
      expect(await likedBy(res.body!['token'])).toEqual([])
    })
  })

  test('18. a heart from her other phone in the same moment does not fail the sign-in', async () => {
    // Ola's old phone likes the kayak while the new one, which liked it too,
    // is being folded in. Checking first could not see a heart nobody had
    // committed yet, and the sign-in came back as a server error.
    const stranger = await call('POST', '/auth/anonymous', {
      body: { deviceId: 'device-racing-phone-0123456789' },
    })
    await call('POST', `/items/${kayak}/like`, { token: stranger.body!['token'] })

    const other = connect()
    try {
      let signing: ReturnType<typeof signIn> | undefined
      await other.db.transaction(async (tx) => {
        await tx.execute(sql`insert into likes (from_user, target_item) values (${olaId}, ${kayak})`)
        signing = signIn('ola@epost.no', stranger.body!['token'])
        // Held until the sign-in is waiting on this very heart.
        for (let tries = 0; ; tries++) {
          const [waiting] = await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from pg_stat_activity
                where datname = current_database() and wait_event_type = 'Lock'`,
          )
          if (waiting!.n > 0) break
          if (tries > 500) throw new Error('the sign-in never came to the kayak')
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      })
      const res = await signing!

      expect(res.status).toBe(200)
      expect(res.body!['carried']).toEqual({ likes: 0 })
      expect(await exists(stranger.body!['user']['id'])).toBe(false)
      expect(await likedBy(res.body!['token'])).toContain(kayak)
    } finally {
      await other.client.end()
    }
  })

  test('19. every column that points at a person has a decided fate', async () => {
    // The merge ends in a delete, and the delete fails on any reference nobody
    // moved. A table added later is caught here, in review, rather than on the
    // first sign-in that trips over it.
    const keys = await db.execute<{ ref: string; cascade: boolean }>(
      sql`select c.conrelid::regclass::text || '.' || a.attname as ref,
                 c.confdeltype = 'c' as cascade
          from pg_constraint c
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
          where c.contype = 'f' and c.confrelid = 'public.users'::regclass`,
    )

    expect(keys.map((k) => k.ref).sort()).toEqual(Object.keys(FATE_OF_REFERENCES).sort())

    // «Dropped» means the database drops it. A key that stopped cascading
    // would turn a merge into a failed sign-in.
    for (const key of keys) {
      const fate = FATE_OF_REFERENCES[key.ref as keyof typeof FATE_OF_REFERENCES]
      if (fate === 'dropped') expect(key.cascade, key.ref).toBe(true)
    }
  })
})
