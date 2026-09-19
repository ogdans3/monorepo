import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { blocked, blockedBetween } from '../lib/blocks.js'
import { LIKES_BEFORE_LISTING_PROMPT } from '../lib/constants.js'
import { badRequest, notFound } from '../lib/errors.js'
import { one } from '../lib/rows.js'
import { findCyclesThrough } from './cycles.js'
import { openTradeFromCycle } from './trades.js'

export type Wish = {
  tradeId: string | null
  promptToList: boolean
  likedCount: number
}

/**
 * The heart, as a function.
 *
 * It lives here rather than in the route because the test tooling presses it
 * too — «Få noen til å ville ha denne» is one test account wanting the listing
 * you are looking at — and a second implementation is how `db/seed.ts` came to
 * advertise a three-way ring that nothing would ever have found. There is one
 * path from a wish to a trade, and this is it.
 */
export async function expressWish(db: Database, userId: string, itemId: string): Promise<Wish> {
  const item = await one(db, sql`select owner_id from items where id = ${itemId} and deleted_at is null`)
  if (!item) throw notFound('Fant ikke gjenstanden.')
  if (item['owner_id'] === userId) throw badRequest('own_item', 'Du kan ikke like din egen ting.')
  if (await blockedBetween(db, userId, item['owner_id'])) throw blocked()

  await db.execute(
    sql`insert into likes (from_user, target_item) values (${userId}, ${itemId})
        on conflict do nothing`,
  )

  const cycles = await findCyclesThrough(db, userId, itemId)
  let tradeId: string | null = null
  // One is enough to celebrate; the rest would fight over the same items.
  const cycle = cycles[0]
  if (cycle) {
    tradeId = await openTradeFromCycle(db, cycle)
    for (const hop of cycle) {
      await db.execute(
        sql`insert into notifications (user_id, type, payload)
            values (${hop.userId}, 'trade_opened',
                    jsonb_build_object('tradeId', ${tradeId}::text))`,
      )
    }
  }

  await db.execute(sql`
    insert into notifications (user_id, type, payload)
    values (${item['owner_id']}, 'item_liked',
            jsonb_build_object('itemId', ${itemId}::text, 'byUserId', ${userId}::text))
  `)

  const counts = await one(
    db,
    sql`select (select count(*) from likes where from_user = ${userId}) as liked,
               (select count(*) from items where owner_id = ${userId} and deleted_at is null) as listed`,
  )

  return {
    tradeId,
    // Screen 10a: ten wishes and nothing to give is a dead end, so we say so.
    promptToList:
      Number(counts!['listed']) === 0 && Number(counts!['liked']) >= LIKES_BEFORE_LISTING_PROMPT,
    likedCount: Number(counts!['liked']),
  }
}
