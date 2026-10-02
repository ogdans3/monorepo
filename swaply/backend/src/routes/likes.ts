import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { sameRing } from '../trades/ring.js'
import { expressWish } from '../trades/wish.js'
import { coverSql, many } from '../lib/rows.js'
import { publicItem, publicUser } from './serialize.js'

export default async function likeRoutes(app: FastifyInstance) {
  // The heart. This is the directed edge, and the only thing that can close a
  // loop, so it runs the cycle search on the spot rather than on a schedule.
  // The work itself is in `trades/wish.ts`, because the test tooling presses
  // the same button and there must be exactly one path from a wish to a trade.
  app.post('/items/:id/like', async (request) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const wish = await expressWish(app.db, userId, id, {
      searchFailed: (err) => request.log.warn({ err, itemId: id }, 'loop search after a heart failed'),
    })
    return { liked: true, ...wish }
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

    // Who is shown liking your things, and so counted beside them: a test
    // account is not shown to anybody outside its ring, nor anybody outside
    // to it (`trades/ring.ts`), and nobody is shown across a block, either
    // way. The heart refuses both now, but likes made before a block — or
    // before the ring rule — are still in the table, and a block hides both
    // ways on every surface (`lib/blocks.ts`).
    const shown = sql`${sameRing(sql`${userId}::uuid`, sql`l.from_user`)}
      and not exists (select 1 from blocks b
                      where (b.blocker = ${userId} and b.blocked = l.from_user)
                         or (b.blocker = l.from_user and b.blocked = ${userId}))`

    const items = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover,
                 (select count(*) from likes l where l.target_item = i.id and ${shown}) as like_count
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
            where l.target_item = ${item['id']} and ${shown}
            order by l.created_at desc`,
      )
      out.push({
        item: publicItem(item),
        likers: likers.map((u) => ({
          ...publicUser(u),
          // A device looking around, with no profile yet: there is nobody to
          // write to and nothing of theirs to want back, so 12 cannot offer
          // to close the loop from this side.
          anonymous: u['email'] === null,
        })),
      })
    }
    return { items: out }
  })
}
