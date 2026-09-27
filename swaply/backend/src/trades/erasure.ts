import { sql, type SQL } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { removeStored } from '../lib/media.js'
import { many } from '../lib/rows.js'

type Row = Record<string, string | null>

/**
 * Delete an account, in the two layers Article 17 actually allows.
 *
 * The profile is emptied at once, which is what the person asked for. A minimal
 * identity survives in `retained`, which the application never reads, because
 * 17(3)(e) preserves what is needed to establish or defend a legal claim — the
 * case where someone has been defrauded and has to be found.
 *
 * Retention is the last completed trade plus three years: the general limitation
 * period in foreldelsesloven § 2. Somebody who never completed a trade is kept
 * three years from the deletion instead, because a trade that went wrong — one
 * side sent, the other deleted — is one that never completed, and that is the
 * claim this record exists for. Once a claim can no longer be brought, the
 * purpose is spent and `purgeRetained` takes the row.
 *
 * An account that never made a profile leaves no sealed record at all. It had
 * no name, no address, no number and no BankID — a profile is what holds
 * those — and it could not have been in a trade, so there is neither anything
 * a court could use nor a claim it could be used in. The row it used to get
 * was every column null, kept three years for nothing.
 *
 * `onlyIf` is a condition on the account's row (as `u`), checked under a lock
 * before anything is touched; when it no longer holds nothing is, and
 * `erased` says so. It is for a caller that chose the account a moment
 * earlier and must not act on a choice the account has since changed.
 */
export async function anonymiseUser(
  db: Database,
  userId: string,
  opts: { reason?: string; onlyIf?: SQL } = {},
): Promise<{ freed: string[]; erased: boolean }> {
  // Filled inside the transaction, spent after it: unlinking a file cannot be
  // rolled back, so it does not happen until the rows are certainly gone.
  let orphaned: string[] = []
  // The other side's listings that the ended trades were holding. Back on the
  // market, which is one of the three search triggers — the caller runs it,
  // after the commit, the way every other cancellation does.
  const freed: string[] = []

  const erased = await db.transaction(async (tx) => {
    if (opts.onlyIf) {
      // `of u`: the row that decides, and not what the condition reads beside
      // it. Held to the commit, so a request from the account that lands now
      // either wrote its activity first and is seen here, or comes after the
      // decision — its write skips a locked row (`resolveSession`) — and does
      // not undo it; its session is deleted under it below.
      const [still] = await tx.execute<Row>(
        sql`select 1 from users u where u.id = ${userId} and ${opts.onlyIf} for update of u`,
      )
      if (!still) return false
    }

    // You cannot anonymise someone the counterparty is still waiting on, so the
    // live trades end first, with a reason the other side can read. `paused`
    // is one of them: an accepted trade with a withdrawal question open.
    const live = await tx.execute<Row>(sql`
      select distinct t.id from trades t
      join trade_participants p on p.trade_id = t.id
      where p.user_id = ${userId}
        and t.state in ('talking', 'pending', 'countered', 'accepted', 'paused')
    `)
    for (const row of live) {
      const tradeId = row['id']!
      const released = await tx.execute<Row>(
        sql`update items set active_trade_id = null, status = 'available'
            where active_trade_id = ${tradeId}
            returning id, owner_id`,
      )
      for (const item of released) if (item['owner_id'] !== userId) freed.push(item['id']!)
      await tx.execute(
        sql`update trades set state = 'cancelled', closed_at = now(),
                   close_reason = 'Den andre parten slettet kontoen sin'
            where id = ${tradeId}`,
      )
      // A withdrawal question still waiting is moot: the trade it asked about
      // has ended under it. Closed as lapsed, because an answer given later
      // to a waiting row — a no puts the trade back to `accepted` — would
      // bring a cancelled trade back to life with a tombstone in it.
      await tx.execute(
        sql`update trade_withdrawals set state = 'expired', resolved_at = now()
            where trade_id = ${tradeId} and state = 'waiting'`,
      )
      // And the others are told, the way they are told a trade opened or
      // moved. The reason is on the trade, so the payload is the trade and a
      // code for why, never the words — they are the app's to write, and a
      // push must not carry them through Google or Apple. Nobody already
      // erased: a tombstone has no list to read it in.
      await tx.execute(sql`
        insert into notifications (user_id, type, payload)
        select p.user_id, 'trade_cancelled',
               jsonb_build_object('tradeId', ${tradeId}::text, 'reason', 'account_deleted')
        from trade_participants p join users u on u.id = p.user_id
        where p.trade_id = ${tradeId} and p.user_id <> ${userId} and u.anonymised_at is null
      `)
    }

    await tx.execute(sql`
      insert into retained.identities
        (user_id, bankid_subject, email, phone, display_name, reason, purge_after)
      select u.id, u.bankid_subject, u.email, u.phone, u.display_name,
             ${opts.reason ?? 'legal_claims'},
             (coalesce(
                (select max(t.closed_at)::date from trades t
                 join trade_participants p on p.trade_id = t.id
                 where p.user_id = u.id and t.state = 'completed'),
                current_date
              ) + interval '3 years')::date
      from users u
      where u.id = ${userId}
        -- Nothing to seal, no row: a device that never made a profile.
        and num_nonnulls(u.bankid_subject, u.email, u.phone, u.display_name) > 0
      on conflict (user_id) do nothing
    `)

    // A banned person who deletes and comes back is recognised by the hash
    // alone. We keep the ability to say no without keeping who they are.
    await tx.execute(sql`
      insert into retained.blocked_subjects (subject_hash, reason)
      select encode(sha256(convert_to(u.bankid_subject, 'UTF8')), 'hex'),
             'account_deleted_with_open_reports'
      from users u
      where u.id = ${userId} and u.bankid_subject is not null
        and exists (select 1 from reports r where r.target_user = u.id and r.handled_at is null)
      on conflict (subject_hash) do nothing
    `)

    // A photograph of somebody's living room is personal data, so the bytes go
    // too — except the one a completed trade snapshotted, which is the
    // counterparty's record of what they got and lives to the retention
    // horizon. `docs/ARCHITECTURE.md`: the image goes when the claim window
    // closes, and the text stays.
    const files = await tx.execute<Row>(sql`
      select distinct m.url from item_media m
      join items i on i.id = m.item_id
      where i.owner_id = ${userId} and m.url like '/media/%'
        and not exists (select 1 from trade_item_snapshots s where s.cover_url = m.url)
    `)
    orphaned = files.map((row) => row['url']!).filter(Boolean)

    // Anything that is only ever about this person goes.
    await tx.execute(sql`delete from devices where user_id = ${userId}`)
    await tx.execute(sql`delete from sessions where user_id = ${userId}`)
    await tx.execute(sql`delete from notifications where user_id = ${userId}`)
    await tx.execute(sql`delete from likes where from_user = ${userId}`)
    await tx.execute(sql`delete from hidden_listings where user_id = ${userId}`)
    await tx.execute(sql`delete from item_media where item_id in
      (select id from items where owner_id = ${userId})`)
    await tx.execute(
      sql`update items set status = 'withdrawn', deleted_at = now(), description = null
          where owner_id = ${userId} and status <> 'traded'`,
    )

    // The tombstone. The row lives so the counterparty's trade history still
    // has someone on the other side of it; nothing personal is left in it.
    // The password hash goes with the address it opened, and the postcode
    // with the town it was looked up for.
    await tx.execute(sql`
      update users set
        device_id = null, display_name = null, email = null, phone = null,
        town = null, county = null, postal_code = null, password_hash = null,
        interests = '{}', bankid_subject = null, anonymised_at = now()
      where id = ${userId}
    `)
    return true
  })

  for (const path of orphaned) await removeStored(path)
  return { freed, erased }
}

/**
 * How long a device nobody claimed is kept without being used. The product
 * owner's rule, and a strict one: twelve months with no request from its own
 * token, opening the app included, and it is gone.
 */
const DEVICE_IDLE = '12 months'

/**
 * A device account that has been left alone longer than `DEVICE_IDLE`.
 *
 * Unclaimed and still here, and never the test tooling's: a test account is
 * somebody's fixture, whatever its age, and the admin's key is taken away
 * outside the building. Idle by `last_active_at`, which only the account's own
 * requests write — and by its sessions too, as a second witness, so a value
 * that failed to move once is not the only thing standing between somebody
 * and the sweep. Both in the database's clock, with the calendar's months.
 *
 * The witness is the account's own sessions only, the ones it signed in for.
 * A session the switcher minted is the admin at the controls, which the mark
 * does not count either (`resolveSession`), so neither witness counts it.
 */
const idleDevice = sql`
  u.email is null and u.anonymised_at is null
  and u.test_account_of is null and not u.is_admin
  and u.last_active_at < now() - ${DEVICE_IDLE}::interval
  and not exists (select 1 from sessions s
                  where s.user_id = u.id and s.issued_by is null
                    and s.last_seen_at >= now() - ${DEVICE_IDLE}::interval)`

/**
 * Erase every device account nobody has used for twelve months.
 *
 * Through `anonymiseUser`, the way every other erasure goes, so each column
 * that points at the account meets the fate it meets for anybody: its likes,
 * what it hid and its interests go, and its device id goes with the rest — the
 * phone, if it ever comes back, is a stranger. Each account is looked at again
 * under a lock before it is touched, because it may have opened the app since
 * the list was made.
 *
 * A device is in no trade — writing, listing and accepting all need a profile
 * — so nothing goes back on the market and there is no search to run after it.
 *
 * `failed` is handed an account that could not be erased, and the rest go on;
 * without it the error is thrown, which is what a test wants.
 */
export async function eraseInactiveDevices(
  db: Database,
  opts: { failed?: (userId: string, err: unknown) => void } = {},
): Promise<number> {
  const idle = await many<{ id: string }>(
    db,
    sql`select u.id from users u where ${idleDevice} order by u.last_active_at`,
  )

  let erased = 0
  for (const { id } of idle) {
    try {
      const done = await anonymiseUser(db, id, { reason: 'inactive_device', onlyIf: idleDevice })
      if (done.erased) erased++
    } catch (err) {
      if (!opts.failed) throw err
      opts.failed(id, err)
    }
  }
  return erased
}

/**
 * Delete the sealed records whose claim window has closed.
 *
 * `purge_after` is the last day a claim could still be brought; once it has
 * passed, the purpose the record was kept for is spent, and keeping it anyway
 * is keeping personal data for nothing. The day itself still counts.
 *
 * This is the one statement outside the erasure above that names `retained`,
 * and it is not a read: it compares the date the row was sealed with, deletes,
 * and hands back a count. No content leaves the schema, and nothing the
 * application does depends on what was in it — which is the rule
 * (`CLAUDE.md`: the application must never read from `retained`).
 */
export async function purgeRetained(db: Database): Promise<number> {
  const result = await db.execute(
    sql`delete from retained.identities where purge_after < current_date`,
  )
  return result.count
}
