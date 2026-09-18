import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { MAX_ITEMS_PER_SIDE } from '../lib/constants.js'
import { badRequest } from '../lib/errors.js'
import { many } from '../lib/rows.js'

export type OfferItem = { itemId: string; giverPosition: number }
export type OfferCash = { payerPosition: number; payeePosition: number; amountNok: number }

/**
 * Check that a proposed offer is a true claim before it becomes one.
 *
 * An offer is read out on the agreement screen — «Du får Kajakk med åre fra
 * Kari» — and an acceptance is keyed to it. So every part of it has to hold:
 * the seats are seats in *this* ring, the things are the giver's to give, and
 * they are still there to be given.
 *
 * None of this is reachable from the app's own screens, which only ever offer
 * what `/trades/:id/candidates` handed them. It is the difference between a
 * client that behaves and a rule.
 */
export async function validateOffer(
  db: Database,
  tradeId: string,
  items: OfferItem[],
  cash?: OfferCash,
) {
  const seats = await many(
    db,
    sql`select position, user_id from trade_participants where trade_id = ${tradeId}`,
  )
  const owner = new Map(seats.map((s) => [Number(s['position']), s['user_id'] as string]))

  const positions = [
    ...items.map((i) => i.giverPosition),
    ...(cash ? [cash.payerPosition, cash.payeePosition] : []),
  ]
  for (const position of positions) {
    if (!owner.has(position)) {
      throw badRequest('no_such_position', 'Ingen i dette byttet sitter på den plassen.')
    }
  }

  // «Each side of a hop is a list of 1–3 items.» More than three is a pile,
  // and no screen in round 5 draws one.
  const perSide = new Map<number, number>()
  for (const item of items) {
    const n = (perSide.get(item.giverPosition) ?? 0) + 1
    perSide.set(item.giverPosition, n)
    if (n > MAX_ITEMS_PER_SIDE) {
      throw badRequest(
        'too_many_items',
        `Hver part kan legge inn opptil ${MAX_ITEMS_PER_SIDE} ting.`,
      )
    }
  }

  const ids = [...new Set(items.map((i) => i.itemId))]
  if (ids.length === 0) return

  const rows = await many(
    db,
    sql`select id, owner_id, status, deleted_at, active_trade_id
        from items where id in ${ids}`,
  )
  const byId = new Map(rows.map((r) => [r['id'] as string, r]))

  for (const item of items) {
    const row = byId.get(item.itemId)
    if (!row) throw badRequest('item_unavailable', 'Fant ikke en av tingene i forslaget.')

    if (row['owner_id'] !== owner.get(item.giverPosition)) {
      throw badRequest(
        'not_theirs',
        'En av tingene i forslaget tilhører ikke den som skal gi den bort.',
      )
    }

    // Retired, already traded, or locked by a trade that is not this one. 09b
    // draws the last of those as «Låst» rather than hiding it, and this is the
    // same fact one layer down.
    const free =
      !row['deleted_at'] &&
      ['available', 'reserved'].includes(row['status'] as string) &&
      (!row['active_trade_id'] || row['active_trade_id'] === tradeId)
    if (!free) {
      throw badRequest('item_unavailable', 'En av tingene i forslaget er ikke tilgjengelig.')
    }
  }
}
