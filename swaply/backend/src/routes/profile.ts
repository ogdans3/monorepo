import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { CATEGORIES } from '../lib/constants.js'
import { badRequest, notFound } from '../lib/errors.js'
import { coverSql, many, one } from '../lib/rows.js'
import { publicItem, publicMe, publicUser } from './serialize.js'

export default async function profileRoutes(app: FastifyInstance) {
  // Screen 13, and 17c when it is empty.
  app.get('/me', async (request) => {
    const userId = app.requireUser(request)
    const user = await one(app.db, sql`select * from users where id = ${userId}`)
    const items = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover from items i
          where i.owner_id = ${userId} and i.deleted_at is null
          order by i.created_at desc`,
    )
    const likedBy = await one(
      app.db,
      sql`select count(*) as n from likes l join items i on i.id = l.target_item
          where i.owner_id = ${userId}`,
    )
    const unread = await one(
      app.db,
      sql`select count(*) as n from messages m
          join thread_participants tp on tp.thread_id = m.thread_id and tp.user_id = ${userId}
          where m.sender_id <> ${userId}
            and (tp.last_read_message_id is null
                 or m.created_at > (select created_at from messages where id = tp.last_read_message_id))`,
    )
    const yourTurn = await one(
      app.db,
      sql`select count(*) as n from trades t
          join trade_participants p on p.trade_id = t.id and p.user_id = ${userId}
          where t.state in ('pending', 'countered')
            and not exists (
              select 1 from trade_acceptances a
              join trade_offers o on o.id = a.offer_id
              where o.trade_id = t.id and a.user_id = ${userId} and a.revoked_at is null
                and o.seq = (select max(seq) from trade_offers where trade_id = t.id))`,
    )

    return {
      ...publicMe(user!),
      items: items.map(publicItem),
      likedByCount: Number(likedBy!['n']),
      unreadMessages: Number(unread!['n']),
      tradesNeedingYou: Number(yourTurn!['n']),
    }
  })

  app.patch('/me', async (request) => {
    const userId = app.requireUser(request)
    const body = z
      .object({
        displayName: z.string().min(1).max(60).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(6).max(20).nullish(),
        town: z.string().max(60).optional(),
        postalCode: z.string().regex(/^\d{4}$/).optional(),
      })
      .parse(request.body)

    const user = await one(
      app.db,
      sql`update users set
            display_name = coalesce(${body.displayName ?? null}, display_name),
            email = coalesce(${body.email ?? null}, email),
            phone = ${body.phone === undefined ? sql`phone` : (body.phone ?? null)},
            town = coalesce(${body.town ?? null}, town),
            postal_code = coalesce(${body.postalCode ?? null}, postal_code)
          where id = ${userId} returning *`,
    )
    return publicMe(user!)
  })

  // Screen 02. Three to five, and the database says so too.
  app.put('/me/interests', async (request) => {
    const userId = app.requireUser(request)
    const { interests } = z
      .object({ interests: z.array(z.enum(CATEGORIES)).min(3).max(5) })
      .parse(request.body)

    if (new Set(interests).size !== interests.length) {
      throw badRequest('duplicate_interests', 'Du kan ikke velge samme kategori to ganger.')
    }

    const user = await one(
      app.db,
      sql`update users set interests = ${sql.raw(`'{${interests.join(',')}}'::category[]`)}
          where id = ${userId} returning *`,
    )
    return publicMe(user!)
  })

  // Screen 13b: somebody else, with their things, which is the point of it.
  app.get('/users/:id', async (request) => {
    const viewer = request.userId
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const user = await one(
      app.db,
      sql`select u.*,
                 (select count(*) from items i where i.owner_id = u.id and i.deleted_at is null) as item_count,
                 (select count(*) from trade_participants p join trades t on t.id = p.trade_id
                  where p.user_id = u.id and t.state = 'completed') as trade_count
          from users u where u.id = ${id}`,
    )
    if (!user) throw notFound('Fant ikke brukeren.')

    const items = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover,
                 exists (select 1 from likes l where l.target_item = i.id
                         and l.from_user = ${viewer ?? null}) as liked_by_me
          from items i
          where i.owner_id = ${id} and i.deleted_at is null and i.status <> 'traded'
          order by i.created_at desc`,
    )
    const blocked = viewer
      ? await one(app.db, sql`select 1 from blocks where blocker = ${viewer} and blocked = ${id}`)
      : null

    return {
      ...publicUser(user),
      interests: user['interests'] ?? [],
      items: items.map(publicItem),
      blockedByYou: Boolean(blocked),
    }
  })
}
