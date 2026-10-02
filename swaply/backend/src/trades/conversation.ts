import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { blocked } from '../lib/blocks.js'
import { iso, one, type Row } from '../lib/rows.js'
import { blockedInThread } from './blocking.js'

/**
 * Say something in a conversation: the message, and the notification the
 * others get for it.
 *
 * One function for the places a message is written into a conversation that
 * exists — the thread's own field, and «Som motparten» — so the refusals and
 * the notification cannot drift apart between them.
 *
 * Not across a block, either way: a conversation that was going on when
 * somebody blocked somebody is kept, but neither of them writes in it, and so
 * no notification crosses the block either. Judged inside the transaction
 * that writes, and the notification asks again, so a block made in the same
 * moment is not crossed by the one row that would.
 */
export async function postMessage(
  db: Database,
  threadId: string,
  senderId: string,
  body: string,
): Promise<Row> {
  return db.transaction(async (tx) => {
    if (await blockedInThread(tx, threadId, senderId)) throw blocked()
    const [message] = await tx.execute<Row>(
      sql`insert into messages (thread_id, sender_id, body)
          values (${threadId}, ${senderId}, ${body}) returning *`,
    )
    await tx.execute(sql`
      insert into notifications (user_id, type, payload)
      select tp.user_id, 'message', jsonb_build_object('threadId', ${threadId}::text)
      from thread_participants tp
      where tp.thread_id = ${threadId} and tp.user_id <> ${senderId}
        and not exists (select 1 from blocks b
                        where (b.blocker = ${senderId} and b.blocked = tp.user_id)
                           or (b.blocker = tp.user_id and b.blocked = ${senderId}))
    `)
    return message!
  })
}

/** The last thing said in a thread, as the one asking sees it. 06b's card and
 * 04's box draw it the same way, so it is written down once. */
export type LastMessage = {
  body: string
  senderName: string | null
  mine: boolean
  createdAt: string | null
}

export async function lastMessageIn(
  db: Database,
  threadId: string,
  viewerId: string,
): Promise<LastMessage | null> {
  const m = await one(
    db,
    sql`select m.*, u.display_name as sender_name from messages m
        join users u on u.id = m.sender_id
        where m.thread_id = ${threadId} order by m.created_at desc limit 1`,
  )
  return m
    ? {
        body: m['body'] as string,
        senderName: (m['sender_name'] as string | null) ?? null,
        mine: m['sender_id'] === viewerId,
        createdAt: iso(m['created_at']),
      }
    : null
}

/**
 * The conversation [userId] has with [ownerId] about a listing: one per pair
 * per listing, in a trade still open that has the listing in one of its
 * offers. A second message from 04 goes to it rather than opening a second
 * trade, and it is what 04's box shows. Both ask here, so the box cannot
 * show one conversation while «Send» writes into another.
 *
 * Only an open trade counts. A declined or completed one keeps its thread
 * (09g promises it), but writing about the listing again opens a new trade,
 * and so the box starts empty again as well.
 */
export async function conversationAbout(
  db: Database,
  userId: string,
  ownerId: string,
  itemId: string,
): Promise<{ tradeId: string; threadId: string } | null> {
  const row = await one(
    db,
    sql`select t.id as trade_id, th.id as thread_id from trades t
        join trade_participants me on me.trade_id = t.id and me.user_id = ${userId}
        join trade_participants them on them.trade_id = t.id and them.user_id = ${ownerId}
        join threads th on th.trade_id = t.id
        where t.state not in ('completed', 'cancelled')
          and exists (select 1 from trade_offers o
                      join trade_offer_items oi on oi.offer_id = o.id
                      where o.trade_id = t.id and oi.item_id = ${itemId})
        order by t.created_at desc limit 1`,
  )
  return row ? { tradeId: row['trade_id'] as string, threadId: row['thread_id'] as string } : null
}
