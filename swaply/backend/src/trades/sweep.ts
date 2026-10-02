import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { many, one, uuidArray } from '../lib/rows.js'
import { findCyclesThrough, type Cycle } from './cycles.js'
import { openTradeFromCycle } from './trades.js'
import { openTradeOver } from './wish.js'

/**
 * Whether somebody in this ring has already said no to it.
 *
 * «A ring is opened once» (`docs/DESIGN.md`). A trade over exactly this ring —
 * the same people, each giving the same listing to the same next one, in some
 * version of its offer — that ended in a no: «Avslå», «Trekk deg» before
 * everybody agreed, or a yes to a withdrawal after. And ended after every
 * wish in the ring was made, so the no answered these wishes and not older
 * ones: a heart taken back and pressed again since is a new wish, and opens
 * the ring anew (`closeLoopThrough`, which never asks this).
 *
 * Nothing else decides a ring. Pushed out by another trade's yes, it was never
 * answered; ended by an erasure, a block or the tool, it was not refused by
 * the people in it.
 */
async function decidedRing(db: Database, ring: Cycle): Promise<boolean> {
  const n = ring.length
  // (giver, listing, receiver), as `openTradeOver` matches a ring, since a
  // three-way ring and its mirror image give the same things to other people.
  const hops = ring.map(
    (hop, i) => sql`(${hop.userId}::uuid, ${hop.givesItemId}::uuid, ${ring[(i + 1) % n]!.userId}::uuid)`,
  )
  // The wishes behind the ring: each receiver wants what is given to them.
  const wishes = ring.map(
    (hop, i) => sql`(${ring[(i + 1) % n]!.userId}::uuid, ${hop.givesItemId}::uuid)`,
  )

  const row = await one(
    db,
    sql`select 1 from trade_participants mine
        join trades t on t.id = mine.trade_id
        where mine.user_id = ${ring[0]!.userId}
          and t.state = 'cancelled'
          and t.close_code in ('declined', 'withdrawn_early', 'withdrawal_approved')
          and (select count(*) from trade_participants p where p.trade_id = t.id) = ${n}
          and exists (
            select 1 from trade_offers o
            where o.trade_id = t.id
              and (select count(*)
                   from trade_offer_items oi
                   join trade_participants giver
                     on giver.trade_id = t.id and giver.position = oi.giver_position
                   join trade_participants taker
                     on taker.trade_id = t.id and taker.position = (oi.giver_position + 1) % ${n}
                   where oi.offer_id = o.id
                     and (giver.user_id, oi.item_id, taker.user_id) in (${sql.join(hops, sql`, `)})
                  ) = ${n})
          and not exists (
            select 1 from likes l
            where (l.from_user, l.target_item) in (${sql.join(wishes, sql`, `)})
              and l.created_at >= t.closed_at)
        limit 1`,
  )
  return Boolean(row)
}

/**
 * Look for cycles through the wishes pointing at listings that are free again.
 *
 * An incremental search only finds cycles through the new edge, so a listing
 * that comes back on the market after a cancelled trade takes its old wishes
 * with it and nobody notices. This is the other two triggers from
 * `docs/ARCHITECTURE.md`: an item becoming available, and a nightly sweep.
 *
 * A ring somebody in it has said no to is left alone (`decidedRing`). The
 * listings a no frees are swept on the way out of it, and the wishes that made
 * the ring are still there, so without that the same ring came straight back
 * as a new «Dere kan swappe!» — or an hour later, from the job.
 */
export async function sweepForCycles(db: Database, itemIds?: string[]): Promise<string[]> {
  if (itemIds && itemIds.length === 0) return []

  const wishes = await many<{ from_user: string; target_item: string }>(
    db,
    itemIds
      ? sql`select l.from_user, l.target_item from likes l
            join items i on i.id = l.target_item
            where i.status = 'available' and i.active_trade_id is null and i.deleted_at is null
              and l.target_item = any(${uuidArray(itemIds)})`
      : sql`select l.from_user, l.target_item from likes l
            join items i on i.id = l.target_item
            where i.status = 'available' and i.active_trade_id is null and i.deleted_at is null`,
  )

  const opened: string[] = []
  const spoken = new Set<string>()

  for (const wish of wishes) {
    if (spoken.has(wish.target_item)) continue

    let cycle: Cycle | undefined
    for (const candidate of await findCyclesThrough(db, wish.from_user, wish.target_item)) {
      if (candidate.some((hop) => spoken.has(hop.givesItemId))) continue
      if (await decidedRing(db, candidate)) continue
      // Nor a ring with a trade going on over it, in any state: the check
      // below sees only negotiations, and a ring of services is never
      // reserved, so an agreed one was found and opened a second time.
      if (await openTradeOver(db, candidate)) continue
      cycle = candidate
      break
    }
    if (!cycle) continue

    // One trade per listing per sweep: a second would open on things the first
    // has already put on the table. The table is the newest version: a thing a
    // counter-offer dropped is back on the market (`proposeCounterOffer`), and
    // an older version naming it is history, not a claim on it.
    const ids = cycle.map((hop) => hop.givesItemId)
    const alreadyOpen = await many(
      db,
      sql`select 1 from trades t
          join trade_offers o on o.trade_id = t.id
           and o.seq = (select max(seq) from trade_offers where trade_id = t.id)
          join trade_offer_items oi on oi.offer_id = o.id
          where t.state in ('pending', 'countered')
            and oi.item_id = any(${uuidArray(ids)})`,
    )
    if (alreadyOpen.length > 0) continue

    const tradeId = await openTradeFromCycle(db, cycle)
    opened.push(tradeId)
    for (const hop of cycle) {
      spoken.add(hop.givesItemId)
      await db.execute(
        sql`insert into notifications (user_id, type, payload)
            values (${hop.userId}, 'trade_opened',
                    jsonb_build_object('tradeId', ${tradeId}::text))`,
      )
    }
  }

  return opened
}
