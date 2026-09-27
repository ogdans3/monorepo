import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { blocked, blockedBetween } from '../lib/blocks.js'
import { LIKES_BEFORE_LISTING_PROMPT, LISTING_PROMPT_EVERY } from '../lib/constants.js'
import { badRequest, notFound } from '../lib/errors.js'
import { one } from '../lib/rows.js'
import { findCyclesThrough, type Cycle } from './cycles.js'
import { openTradeFromCycle } from './trades.js'

export type Wish = {
  tradeId: string | null
  /**
   * Whether this heart opened [tradeId], or found it already going on over the
   * ring (see `closeLoopThrough`). The app celebrates only the first: 06a is
   * the moment a trade opens, and it already had its moment.
   */
  tradeIsNew: boolean
  promptToList: boolean
  likedCount: number
}

/** A ring a heart closed: the trade over it, and whether the heart opened it. */
export type Loop = { tradeId: string; isNew: boolean }

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
  // offered or not. Least of all the loop search, which is the slow part and
  // could only find what the first press found. A loop that could not close
  // when the heart was first pressed — before the profile existed, across a
  // block since lifted — is the sweep's to find.
  //
  // A heart taken back and pressed again *is* a new like, and searches.
  // `closeLoopThrough` answers it with the trade already open over the ring
  // rather than opening that ring a second time, and says it is not new.
  //
  // After the commit, and outside the lock: the search is the slow part, and
  // it reads other people's wishes, not this person's count.
  let loop: Loop | null = null
  if (heart.isNew) {
    try {
      loop = await closeLoopThrough(db, userId, itemId)
    } catch (err) {
      if (!opts.searchFailed) throw err
      opts.searchFailed(err)
    }
  }

  const { liked } = heart
  return {
    tradeId: loop?.tradeId ?? null,
    tradeIsNew: loop?.isNew ?? false,
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
): Promise<Loop | null> {
  const cycles = await findCyclesThrough(db, userId, itemId)

  // A ring somebody is already negotiating is the answer, not a second trade
  // over it. A pending trade reserves nothing, so taking the heart back and
  // pressing it again finds the very ring the first press opened — and opened
  // it again, with a second thread and a second «Dere kan swappe!» to the
  // same people about the same things. The answer names the trade it already
  // has, so the test tooling does not say «Ingen sirkel ennå» with one open,
  // and says it is not new, so the app does not celebrate it again: nobody
  // is told twice, the presser included.
  //
  // Only the same ring: other trades may still compete for one of its
  // listings, which is the design — several pending trades may want the same
  // drill, and the owner's acceptance decides. The sweep's stricter rule, one
  // new trade per listing, is for a job that opens trades nobody asked for.
  for (const ring of cycles) {
    const open = await openTradeOver(db, ring)
    if (open) return { tradeId: open, isNew: false }
  }

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
  return { tradeId, isNew: true }
}

/**
 * A trade still going on over exactly this ring, or null.
 *
 * The same people, and some version of the offer in which each of them gives
 * the ring's listing to the next one round — the version the search opened it
 * with, or a counter-offer that kept those and added to them. Any state but
 * `completed` and `cancelled`: `talking` counts, because «Jeg vil ha» plus a
 * counter-offer can reach the same swap by hand.
 */
async function openTradeOver(db: Database, ring: Cycle): Promise<string | null> {
  const n = ring.length
  // (giver, listing, receiver), since a three-way ring and its mirror image
  // give the same things to different people.
  const hops = ring.map(
    (hop, i) => sql`(${hop.userId}::uuid, ${hop.givesItemId}::uuid, ${ring[(i + 1) % n]!.userId}::uuid)`,
  )

  const row = await one(
    db,
    // Starting from the presser's own trades, which the participant index
    // finds, rather than from every open trade there is.
    sql`select t.id from trade_participants mine
        join trades t on t.id = mine.trade_id
        where mine.user_id = ${ring[0]!.userId}
          and t.state not in ('completed', 'cancelled')
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
        order by t.created_at
        limit 1`,
  )
  return row ? (row['id'] as string) : null
}
