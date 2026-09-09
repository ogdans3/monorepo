import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'

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
 * period in foreldelsesloven § 2. Once a claim can no longer be brought, the
 * purpose is spent and the purge job takes the row.
 */
export async function anonymiseUser(db: Database, userId: string) {
  await db.transaction(async (tx) => {
    // You cannot anonymise someone the counterparty is still waiting on, so the
    // live trades end first, with a reason the other side can read.
    const live = await tx.execute<Row>(sql`
      select distinct t.id from trades t
      join trade_participants p on p.trade_id = t.id
      where p.user_id = ${userId} and t.state in ('talking', 'pending', 'countered', 'accepted')
    `)
    for (const row of live) {
      const tradeId = row['id']!
      await tx.execute(
        sql`update items set active_trade_id = null, status = 'available'
            where active_trade_id = ${tradeId}`,
      )
      await tx.execute(
        sql`update trades set state = 'cancelled', closed_at = now(),
                   close_reason = 'Den andre parten slettet kontoen sin'
            where id = ${tradeId}`,
      )
    }

    await tx.execute(sql`
      insert into retained.identities
        (user_id, bankid_subject, email, phone, display_name, purge_after)
      select u.id, u.bankid_subject, u.email, u.phone, u.display_name,
             (coalesce(
                (select max(t.closed_at)::date from trades t
                 join trade_participants p on p.trade_id = t.id
                 where p.user_id = u.id and t.state = 'completed'),
                current_date
              ) + interval '3 years')::date
      from users u where u.id = ${userId}
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

    // Anything that is only ever about this person goes.
    await tx.execute(sql`delete from devices where user_id = ${userId}`)
    await tx.execute(sql`delete from sessions where user_id = ${userId}`)
    await tx.execute(sql`delete from notifications where user_id = ${userId}`)
    await tx.execute(sql`delete from likes where from_user = ${userId}`)
    await tx.execute(sql`delete from item_media where item_id in
      (select id from items where owner_id = ${userId})`)
    await tx.execute(
      sql`update items set status = 'withdrawn', deleted_at = now(), description = null
          where owner_id = ${userId} and status <> 'traded'`,
    )

    // The tombstone. The row lives so the counterparty's trade history still
    // has someone on the other side of it; nothing personal is left in it.
    await tx.execute(sql`
      update users set
        device_id = null, display_name = null, email = null, phone = null,
        town = null, county = null, interests = '{}',
        bankid_subject = null, anonymised_at = now()
      where id = ${userId}
    `)
  })
}
