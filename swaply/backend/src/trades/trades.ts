import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import type { Cycle } from './cycles.js'

type Row = Record<string, string | null>

/**
 * Turn a found cycle into a trade with its first offer on the table.
 *
 * Nothing is reserved here. A cycle is a suggestion until the owners say yes,
 * and reserving on a suggestion would freeze people's things on a maybe.
 */
export async function openTradeFromCycle(db: Database, cycle: Cycle): Promise<string> {
  return db.transaction(async (tx) => {
    const [trade] = await tx.execute<Row>(
      sql`insert into trades (state) values ('pending') returning id`,
    )
    const tradeId = trade!['id']!

    for (const [position, hop] of cycle.entries()) {
      await tx.execute(
        sql`insert into trade_participants (trade_id, user_id, position)
            values (${tradeId}, ${hop.userId}, ${position})`,
      )
    }

    // proposed_by stays null: the cycle search is not a person.
    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq) values (${tradeId}, 1) returning id`,
    )

    for (const [position, hop] of cycle.entries()) {
      await tx.execute(
        sql`insert into trade_offer_items (offer_id, item_id, giver_position)
            values (${offer!['id']!}, ${hop.givesItemId}, ${position})`,
      )
    }

    await tx.execute(sql`insert into threads (trade_id) values (${tradeId})`)
    await tx.execute(
      sql`insert into thread_participants (thread_id, user_id)
          select t.id, p.user_id from threads t
          join trade_participants p on p.trade_id = t.trade_id
          where t.trade_id = ${tradeId}`,
    )

    return tradeId
  })
}

/**
 * Open a trade by writing to someone about their listing.
 *
 * This is the only way a conversation starts, because every thread belongs to a
 * trade. The offer names their item and nothing back yet — the half-filled
 * offer behind the `Jeg vil ha` chip.
 */
export async function startTalking(
  db: Database,
  opener: string,
  aboutItem: string,
  body: string,
): Promise<{ tradeId: string; threadId: string }> {
  return db.transaction(async (tx) => {
    const [item] = await tx.execute<Row>(sql`select owner_id from items where id = ${aboutItem}`)
    const owner = item!['owner_id']!

    const [trade] = await tx.execute<Row>(sql`insert into trades default values returning id`)
    const tradeId = trade!['id']!

    // The opener is position 0 and receives; the owner gives. That is the shape
    // of "I want this", and a counter-offer can rearrange it later.
    await tx.execute(
      sql`insert into trade_participants (trade_id, user_id, position)
          values (${tradeId}, ${opener}, 0), (${tradeId}, ${owner}, 1)`,
    )

    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq, proposed_by)
          values (${tradeId}, 1, ${opener}) returning id`,
    )
    await tx.execute(
      sql`insert into trade_offer_items (offer_id, item_id, giver_position)
          values (${offer!['id']!}, ${aboutItem}, 1)`,
    )

    const [thread] = await tx.execute<Row>(
      sql`insert into threads (trade_id) values (${tradeId}) returning id`,
    )
    const threadId = thread!['id']!
    await tx.execute(
      sql`insert into thread_participants (thread_id, user_id)
          values (${threadId}, ${opener}), (${threadId}, ${owner})`,
    )
    await tx.execute(
      sql`insert into messages (thread_id, sender_id, body)
          values (${threadId}, ${opener}, ${body})`,
    )

    return { tradeId, threadId }
  })
}

/**
 * Put a new version of the deal on the table.
 *
 * Never an edit. Earlier acceptances stay attached to the version they were
 * given for, which is the only way to avoid having accepted something else.
 */
export async function proposeCounterOffer(
  db: Database,
  tradeId: string,
  proposedBy: string,
  items: { itemId: string; giverPosition: number }[],
  cash?: { payerPosition: number; payeePosition: number; amountNok: number },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq, proposed_by)
          select ${tradeId}, coalesce(max(seq), 0) + 1, ${proposedBy}
          from trade_offers where trade_id = ${tradeId}
          returning id`,
    )
    const offerId = offer!['id']!

    for (const item of items) {
      await tx.execute(
        sql`insert into trade_offer_items (offer_id, item_id, giver_position)
            values (${offerId}, ${item.itemId}, ${item.giverPosition})`,
      )
    }

    if (cash) {
      await tx.execute(
        sql`insert into trade_offer_cash (offer_id, payer_position, payee_position, amount_nok)
            values (${offerId}, ${cash.payerPosition}, ${cash.payeePosition}, ${cash.amountNok})`,
      )
    }

    await tx.execute(sql`update trades set state = 'countered' where id = ${tradeId}`)
    return offerId
  })
}

export type AcceptResult = {
  reserved: string[]
  /** Trades closed because this acceptance took a listing they were counting on. */
  displaced: string[]
  everyoneAccepted: boolean
}

/**
 * Accept a specific version of the deal, and reserve what you are giving.
 *
 * The lock is the point of this function. An owner's acceptance is what turns a
 * listing from available into spoken for, and two people accepting at the same
 * moment must not both walk away with the same drill.
 */
export async function acceptOffer(
  db: Database,
  offerId: string,
  userId: string,
  termsVersion: string,
): Promise<AcceptResult> {
  return db.transaction(async (tx) => {
    const [offer] = await tx.execute<Row>(
      sql`select trade_id from trade_offers where id = ${offerId}`,
    )
    const tradeId = offer!['trade_id']!

    // Sorted, so two concurrent acceptances queue instead of deadlocking.
    const mine = await tx.execute<Row>(sql`
      select i.id, i.active_trade_id, i.kind
      from trade_offer_items oi
      join items i on i.id = oi.item_id
      where oi.offer_id = ${offerId} and i.owner_id = ${userId}
      order by i.id
      for update of i
    `)

    for (const row of mine) {
      const held = row['active_trade_id']
      if (held && held !== tradeId) {
        throw new Error(`item ${row['id']} is already reserved by trade ${held}`)
      }
    }

    const reserved: string[] = []
    const displaced = new Set<string>()

    for (const row of mine) {
      // A service is never exclusive: one person can paint three living rooms.
      if (row['kind'] === 'service') continue

      const itemId = row['id']!
      await tx.execute(
        sql`update items set active_trade_id = ${tradeId}, status = 'reserved'
            where id = ${itemId}`,
      )
      reserved.push(itemId)

      // The loser gets a reason in words, never a silent disappearance.
      const closed = await tx.execute<Row>(sql`
        update trades set state = 'cancelled', closed_at = now(),
               close_reason = 'En gjenstand i byttet ble reservert av et annet bytte'
        where id <> ${tradeId}
          and state in ('talking', 'pending', 'countered')
          and exists (
            select 1 from trade_offers o
            join trade_offer_items oi on oi.offer_id = o.id
            where o.trade_id = trades.id and oi.item_id = ${itemId}
          )
        returning id
      `)
      for (const row of closed) displaced.add(row['id']!)
    }

    await tx.execute(
      sql`insert into trade_acceptances (offer_id, user_id, terms_version)
          values (${offerId}, ${userId}, ${termsVersion})
          on conflict (offer_id, user_id)
          do update set accepted_at = now(), revoked_at = null,
                        terms_version = excluded.terms_version`,
    )

    const [tally] = await tx.execute<Row>(sql`
      select count(*) filter (where a.user_id is not null) as accepted,
             count(*) as participants
      from trade_participants p
      left join trade_acceptances a
        on a.user_id = p.user_id and a.offer_id = ${offerId} and a.revoked_at is null
      where p.trade_id = ${tradeId}
    `)
    const everyoneAccepted = tally!['accepted'] === tally!['participants']

    if (everyoneAccepted) {
      await tx.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
    }

    return { reserved, displaced: [...displaced], everyoneAccepted }
  })
}

/** Undo your acceptance. The row stays: deleting it would hide that it happened. */
export async function revokeAcceptance(db: Database, offerId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`update trade_acceptances set revoked_at = now()
          where offer_id = ${offerId} and user_id = ${userId}`,
    )
    await tx.execute(sql`
      update trades set state = 'pending'
      where id = (select trade_id from trade_offers where id = ${offerId})
        and state = 'accepted'
    `)
  })
}

/**
 * Finish the trade, and take the copy that outlives the listings.
 *
 * The snapshot is what lets a listing be deleted, or its owner erased, without
 * taking the counterparty's history with it — and it stops an edit to an item
 * quietly rewriting what was traded.
 */
export async function completeTrade(db: Database, tradeId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into trade_item_snapshots
        (trade_id, item_id, giver_position, title, kind, category, estimated_value_nok, cover_url)
      select ${tradeId}, i.id, oi.giver_position, i.title, i.kind, i.category, i.estimated_value_nok,
             (select url from item_media m where m.item_id = i.id order by m.position limit 1)
      from trade_offers o
      join trade_offer_items oi on oi.offer_id = o.id
      join items i on i.id = oi.item_id
      where o.trade_id = ${tradeId}
        and o.seq = (select max(seq) from trade_offers where trade_id = ${tradeId})
      on conflict do nothing
    `)

    await tx.execute(
      sql`update items set status = 'traded', active_trade_id = null
          where active_trade_id = ${tradeId}`,
    )
    await tx.execute(
      sql`update trades set state = 'completed', closed_at = now() where id = ${tradeId}`,
    )
  })
}

/** Release everything a trade was holding, and say why it ended. */
export async function cancelTrade(db: Database, tradeId: string, reason: string) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`update items set active_trade_id = null, status = 'available'
          where active_trade_id = ${tradeId}`,
    )
    await tx.execute(
      sql`update trades set state = 'cancelled', closed_at = now(), close_reason = ${reason}
          where id = ${tradeId}`,
    )
  })
}
