// FLOW — Writing the first message is what creates the trade
//
// Threads belong to trades, so there is no such thing as a conversation without
// one. Which means the box on a listing is not a chat box, it is the opening of
// a negotiation. Several people may be talking about the same drill at once —
// that is correct, and it is why nothing is reserved until an owner accepts.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { startTalking } from '../../src/trades/trades.js'
import { close, db, itemRow, makeItem, makeUser, reset, tradeState } from '../helpers.js'

describe('a conversation about a listing', () => {
  let ola: string, kari: string, per: string, drill: string
  let fromKari: { tradeId: string; threadId: string }
  let fromPer: { tradeId: string; threadId: string }

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    drill = await makeItem(ola, 'Bosch drill 18V')
  })

  afterAll(close)

  test('1. with no trade between them there is nothing to show', async () => {
    const rows = await db.execute(sql`
      select 1 from trade_participants a
      join trade_participants b on b.trade_id = a.trade_id and b.user_id = ${kari}
      where a.user_id = ${ola}
    `)
    expect(rows).toHaveLength(0)
  })

  test('2. Kari’s first message creates the trade, the thread and both seats', async () => {
    fromKari = await startTalking(db, kari, drill, 'Hei! Er drillen fortsatt ledig?')

    expect(await tradeState(fromKari.tradeId)).toBe('talking')

    const seats = await db.execute<Record<string, string>>(
      sql`select user_id from thread_participants where thread_id = ${fromKari.threadId}`,
    )
    expect(seats.map((s) => s['user_id']).sort()).toEqual([kari, ola].sort())
  })

  test('3. talking reserves nothing', async () => {
    const row = await itemRow(drill)
    expect(row['active_trade_id']).toBeNull()
    expect(row['status']).toBe('available')
  })

  test('4. the opening offer names their listing and nothing back yet', async () => {
    const rows = await db.execute<Record<string, string | number>>(sql`
      select oi.item_id, oi.giver_position from trade_offers o
      join trade_offer_items oi on oi.offer_id = o.id
      where o.trade_id = ${fromKari.tradeId}
    `)
    expect(rows).toHaveLength(1)
    expect(rows[0]!['item_id']).toBe(drill)
    expect(Number(rows[0]!['giver_position'])).toBe(1)
  })

  test('5. Per can be talking about the same drill at the same time', async () => {
    fromPer = await startTalking(db, per, drill, 'Vil du bytte mot en sykkel?')

    expect(fromPer.tradeId).not.toBe(fromKari.tradeId)
    expect(await tradeState(fromPer.tradeId)).toBe('talking')
    expect((await itemRow(drill))['active_trade_id']).toBeNull()
  })

  test('6. Ola now has two conversations; Kari still has exactly one', async () => {
    const forOla = await db.execute(
      sql`select 1 from trade_participants where user_id = ${ola}`,
    )
    expect(forOla).toHaveLength(2)

    const between = await db.execute(sql`
      select 1 from trade_participants a
      join trade_participants b on b.trade_id = a.trade_id and b.user_id = ${kari}
      where a.user_id = ${ola}
    `)
    expect(between).toHaveLength(1)
  })

  test('7. unread is counted per participant, and nothing is a badge of zero', async () => {
    const unread = async (userId: string, threadId: string) => {
      const [row] = await db.execute<Record<string, string>>(sql`
        select count(*) as n from messages m
        join thread_participants tp
          on tp.thread_id = m.thread_id and tp.user_id = ${userId}
        where m.thread_id = ${threadId}
          and m.sender_id <> ${userId}
          and (tp.last_read_message_id is null or m.created_at > (
                select created_at from messages where id = tp.last_read_message_id))
      `)
      return Number(row!['n'])
    }

    expect(await unread(ola, fromKari.threadId)).toBe(1)
    expect(await unread(kari, fromKari.threadId)).toBe(0)

    const [last] = await db.execute<Record<string, string>>(
      sql`select id from messages where thread_id = ${fromKari.threadId}
          order by created_at desc limit 1`,
    )
    await db.execute(sql`
      update thread_participants set last_read_message_id = ${last!['id']}
      where thread_id = ${fromKari.threadId} and user_id = ${ola}
    `)

    expect(await unread(ola, fromKari.threadId)).toBe(0)
  })
})
