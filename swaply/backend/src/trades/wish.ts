import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { blocked, blockedBetween } from '../lib/blocks.js'
import { LIKES_BEFORE_LISTING_PROMPT, LISTING_PROMPT_EVERY } from '../lib/constants.js'
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
export async function expressWish(
  db: Database,
  userId: string,
  itemId: string,
  opts: {
    /**
     * Given, a loop search that fails is handed here and the heart stands
     * without it; not given, it is thrown. The like route gives one: by then
     * the like is made and the owner told, and the hourly sweep finds the
     * loop. A 500 there turned the heart back on the card, and pressing it
     * again was a repeat press, which is not news — the prompt that heart was
     * owed never came. The tooling gives none, because a loop is what it
     * pressed the heart for.
     */
    searchFailed?: (err: unknown) => void
  } = {},
): Promise<Wish> {
  const item = await one(db, sql`select owner_id from items where id = ${itemId} and deleted_at is null`)
  if (!item) throw notFound('Fant ikke gjenstanden.')
  if (item['owner_id'] === userId) throw badRequest('own_item', 'Du kan ikke like din egen ting.')
  if (await blockedBetween(db, userId, item['owner_id'])) throw blocked()

  const heart = await db.transaction(async (tx) => {
    // One heart at a time per person, from the like to the count. Two cards
    // tapped at once both inserted and then both counted six, and the fifth
    // heart — the one 10a is for — was never anybody's. Keyed on the liker
    // alone: other people's hearts on the same things do not wait.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`like:${userId}`}))`)

    // `returning` is what tells a like from a heart pressed on something
    // already liked: on the second, `on conflict` hands back no row.
    const inserted = await tx.execute(
      sql`insert into likes (from_user, target_item) values (${userId}, ${itemId})
          on conflict do nothing
          returning 1`,
    )
    const isNew = inserted.length > 0

    // With the like, not after the loop search: a like that exists is one the
    // owner has been told about, whatever the search does next.
    if (isNew) {
      await tx.execute(sql`
        insert into notifications (user_id, type, payload)
        values (${item['owner_id']}, 'item_liked',
                jsonb_build_object('itemId', ${itemId}::text, 'byUserId', ${userId}::text))
      `)
    }

    const [counts] = await tx.execute<Record<string, string>>(
      sql`select (select count(*) from likes where from_user = ${userId}) as liked,
                 (select count(*) from items where owner_id = ${userId} and deleted_at is null) as listed`,
    )
    return { isNew, liked: Number(counts!['liked']), listed: Number(counts!['listed']) }
  })

  // A repeat press — a stale card, a double tap — changes nothing, so nothing
  // that follows a like follows it: the owner has been told, and 10a has been
  // offered or not. Least of all the loop search. A pending trade reserves
  // nothing, so the search finds the ring the first press opened and would open
  // it a second time. A loop that could not close when the heart was first
  // pressed — before the profile existed, across a block since lifted — is the
  // sweep's to find, and the sweep checks for a trade already open where this
  // does not.
  //
  // After the commit, and outside the lock: the search is the slow part, and
  // it reads other people's wishes, not this person's count.
  let tradeId: string | null = null
  if (heart.isNew) {
    try {
      tradeId = await closeLoopThrough(db, userId, itemId)
    } catch (err) {
      if (!opts.searchFailed) throw err
      opts.searchFailed(err)
    }
  }

  const { liked } = heart
  return {
    tradeId,
    // Screen 10a: wishes and nothing to give are a dead end, so we say so — at
    // five, then every tenth. The server only knows the count; the app keeps
    // the highest count it has asked at, so unliking and liking at five does
    // not nag.
    promptToList:
      heart.isNew &&
      heart.listed === 0 &&
      liked >= LIKES_BEFORE_LISTING_PROMPT &&
      (liked - LIKES_BEFORE_LISTING_PROMPT) % LISTING_PROMPT_EVERY === 0,
    likedCount: liked,
  }
}

/**
 * The search a wish sets off, and the trade it opens when a loop closes.
 *
 * Apart from `expressWish` for the one caller that holds a wish nobody has just
 * pressed: signing in from a phone that was looking around carries the phone's
 * wishes into the account (`auth/merge.ts`), and each of them may close a loop
 * the moment it belongs to somebody with something to give. That caller runs
 * this and not the whole of `expressWish` because the owner was told about the
 * heart when it was pressed, and telling them again would be a second like.
 */
export async function closeLoopThrough(
  db: Database,
  userId: string,
  itemId: string,
): Promise<string | null> {
  const cycles = await findCyclesThrough(db, userId, itemId)
  // One is enough to celebrate; the rest would fight over the same items.
  const cycle = cycles[0]
  if (!cycle) return null

  const tradeId = await openTradeFromCycle(db, cycle)
  for (const hop of cycle) {
    await db.execute(
      sql`insert into notifications (user_id, type, payload)
          values (${hop.userId}, 'trade_opened',
                  jsonb_build_object('tradeId', ${tradeId}::text))`,
    )
  }
  return tradeId
}
