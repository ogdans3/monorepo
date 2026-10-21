// FLOW — A sealed record goes when its claim window closes
//
// The rule this exists to pin down: **the sealed record in `retained` is kept
// exactly as long as a claim could still be brought, and not a day longer.**
// Erasure keeps a minimal identity to the last completed trade plus three
// years — or the deletion plus three years when there was none — because
// that is the limitation period in foreldelsesloven § 2. Once it has run, the
// purpose is spent, and a record kept past it is personal data kept for
// nothing. The daily job deletes it.
//
// `purge_after` is the last day a claim could be brought, so that day is
// still inside — and the days are Norwegian ones, not the database's UTC. And
// the purge is not a read: it compares a date and deletes, and nothing in the
// application ever selects from `retained` — the rule in `CLAUDE.md`, held
// here against the source.
//
// The photograph a completed trade kept of what was traded goes at the same
// horizon, and the words stay (`docs/ARCHITECTURE.md`): nothing used to let
// go of it, so an erased person's picture lived on at its address for ever.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { utimes } from 'node:fs/promises'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { sweepOrphanedMedia } from '../../src/lib/media-sweep.js'
import { mediaPath, storedExists } from '../../src/lib/media.js'
import { findCyclesThrough } from '../../src/trades/cycles.js'
import { anonymiseUser, dropSnapshotCovers, purgeRetained } from '../../src/trades/erasure.js'
import { acceptOffer, completeTrade, openTradeFromCycle } from '../../src/trades/trades.js'
import { close, currentOffer, db, like, makeItem, makeUser, reset } from '../helpers.js'
import { storedPhoto } from '../photo.js'

async function sealedFor(userId: string) {
  return db.execute(sql`select 1 from retained.identities where user_id = ${userId}`)
}

/** Move a record's last day, which is what three years of waiting would do. */
async function lastDay(userId: string, when: string) {
  await db.execute(
    sql`update retained.identities set purge_after = ${sql.raw(when)} where user_id = ${userId}`,
  )
}

afterAll(close)

describe('purging the sealed record', () => {
  let spent = '', today = '', open = ''

  beforeAll(async () => {
    await reset()
    spent = await makeUser('Ola', 'bankid-subject-ola')
    today = await makeUser('Kari', 'bankid-subject-kari')
    open = await makeUser('Per', 'bankid-subject-per')
    for (const id of [spent, today, open]) await anonymiseUser(db, id)
  })

  test('1. each erasure left a record, three years out', async () => {
    const [row] = await db.execute<Record<string, boolean>>(
      sql`select bool_and(purge_after = ((now() at time zone 'Europe/Oslo')::date
                                         + interval '3 years')::date) as all_three
          from retained.identities`,
    )
    expect(row!['all_three']).toBe(true)
    for (const id of [spent, today, open]) expect(await sealedFor(id), id).toHaveLength(1)
  })

  test('2. one whose last day has passed is deleted', async () => {
    await lastDay(spent, `(now() at time zone 'Europe/Oslo')::date - 1`)
    await lastDay(today, `(now() at time zone 'Europe/Oslo')::date`)

    expect(await purgeRetained(db)).toBe(1)
    expect(await sealedFor(spent)).toHaveLength(0)
  })

  test('3. the last day itself is still inside the window', async () => {
    expect(await sealedFor(today)).toHaveLength(1)
  })

  test('4. and one years from its end is left alone', async () => {
    expect(await sealedFor(open)).toHaveLength(1)
    // Nothing further to do, and the job says so.
    expect(await purgeRetained(db)).toBe(0)
  })

  test('5. nothing in the application reads from `retained`', () => {
    // It is written by the erasure engine and emptied by date, and neither is
    // a read: nothing comes back out of the schema. A `select … from
    // retained.` anywhere under src/ — or a join onto it — would be a service
    // reaching for the sealed record, which is a documented process and not
    // code.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name.endsWith('.ts')) files.push(path)
      }
    }
    walk(join(process.cwd(), 'src'))

    // In SQL, quoted or not; a delete that hands back what it deleted
    // (`returning`) is a read like any other. Through the query builder, the
    // tables are `retainedIdentities` and `retainedBlockedSubjects`, and the
    // schema that defines them is the only file that may name them — the
    // erasure writes in SQL, and nothing else touches them at all.
    const reads: string[] = []
    for (const path of files) {
      const source = readFileSync(path, 'utf8')
      const named = /(\w+)?\s*\b(from|join)\s+"?retained"?\s*\./gi
      for (const match of source.matchAll(named)) {
        const statement = source.slice(match.index, source.indexOf('`', match.index))
        if (match[1]?.toLowerCase() === 'delete' && !/\breturning\b/i.test(statement)) continue
        reads.push(`${path}: ${match[0].trim()}`)
      }
      if (path.endsWith(join('db', 'schema.ts'))) continue
      for (const match of source.matchAll(/\bretained(Identities|BlockedSubjects)\b/g)) {
        reads.push(`${path}: ${match[0]}`)
      }
    }
    expect(reads).toEqual([])
  })
})

/** Two people swap a thing with a photograph each, through the engine, and it completes. */
async function completedSwap(a: string, b: string) {
  const fromA = await makeItem(a, 'Sykkel', { photo: await storedPhoto() })
  const fromB = await makeItem(b, 'Kajakk', { photo: await storedPhoto() })
  await like(a, fromB)
  await like(b, fromA)
  const [ring] = await findCyclesThrough(db, b, fromA)
  const trade = await openTradeFromCycle(db, ring!)
  const offer = await currentOffer(trade)
  await acceptOffer(db, offer, a, '2026-09-06')
  await acceptOffer(db, offer, b, '2026-09-06')
  await completeTrade(db, trade)
  return trade
}

/** Move the day a trade finished, which is what years of waiting would do. */
async function finished(trade: string, when: string) {
  await db.execute(sql`update trades set closed_at = ${sql.raw(when)} where id = ${trade}`)
}

async function covers(trade: string) {
  return (
    await db.execute<Record<string, string | null>>(
      sql`select title, cover_url from trade_item_snapshots where trade_id = ${trade} order by title`,
    )
  ).map((row) => ({ title: row['title'], cover: row['cover_url'] }))
}

describe('the day, and the photograph', () => {
  let kari = '', ola = '', per = '', una = ''
  let old = '', recent = ''
  let perBike = '', unaKayak = ''

  beforeAll(async () => {
    await reset()
    kari = await makeUser('Kari', 'bankid-subject-kari')
    ola = await makeUser('Ola', 'bankid-subject-ola')
    per = await makeUser('Per')
    una = await makeUser('Una')
  })

  test('6. a trade finished at half past midnight in Norway is sealed by the Norwegian day', async () => {
    // 22.10.2026 00:30 in Oslo is 21.10 22:30 in the database's UTC. Sealed
    // by the UTC day, the record's last day was the 21st three years on, and
    // the purge took it on the 22nd — the day that is still inside.
    const trade = await completedSwap(kari, ola)
    await finished(trade, `'2026-10-21T22:30:00Z'`)
    await anonymiseUser(db, kari)

    const [row] = await db.execute<Record<string, string>>(
      sql`select purge_after::text as last from retained.identities where user_id = ${kari}`,
    )
    expect(row!['last']).toBe('2029-10-22')
  })

  test('7. a finished trade keeps its photographs while a claim over it can be brought', async () => {
    // Per gives his bike for Una's kayak, and later her bike for his kayak.
    // Then he deletes his account: his pictures go, except the bike's, which
    // the first trade's history still shows Una (`anonymiseUser`).
    old = await completedSwap(per, una)
    recent = await completedSwap(una, per)
    const [bike, kayak] = (await covers(old)).map((c) => c.cover!).reverse()
    perBike = bike!
    unaKayak = kayak!
    await anonymiseUser(db, per)
    expect(await storedExists(perBike)).toBe(true)

    // The first finished three years ago today, and today is its last day.
    await finished(old, `(((now() at time zone 'Europe/Oslo')::date - interval '3 years')::date
                          + time '12:00') at time zone 'Europe/Oslo'`)
    expect(await dropSnapshotCovers(db)).toBe(0)
    for (const trade of [old, recent]) {
      expect((await covers(trade)).every((c) => c.cover !== null), trade).toBe(true)
    }
  })

  test('8. the day after its last one, the photographs go and the words stay', async () => {
    await finished(old, `(((now() at time zone 'Europe/Oslo')::date - interval '3 years'
                           - interval '1 day')::date + time '12:00') at time zone 'Europe/Oslo'`)

    expect(await dropSnapshotCovers(db)).toBe(2)
    expect(await covers(old)).toEqual([
      { title: 'Kajakk', cover: null },
      { title: 'Sykkel', cover: null },
    ])
    expect((await covers(recent)).every((c) => c.cover !== null)).toBe(true)
  })

  test('9. and the media sweep takes the bytes nothing points at any more', async () => {
    // Older than the day of grace an upload gets, as three years would be.
    const longAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    for (const path of [perBike, unaKayak]) {
      await utimes(mediaPath(path.slice('/media/'.length))!, longAgo, longAgo)
    }
    await sweepOrphanedMedia(db)

    // Per's bike was kept for the history alone, and is gone with it.
    expect(await storedExists(perBike)).toBe(false)
    // Una's kayak is still on her own listing, which shows it.
    expect(await storedExists(unaKayak)).toBe(true)
  })
})
