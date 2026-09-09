// FLOW — Deleting an account, in the two layers Article 17 actually allows
//
// Erasure is not "delete the rows". The person's profile goes at once, which is
// what they asked for. What survives is what a defrauded counterparty would
// need to bring a claim, in a schema the application never reads, until the
// claim window closes: the completed trade plus three years, which is the
// limitation period in foreldelsesloven § 2.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { anonymiseUser } from '../../src/trades/erasure.js'
import { acceptOffer, completeTrade, openTradeFromCycle, startTalking } from '../../src/trades/trades.js'
import { close, currentOffer, db, like, makeItem, makeUser, reset, tradeState } from '../helpers.js'

describe('deleting an account', () => {
  let ola: string, kari: string, per: string
  let drill: string, tent: string
  let done: string, live: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola', 'bankid-subject-ola')
    kari = await makeUser('Kari', 'bankid-subject-kari')
    per = await makeUser('Per', 'bankid-subject-per')
    drill = await makeItem(ola, 'Bosch drill 18V', { photo: 'https://img/drill.webp' })
    tent = await makeItem(kari, 'Telt')

    // One finished trade with Kari, which is her history as much as his.
    done = await openTradeFromCycle(db, [
      { userId: kari, givesItemId: tent },
      { userId: ola, givesItemId: drill },
    ])
    const offer = await currentOffer(done)
    await acceptOffer(db, offer, kari, 'terms-2026-09')
    await acceptOffer(db, offer, ola, 'terms-2026-09')
    await completeTrade(db, done)

    // One conversation still running with Per, who is waiting on him.
    const spare = await makeItem(ola, 'Stige')
    live = (await startTalking(db, per, spare, 'Er stigen ledig?')).tradeId

    // And an open report, which is what makes him worth recognising later.
    await db.execute(
      sql`insert into reports (reporter, target_user, reason) values (${per}, ${ola}, 'scam')`,
    )
    await db.execute(
      sql`insert into devices (user_id, platform, push_token) values (${ola}, 'ios', 'tok-ola')`,
    )
    await db.execute(
      sql`insert into notifications (user_id, type) values (${ola}, 'trade_accepted')`,
    )
    await like(ola, tent)
  })

  afterAll(close)

  test('1. the live conversation is ended first, with a reason for Per', async () => {
    await anonymiseUser(db, ola)

    expect(await tradeState(live)).toBe('cancelled')
    const [row] = await db.execute<Record<string, string | null>>(
      sql`select close_reason from trades where id = ${live}`,
    )
    expect(row!['close_reason']).toBe('Den andre parten slettet kontoen sin')
  })

  test('2. the profile is empty, and the row survives as a tombstone', async () => {
    const [row] = await db.execute<Record<string, string | null>>(
      sql`select display_name, email, phone, town, bankid_subject, anonymised_at, interests
          from users where id = ${ola}`,
    )
    expect(row!['display_name']).toBeNull()
    expect(row!['email']).toBeNull()
    expect(row!['bankid_subject']).toBeNull()
    expect(row!['anonymised_at']).not.toBeNull()
  })

  test('3. everything that was only ever about him is gone', async () => {
    for (const table of ['devices', 'notifications']) {
      const rows = await db.execute(sql`select 1 from ${sql.raw(table)} where user_id = ${ola}`)
      expect(rows).toHaveLength(0)
    }
    const likes = await db.execute(sql`select 1 from likes where from_user = ${ola}`)
    expect(likes).toHaveLength(0)

    const photos = await db.execute(
      sql`select 1 from item_media where item_id = ${drill}`,
    )
    expect(photos).toHaveLength(0)
  })

  test('4. the sealed record keeps just enough, and says when it expires', async () => {
    const [row] = await db.execute<Record<string, string | null>>(
      sql`select bankid_subject, email, purge_after, reason
          from retained.identities where user_id = ${ola}`,
    )
    expect(row!['bankid_subject']).toBe('bankid-subject-ola')
    expect(row!['reason']).toBe('legal_claims')

    // Three years past the day the trade closed, not three years from now.
    const [expected] = await db.execute<Record<string, string>>(
      sql`select (closed_at::date + interval '3 years')::date as d from trades where id = ${done}`,
    )
    expect(String(row!['purge_after'])).toBe(String(expected!['d']))
  })

  test('5. an open report leaves a hash that recognises him if he comes back', async () => {
    const [row] = await db.execute<Record<string, string>>(
      sql`select subject_hash, reason from retained.blocked_subjects`,
    )
    const [expected] = await db.execute<Record<string, string>>(
      sql`select encode(sha256(convert_to('bankid-subject-ola', 'UTF8')), 'hex') as h`,
    )
    expect(row!['subject_hash']).toBe(expected!['h'])
  })

  test('6. the report itself outlives him, or deletion is a free wash', async () => {
    const rows = await db.execute(sql`select 1 from reports where target_user = ${ola}`)
    expect(rows).toHaveLength(1)
  })

  test('7. Kari keeps her own history of the trade they made', async () => {
    const snapshots = await db.execute<Record<string, string | null>>(
      sql`select title from trade_item_snapshots where trade_id = ${done} order by giver_position`,
    )
    expect(snapshots.map((s) => s['title'])).toEqual(['Telt', 'Bosch drill 18V'])

    // And someone is still on the other side of it, even if nobody in particular.
    const [participants] = await db.execute<Record<string, string>>(
      sql`select count(*) as n from trade_participants where trade_id = ${done}`,
    )
    expect(Number(participants!['n'])).toBe(2)
  })

  test('8. his unsold listings are withdrawn, the traded one is left alone', async () => {
    const rows = await db.execute<Record<string, string>>(
      sql`select title, status from items where owner_id = ${ola} order by title`,
    )
    expect(rows.map((r) => [r['title'], r['status']])).toEqual([
      ['Bosch drill 18V', 'traded'],
      ['Stige', 'withdrawn'],
    ])
  })
})
