import { sql } from 'drizzle-orm'

import { connect } from '../src/db/index.js'

export const { client, db } = connect()

/** Every flow starts from an empty database. `users` cascades to most of it. */
export async function reset() {
  await db.execute(
    sql`truncate table users, trades, retained.identities, retained.blocked_subjects cascade`,
  )
}

export async function close() {
  await client.end()
}

type Row = Record<string, string | null>

export async function makeUser(name: string, bankidSubject?: string): Promise<string> {
  const [row] = await db.execute<Row>(
    sql`insert into users (display_name, email, bankid_subject)
        values (${name}, ${`${name.toLowerCase()}@example.no`}, ${bankidSubject ?? null})
        returning id`,
  )
  return row!['id']!
}

export async function makeItem(
  ownerId: string,
  title: string,
  opts: { kind?: 'item' | 'service'; value?: number; photo?: string } = {},
): Promise<string> {
  const kind = opts.kind ?? 'item'
  const [row] = await db.execute<Row>(
    sql`insert into items (owner_id, kind, title, category, condition, estimated_value_nok)
        values (${ownerId}, ${kind}, ${title}, 'verktoy',
                ${kind === 'item' ? 'good' : null}, ${opts.value ?? 500})
        returning id`,
  )
  const itemId = row!['id']!
  if (opts.photo) {
    await db.execute(
      sql`insert into item_media (item_id, url, position) values (${itemId}, ${opts.photo}, 0)`,
    )
  }
  return itemId
}

export async function like(userId: string, itemId: string) {
  await db.execute(
    sql`insert into likes (from_user, target_item) values (${userId}, ${itemId})
        on conflict do nothing`,
  )
}

export async function tradeState(tradeId: string): Promise<string> {
  const [row] = await db.execute<Row>(sql`select state from trades where id = ${tradeId}`)
  return row!['state']!
}

export async function itemRow(itemId: string) {
  const [row] = await db.execute<Row>(
    sql`select status, active_trade_id, title, description from items where id = ${itemId}`,
  )
  return row!
}

export async function currentOffer(tradeId: string): Promise<string> {
  const [row] = await db.execute<Row>(
    sql`select id from trade_offers where trade_id = ${tradeId} order by seq desc limit 1`,
  )
  return row!['id']!
}
