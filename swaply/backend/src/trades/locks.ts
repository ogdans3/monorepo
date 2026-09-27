import { sql, type SQL } from 'drizzle-orm'

import { uuidArray, type Row } from '../lib/rows.js'
import type { Tx } from './trades.js'

// The two halves of the one lock order, which `index.ts` states and argues.
// Every transaction that changes a trade or what it holds goes through these
// two, trades first, so that the order is a function call rather than a
// comment somebody has to remember.

/**
 * Lock trades, lowest id first, and say what state each is in once it is held.
 *
 * `for no key update` is the lock an UPDATE takes on its own, so a writer
 * queues behind it, while an offer, a thread or a reservation pointing at the
 * trade — which takes only the key-share lock a foreign key needs — does not.
 * Called with a trade the transaction already holds, it takes nothing new.
 */
export async function lockTrades(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  return lockTradesWhere(tx, sql`t.id = any(${uuidArray([...new Set(ids)])})`)
}

/**
 * The same, for the trades a condition on `t` picks out. The condition is
 * checked again on each row once it is held, so a trade that changed while
 * this waited for it is judged as it is now, not as it was.
 */
export async function lockTradesWhere(tx: Tx, where: SQL): Promise<Map<string, string>> {
  const rows = await tx.execute<Row>(
    sql`select t.id, t.state from trades t where ${where} order by t.id for no key update`,
  )
  return new Map(rows.map((row) => [row['id'] as string, row['state'] as string]))
}

/**
 * Lock listings, lowest id first, in one statement — after every trade the
 * transaction is going to write, never before.
 *
 * Once a trade is held, nothing else can reserve into it or release from it,
 * so the listings it holds are a fixed set that one sorted statement can
 * take. Taking them in two batches would let the second reach below the first
 * and break the order it exists to keep.
 */
export async function lockItems(tx: Tx, where: SQL): Promise<Row[]> {
  return tx.execute<Row>(
    sql`select i.id, i.owner_id, i.kind, i.status, i.active_trade_id from items i
        where ${where} order by i.id for no key update`,
  )
}
