import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'

/** One hop of a cycle: this participant gives this listing to the next one. */
export type Hop = { userId: string; givesItemId: string }

/** Participants in giving order: 0 gives to 1, 1 gives to 2, the last gives to 0. */
export type Cycle = Hop[]

type Row = Record<string, string>

// A like is "I want their thing", so goods travel the other way round the ring.
// Read every cycle below as: the wants point one way, the items the other.
//
// Two explicit queries rather than a recursive CTE. The cap is three, so
// generality would buy nothing and cost the ability to read this in a year.

/**
 * Cycles created by a single new like — `liker` wants `wantedItem`.
 *
 * An incremental search only ever finds cycles through the new edge, which is
 * why the caller also has to run this when an item becomes free again.
 */
export async function findCyclesThrough(
  db: Database,
  liker: string,
  wantedItem: string,
): Promise<Cycle[]> {
  const [wanted] = await db.execute<Row>(
    sql`select owner_id from items
        where id = ${wantedItem} and status = 'available' and active_trade_id is null`,
  )
  if (!wanted) return []

  const owner = wanted['owner_id']!
  if (owner === liker) return []

  const twoWay = await db.execute<Row>(sql`
    select ours.id as gives_item
    from likes theirs
    join items ours on ours.id = theirs.target_item
    where theirs.from_user = ${owner}
      and ours.owner_id = ${liker}
      and ${available('ours')}
      and ${notBlocked(sql`${liker}`, sql`${owner}`)}
  `)

  // liker gives one of theirs to owner; owner gives the wanted item back.
  const cycles: Cycle[] = twoWay.map((row) => [
    { userId: liker, givesItemId: row['gives_item']! },
    { userId: owner, givesItemId: wantedItem },
  ])

  const threeWay = await db.execute<Row>(sql`
    select third.owner_id as third_user,
           third.id        as third_gives,
           ours.id         as our_gives
    from likes owner_wants
    join items third on third.id = owner_wants.target_item
    join likes third_wants on third_wants.from_user = third.owner_id
    join items ours on ours.id = third_wants.target_item
    where owner_wants.from_user = ${owner}
      and ours.owner_id = ${liker}
      and third.owner_id <> ${liker}
      and third.owner_id <> ${owner}
      and ${available('third')}
      and ${available('ours')}
      and ${notBlocked(sql`${liker}`, sql`${owner}`)}
      and ${notBlocked(sql`${liker}`, sql`third.owner_id`)}
      and ${notBlocked(sql`${owner}`, sql`third.owner_id`)}
  `)

  for (const row of threeWay) {
    // liker → third → owner → liker, in giving order.
    cycles.push([
      { userId: liker, givesItemId: row['our_gives']! },
      { userId: row['third_user']!, givesItemId: row['third_gives']! },
      { userId: owner, givesItemId: wantedItem },
    ])
  }

  return cycles
}

// Reserved is `active_trade_id`, not status: nothing is held until an owner
// accepts, so status alone would let a traded item back into the graph.
function available(alias: string) {
  return sql.raw(`${alias}.status = 'available' and ${alias}.active_trade_id is null`)
}

// A block hides both ways. Someone you blocked cannot reach you through a chain
// either, which is the whole point of blocking in a matching product.
function notBlocked(a: ReturnType<typeof sql>, b: ReturnType<typeof sql>) {
  return sql`not exists (
    select 1 from blocks
    where (blocker = ${a} and blocked = ${b}) or (blocker = ${b} and blocked = ${a})
  )`
}
