import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { findCyclesThrough } from '../trades/cycles.js'
import { openTradeFromCycle } from '../trades/trades.js'
import { LIKES_BEFORE_LISTING_PROMPT } from '../lib/constants.js'
import { badRequest, notFound } from '../lib/errors.js'
import { coverSql, many, one } from '../lib/rows.js'
import { publicItem, publicUser } from './serialize.js'

export default async function likeRoutes(app: FastifyInstance) {
  // The heart. This is the directed edge, and the only thing that can close a
  // loop, so it runs the cycle search on the spot rather than on a schedule.
  app.post('/items/:id/like', async (request) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(app.db, sql`select owner_id from items where id = ${id} and deleted_at is null`)
    if (!item) throw notFound('Fant ikke gjenstanden.')
    if (item['owner_id'] === userId) throw badRequest('own_item', 'Du kan ikke like din egen ting.')

    await app.db.execute(
      sql`insert into likes (from_user, target_item) values (${userId}, ${id})
          on conflict do nothing`,
    )

    const cycles = await findCyclesThrough(app.db, userId, id)
    const opened: string[] = []
    for (const cycle of cycles) {
      // One is enough to celebrate; the rest would fight over the same items.
      opened.push(await openTradeFromCycle(app.db, cycle))
      for (const hop of cycle) {
        await app.db.execute(
          sql`insert into notifications (user_id, type, payload)
              values (${hop.userId}, 'trade_opened',
                      jsonb_build_object('tradeId', ${opened.at(-1)!}::text))`,
        )
      }
      break
    }

    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      values (${item['owner_id']}, 'item_liked',
              jsonb_build_object('itemId', ${id}::text, 'byUserId', ${userId}::text))
    `)

    const counts = await one(
      app.db,
      sql`select (select count(*) from likes where from_user = ${userId}) as liked,
                 (select count(*) from items where owner_id = ${userId} and deleted_at is null) as listed`,
    )

    return {
      liked: true,
      tradeId: opened[0] ?? null,
      // Screen 10a: ten wishes and nothing to give is a dead end, so we say so.
      promptToList:
        Number(counts!['listed']) === 0 &&
        Number(counts!['liked']) >= LIKES_BEFORE_LISTING_PROMPT,
      likedCount: Number(counts!['liked']),
    }
  })

  app.delete('/items/:id/like', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await app.db.execute(
      sql`delete from likes where from_user = ${userId} and target_item = ${id}`,
    )
    reply.code(204)
  })

  app.get('/me/likes', async (request) => {
    const userId = app.requireUser(request)
    const rows = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover, true as liked_by_me
          from likes l join items i on i.id = l.target_item
          where l.from_user = ${userId} and i.deleted_at is null
          order by l.created_at desc`,
    )
    return { items: rows.map(publicItem) }
  })

  // Screen 12: your things, each with the people who liked it, so you can look
  // at what they have and close the loop from the other side.
  app.get('/me/liked-by', async (request) => {
    const userId = app.requireUser(request)

    const items = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover,
                 (select count(*) from likes l where l.target_item = i.id) as like_count
          from items i where i.owner_id = ${userId} and i.deleted_at is null
          order by like_count desc, i.created_at desc`,
    )

    const out = []
    for (const item of items) {
      const likers = await many(
        app.db,
        sql`select u.*, (select count(*) from items i2
                         where i2.owner_id = u.id and i2.deleted_at is null
                           and i2.status = 'available') as item_count
            from likes l join users u on u.id = l.from_user
            where l.target_item = ${item['id']}
            order by l.created_at desc`,
      )
      out.push({ item: publicItem(item), likers: likers.map(publicUser) })
    }
    return { items: out }
  })
}
