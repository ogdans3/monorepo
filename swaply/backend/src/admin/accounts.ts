import { randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { many, one, type Row } from '../lib/rows.js'
import { anonymiseUser } from '../trades/erasure.js'
import { cancelTrade } from '../trades/trades.js'
import { CATALOGUE, INTERESTS, PEOPLE } from './fixtures.js'

/**
 * The ring: yourself, and the accounts you made.
 *
 * Every admin write goes through here, which is what bounds the blast radius by
 * construction rather than by care. There is deliberately no endpoint that
 * enumerates the userbase and no way to reach an account you did not make —
 * `test_account_of` can only be set when a row is born (the trigger in
 * drizzle/0004_admin.sql), so the set cannot grow sideways.
 */
export async function ownedTestAccount(
  db: Database,
  adminId: string,
  targetId: string,
): Promise<Row> {
  const row = await one(
    db,
    sql`select * from users
        where id = ${targetId} and anonymised_at is null
          and (test_account_of = ${adminId} or id = ${adminId})`,
  )
  // 404, not 403: the tool says nothing about accounts that are not yours,
  // including whether they exist.
  if (!row) throw notFound('Fant ikke kontoen.')
  return row
}

/** Your test accounts, in the order you made them, with enough to tell them apart. */
export async function ring(db: Database, adminId: string) {
  return many(
    db,
    sql`select u.id, u.display_name, u.email, u.town, u.device_id,
               (u.email is not null) as claimed,
               u.bankid_verified_at is not null as bankid,
               (select count(*) from items i
                where i.owner_id = u.id and i.deleted_at is null) as item_count,
               (select count(*) from likes l where l.from_user = u.id) as like_count,
               (select count(*) from trade_participants p
                join trades t on t.id = p.trade_id
                where p.user_id = u.id
                  and t.state in ('talking','pending','countered','accepted','paused')) as open_trades
        from users u
        where u.test_account_of = ${adminId} and u.anonymised_at is null
        order by u.created_at`,
  )
}

export type NewAccount = {
  displayName?: string
  town?: string
  withItems?: number
  bankid?: boolean
  /** Born without a profile: a device that is looking around, for the 10c path. */
  claimed?: boolean
  interests?: string[]
}

/**
 * A test account, born claimed and born furnished.
 *
 * It has no password: `/auth/login` refuses a row without a hash, so nobody —
 * the admin included — can sign in as it with a credential. The only door is
 * the switcher, which is why the account cannot outlive the admin's key.
 *
 * `test_account_of` is set in the INSERT on purpose: the trigger allows that
 * and refuses every later adoption.
 */
export async function createTestAccount(
  db: Database,
  adminId: string,
  opts: NewAccount,
): Promise<Row> {
  const made = await many(db, sql`select count(*) as n from users where test_account_of = ${adminId}`)
  const n = Number(made[0]?.['n'] ?? 0)
  if (n >= 20) {
    throw conflict('too_many_test_accounts', 'Du har 20 testkontoer. Slett noen først.')
  }

  const person = PEOPLE[n % PEOPLE.length]!
  const displayName = (opts.displayName ?? '').trim() || `${person.name}`
  const town = (opts.town ?? '').trim() || person.town
  const claimed = opts.claimed ?? true
  // `.test` is reserved by RFC 2606 and can never be a real address, so a test
  // account can never collide with a person or receive anything.
  const tag = randomBytes(4).toString('hex')
  const email = claimed ? `testkonto-${tag}@swaply.test` : null
  const deviceId = claimed ? null : `testdevice-${randomBytes(12).toString('hex')}`
  const interests = (opts.interests ?? [...INTERESTS]).slice(0, 5)

  const user = await one(
    db,
    sql`insert into users (display_name, email, device_id, town, interests,
                           bankid_subject, bankid_verified_at, test_account_of)
        values (${claimed ? displayName : null}, ${email}, ${deviceId}, ${claimed ? town : null},
                ${sql.raw(`'{${interests.join(',')}}'::category[]`)},
                ${opts.bankid ? `test-${tag}` : null}, ${opts.bankid ? sql`now()` : null},
                ${adminId})
        returning *`,
  )

  // An unclaimed device may not list anything, so it is born with nothing —
  // which is the state screen 10c exists for.
  const wanted = claimed ? Math.max(0, Math.min(opts.withItems ?? 2, 5)) : 0
  for (let i = 0; i < wanted; i++) {
    const fixture = CATALOGUE[(n * 3 + i) % CATALOGUE.length]!
    await db.execute(
      sql`insert into items (owner_id, kind, title, description, category, subcategory,
                             condition, estimated_value_nok, town)
          values (${user!['id']}, ${fixture.kind ?? 'item'}, ${fixture.title},
                  ${fixture.description ?? null}, ${fixture.category}::category,
                  ${fixture.subcategory ?? null},
                  ${fixture.kind === 'service' ? null : (fixture.condition ?? 'good')},
                  ${fixture.valueNok ?? null}, ${town})`,
    )
  }

  return user!
}

export type ResetPart = 'likes' | 'items' | 'trades' | 'interests' | 'bankid' | 'notifications'

/**
 * Empty part of an account, so the screen in front of it can be seen again.
 *
 * Three of these are one-way doors in the product and that is the point of the
 * lever: `PUT /me/interests` takes three to five and the check constraint
 * allows none or three to five, so screen 02 is once per account; `POST
 * /me/bankid` sets a subject and nothing unsets it, so the prompt at the first
 * accept is once per account; and a listing, once it exists, cannot be unmade
 * back into an empty profile.
 */
export async function resetAccount(
  db: Database,
  userId: string,
  parts: ResetPart[],
): Promise<{ done: string[]; freed: string[] }> {
  const done: string[] = []
  const freed: string[] = []

  if (parts.includes('trades')) {
    const live = await many(
      db,
      sql`select distinct t.id from trades t
          join trade_participants p on p.trade_id = t.id
          where p.user_id = ${userId}
            and t.state in ('talking','pending','countered','accepted','paused')`,
    )
    for (const row of live) {
      // Through cancelTrade, so the counterparty gets a reason in words and the
      // listings are released rather than left locked to a dead trade.
      freed.push(...(await cancelTrade(db, row['id'], 'Byttet ble avsluttet fra testverktøyet')))
    }
    done.push(`${live.length} bytter avsluttet`)
  }

  if (parts.includes('items')) {
    const items = await many(
      db,
      sql`update items set deleted_at = now(), status = 'withdrawn'
          where owner_id = ${userId} and deleted_at is null and active_trade_id is null
          returning id`,
    )
    done.push(`${items.length} gjenstander trukket`)
  }

  if (parts.includes('likes')) {
    const likes = await many(db, sql`delete from likes where from_user = ${userId} returning id`)
    done.push(`${likes.length} likes fjernet`)
  }

  if (parts.includes('interests')) {
    await db.execute(sql`update users set interests = '{}'::category[] where id = ${userId}`)
    done.push('interesser tømt — skjerm 02 kommer igjen')
  }

  if (parts.includes('bankid')) {
    await db.execute(
      sql`update users set bankid_subject = null, bankid_verified_at = null where id = ${userId}`,
    )
    done.push('BankID nullstilt')
  }

  if (parts.includes('notifications')) {
    const rows = await many(
      db,
      sql`delete from notifications where user_id = ${userId} returning id`,
    )
    done.push(`${rows.length} varsler slettet`)
  }

  return { done, freed }
}

/**
 * Retire a test account, through the erasure engine the product already has.
 *
 * Which also frees the device id, and that is the only way to walk the
 * anonymous-claim path a second time on one machine.
 */
export async function deleteTestAccount(db: Database, adminId: string, targetId: string) {
  if (targetId === adminId) {
    throw badRequest('not_yourself', 'Verktøyet kan ikke slette kontoen som eier det.')
  }
  const target = await ownedTestAccount(db, adminId, targetId)

  // A completed trade with somebody who is not one of mine is another person's
  // history, and anonymising half of it is not the tool's business.
  const real = await one(
    db,
    sql`select 1 from trade_participants mine
        join trade_participants theirs on theirs.trade_id = mine.trade_id
        join trades t on t.id = mine.trade_id
        join users u on u.id = theirs.user_id
        where mine.user_id = ${targetId} and theirs.user_id <> ${targetId}
          and t.state = 'completed'
          and (u.test_account_of is distinct from ${adminId}) and u.id <> ${adminId}`,
  )
  if (real) {
    throw conflict(
      'real_history',
      'Kontoen har et gjennomført bytte med en ekte bruker. Det er deres historikk.',
    )
  }

  await anonymiseUser(db, targetId, { reason: 'test_account' })
  return { displayName: target['display_name'] }
}
