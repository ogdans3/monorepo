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
// still inside. And the purge is not a read: it compares a date and deletes,
// and nothing in the application ever selects from `retained` — the rule in
// `CLAUDE.md`, held here against the source.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { anonymiseUser, purgeRetained } from '../../src/trades/erasure.js'
import { close, db, makeUser, reset } from '../helpers.js'

async function sealedFor(userId: string) {
  return db.execute(sql`select 1 from retained.identities where user_id = ${userId}`)
}

/** Move a record's last day, which is what three years of waiting would do. */
async function lastDay(userId: string, when: string) {
  await db.execute(
    sql`update retained.identities set purge_after = ${sql.raw(when)} where user_id = ${userId}`,
  )
}

describe('purging the sealed record', () => {
  let spent = '', today = '', open = ''

  beforeAll(async () => {
    await reset()
    spent = await makeUser('Ola', 'bankid-subject-ola')
    today = await makeUser('Kari', 'bankid-subject-kari')
    open = await makeUser('Per', 'bankid-subject-per')
    for (const id of [spent, today, open]) await anonymiseUser(db, id)
  })

  afterAll(close)

  test('1. each erasure left a record, three years out', async () => {
    const [row] = await db.execute<Record<string, boolean>>(
      sql`select bool_and(purge_after = (current_date + interval '3 years')::date) as all_three
          from retained.identities`,
    )
    expect(row!['all_three']).toBe(true)
    for (const id of [spent, today, open]) expect(await sealedFor(id), id).toHaveLength(1)
  })

  test('2. one whose last day has passed is deleted', async () => {
    await lastDay(spent, `current_date - 1`)
    await lastDay(today, `current_date`)

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
