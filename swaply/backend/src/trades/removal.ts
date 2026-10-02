import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { uuidArray, type Row } from '../lib/rows.js'
import { lockItems, lockTradesWhere } from './locks.js'
import { endTrade } from './trades.js'

/**
 * Take an owner's listings off the market, and end the negotiations they were
 * on the table in.
 *
 * A listing is retired, never deleted: a trade that has had it in an offer is
 * part of a record somebody else may need. But a negotiation whose offer — the
 * version on the table now — holds a thing that is no longer there is a
 * negotiation about nothing, and it used to stay open: «Godta» on it agreed
 * to receive what nobody could give. So each one ends here, with
 * `listing_removed`, the others in it are told, and whatever it held goes
 * back on the market. A trade whose older version named the listing and whose
 * newest does not is a negotiation about something else, and is left alone;
 * an agreed trade cannot be holding it, since removal refuses a held listing.
 *
 * Only a listing nobody holds is removed: one an owner's yes has reserved is
 * part of a deal, and stays. Judged in the statement that removes it, under
 * the lock, rather than read first — a yes landing between a read and the
 * write used to leave a listing both removed and reserved.
 *
 * In the one order (`index.ts`): the trades, then the listings — these and
 * whatever those trades hold — in one batch, then each ending, which takes
 * nothing new.
 *
 * Returns the listings removed, which leaves out any that were held or
 * already removed, and the ones the ended trades let go of, for the caller
 * to run the search over once this has committed.
 */
export async function removeListings(
  db: Database,
  ownerId: string,
  itemIds: string[],
): Promise<{ removed: string[]; freed: string[] }> {
  if (itemIds.length === 0) return { removed: [], freed: [] }
  const ids = uuidArray(itemIds)

  return db.transaction(async (tx) => {
    const onTheTable = [
      ...(
        await lockTradesWhere(
          tx,
          sql`t.state in ('talking', 'pending', 'countered')
              and exists (
                select 1 from trade_offers o
                join trade_offer_items oi on oi.offer_id = o.id
                where o.trade_id = t.id and oi.item_id = any(${ids})
                  and o.seq = (select max(seq) from trade_offers where trade_id = t.id))`,
        )
      ).keys(),
    ]
    await lockItems(
      tx,
      sql`i.id = any(${ids}) or i.active_trade_id = any(${uuidArray(onTheTable)})`,
    )

    const removed = (
      await tx.execute<Row>(
        sql`update items set deleted_at = now(), status = 'withdrawn'
            where id = any(${ids}) and owner_id = ${ownerId}
              and deleted_at is null and active_trade_id is null
            returning id`,
      )
    ).map((row) => row['id'] as string)
    if (removed.length === 0) return { removed, freed: [] }

    // Of the trades held above, the ones a listing that was removed is on the
    // table in. One whose listing turned out to be held is not ending.
    const ending = await tx.execute<Row>(
      sql`select distinct o.trade_id from trade_offers o
          join trade_offer_items oi on oi.offer_id = o.id
          where o.trade_id = any(${uuidArray(onTheTable)}) and oi.item_id = any(${uuidArray(removed)})
            and o.seq = (select max(seq) from trade_offers where trade_id = o.trade_id)
          order by o.trade_id`,
    )
    const freed: string[] = []
    for (const row of ending) {
      freed.push(...(await endTrade(tx, row['trade_id'] as string, 'listing_removed', { actor: ownerId })))
    }
    return { removed, freed }
  })
}
