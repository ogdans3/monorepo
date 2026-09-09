import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { many } from '../lib/rows.js'
import { findCyclesThrough } from './cycles.js'
import { openTradeFromCycle } from './trades.js'

/**
 * Look for cycles through the wishes pointing at listings that are free again.
 *
 * An incremental search only finds cycles through the new edge, so a listing
 * that comes back on the market after a cancelled trade takes its old wishes
 * with it and nobody notices. This is the other two triggers from
 * `docs/ARCHITECTURE.md`: an item becoming available, and a nightly sweep.
 */
export async function sweepForCycles(db: Database, itemIds?: string[]): Promise<string[]> {
  if (itemIds && itemIds.length === 0) return []

  const wishes = await many<{ from_user: string; target_item: string }>(
    db,
    itemIds
      ? sql`select l.from_user, l.target_item from likes l
            join items i on i.id = l.target_item
            where i.status = 'available' and i.active_trade_id is null
              and l.target_item = any(${sql.raw(`array['${itemIds.join("','")}']::uuid[]`)})`
      : sql`select l.from_user, l.target_item from likes l
            join items i on i.id = l.target_item
            where i.status = 'available' and i.active_trade_id is null`,
  )

  const opened: string[] = []
  const spoken = new Set<string>()

  for (const wish of wishes) {
    if (spoken.has(wish.target_item)) continue

    const cycles = await findCyclesThrough(db, wish.from_user, wish.target_item)
    const cycle = cycles.find((c) => c.every((hop) => !spoken.has(hop.givesItemId)))
    if (!cycle) continue

    // One trade per listing per sweep: a second would open on things the first
    // has already put on the table.
    const ids = cycle.map((hop) => hop.givesItemId)
    const alreadyOpen = await many(
      db,
      sql`select 1 from trades t
          join trade_offers o on o.trade_id = t.id
          join trade_offer_items oi on oi.offer_id = o.id
          where t.state in ('pending', 'countered')
            and oi.item_id = any(${sql.raw(`array['${ids.join("','")}']::uuid[]`)})`,
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
