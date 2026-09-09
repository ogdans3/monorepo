// Runs against a real Postgres, not a mock. Every case here is a rule the
// database is supposed to enforce on its own, and mocking it would only test
// the mock. `pnpm db:up && pnpm db:migrate` first.
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, expect, test } from 'vitest'

import { connect } from '../src/db/index.js'

const { client, db } = connect()

beforeEach(async () => {
  await db.execute(sql`truncate table users, trades cascade`)
})

afterAll(async () => {
  await client.end()
})

// Drizzle wraps the driver error, and the constraint name only survives on the
// cause. Asserting on the message instead would pass for any failure at all.
async function violates(constraint: string, run: Promise<unknown>) {
  try {
    await run
  } catch (err) {
    const cause = (err as { cause?: { constraint_name?: string } }).cause
    expect(cause?.constraint_name).toBe(constraint)
    return
  }
  throw new Error(`expected ${constraint} to reject the statement`)
}

async function newUser() {
  const [row] = await db.execute<{ id: string }>(
    sql`insert into users (display_name) values ('Ola') returning id`,
  )
  return row!.id
}

async function newItem(owner: string, kind: 'item' | 'service' = 'item') {
  const [row] = await db.execute<{ id: string }>(
    sql`insert into items (owner_id, kind, title, category, condition)
        values (${owner}, ${kind}, 'Bosch drill 18V', 'verktoy',
                ${kind === 'item' ? 'good' : null})
        returning id`,
  )
  return row!.id
}

test('an item needs a condition, a service does not', async () => {
  const owner = await newUser()

  await violates(
    'condition_for_items',
    db.execute(
      sql`insert into items (owner_id, kind, title, category)
          values (${owner}, 'item', 'Uten tilstand', 'verktoy')`,
    ),
  )

  await expect(newItem(owner, 'service')).resolves.toBeTruthy()
})

test('a listing may have no photos at all', async () => {
  const owner = await newUser()
  const item = await newItem(owner)

  const rows = await db.execute(sql`select 1 from item_media where item_id = ${item}`)
  expect(rows.length).toBe(0)
})

test('a service can never hold a reservation', async () => {
  const owner = await newUser()
  const service = await newItem(owner, 'service')
  const [trade] = await db.execute<{ id: string }>(sql`insert into trades default values returning id`)

  await violates(
    'exclusive_only_for_items',
    db.execute(sql`update items set active_trade_id = ${trade!.id} where id = ${service}`),
  )
})

test('an item belongs to one trade at a time', async () => {
  const owner = await newUser()
  const item = await newItem(owner)
  const [a] = await db.execute<{ id: string }>(sql`insert into trades default values returning id`)
  const [b] = await db.execute<{ id: string }>(sql`insert into trades default values returning id`)

  await db.execute(sql`update items set active_trade_id = ${a!.id} where id = ${item}`)

  // The second trade does not get to overwrite a live reservation by accident:
  // the write is guarded, and the loser is closed with a reason instead.
  const held = await db.execute<{ active_trade_id: string }>(
    sql`update items set active_trade_id = ${b!.id}
        where id = ${item} and active_trade_id is null
        returning active_trade_id`,
  )
  expect(held.length).toBe(0)

  const [row] = await db.execute<{ active_trade_id: string }>(
    sql`select active_trade_id from items where id = ${item}`,
  )
  expect(row!.active_trade_id).toBe(a!.id)
})

test('interests are three to five, or none', async () => {
  await violates(
    'interests_bounds',
    db.execute(sql`insert into users (interests) values ('{verktoy,gaming}')`),
  )

  await expect(
    db.execute(sql`insert into users (interests) values ('{verktoy,gaming,sykling}')`),
  ).resolves.toBeTruthy()
})

test('one thread per trade, and no more', async () => {
  const [trade] = await db.execute<{ id: string }>(sql`insert into trades default values returning id`)

  await db.execute(sql`insert into threads (trade_id) values (${trade!.id})`)
  await violates(
    'threads_trade_id_unique',
    db.execute(sql`insert into threads (trade_id) values (${trade!.id})`),
  )
})

test('a trade starts out talking, holding nothing', async () => {
  const [row] = await db.execute<{ state: string }>(
    sql`insert into trades default values returning state`,
  )
  expect(row!.state).toBe('talking')
})

test('search finds a Norwegian word by its stem', async () => {
  const owner = await newUser()
  await db.execute(
    sql`insert into items (owner_id, title, description, category, condition)
        values (${owner}, 'Sykkel til salgs', 'En fin sykkel med sykler på', 'sykling', 'good')`,
  )

  const hits = await db.execute(
    sql`select 1 from items where search @@ plainto_tsquery('norwegian', 'sykler')`,
  )
  expect(hits.length).toBe(1)
})
