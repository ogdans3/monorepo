import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import type { Row } from '../lib/rows.js'
import type { Tx } from './trades.js'

// A block, where it meets a negotiation that already exists.
//
// `lib/blocks.ts` keeps two people apart who have not met: no heart, no first
// message, no ring through both. This is the other half. A block used to be a
// row and nothing else, so a conversation and a trade that were already going
// on went on across it — the chat, the counter-offers and the yes all worked.
// Making one now ends the negotiations the two share (`blockAndEnd`), and
// these are what refuse the moves that are left: a trade agreed before the
// block stands, and so does its conversation, but nobody writes, proposes or
// says yes across it.

/**
 * Whether [userId] and anybody else in the trade are blocked, either way.
 * Read under the trade's lock by the moves that take one.
 */
export async function blockedInTrade(
  db: Database | Tx,
  tradeId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db.execute<Row>(
    sql`select 1 from trade_participants p
        join blocks b on (b.blocker = ${userId} and b.blocked = p.user_id)
                      or (b.blocker = p.user_id and b.blocked = ${userId})
        where p.trade_id = ${tradeId} and p.user_id <> ${userId}
        limit 1`,
  )
  return Boolean(row)
}

/** The same, for everybody else in a conversation. */
export async function blockedInThread(
  db: Database | Tx,
  threadId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db.execute<Row>(
    sql`select 1 from thread_participants tp
        join blocks b on (b.blocker = ${userId} and b.blocked = tp.user_id)
                      or (b.blocker = tp.user_id and b.blocked = ${userId})
        where tp.thread_id = ${threadId} and tp.user_id <> ${userId}
        limit 1`,
  )
  return Boolean(row)
}
