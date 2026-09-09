import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { CATEGORIES, CONDITIONS } from '../lib/constants.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { coverSql, many, one } from '../lib/rows.js'
import { publicItem, publicUser } from './serialize.js'

const itemBody = z.object({
  kind: z.enum(['item', 'service']).default('item'),
  title: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  category: z.enum(CATEGORIES),
  subcategory: z.string().max(60).optional(),
  condition: z.enum(CONDITIONS).optional(),
  estimatedValueNok: z.number().int().min(0).max(10_000_000).optional(),
  postalCode: z.string().regex(/^\d{4}$/).optional(),
  town: z.string().max(60).optional(),
  // Up to ten, first is the cover. A listing with none is allowed: services
  // usually have none, and discovery draws a generated card instead.
  //
  // A photograph is uploaded first and named here by the path `POST /media`
  // gave back. An absolute URL is still accepted: the seed uses made-up ones,
  // and a picture that already lives somewhere is not our business to refuse.
  media: z
    .array(
      z
        .string()
        .refine(
          (v) => /^\/media\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(v) || /^https?:\/\//.test(v),
          'Ukjent bilde.',
        ),
    )
    .max(10)
    .default([]),
})

export default async function itemRoutes(app: FastifyInstance) {
  app.post('/items', async (request, reply) => {
    // 10c stands between looking around and listing something: a thing on the
    // market has to belong to somebody with a name.
    const userId = app.requireClaimedUser(request)
    const body = itemBody.parse(request.body)

    if (body.kind === 'item' && !body.condition) {
      throw badRequest('condition_required', 'Velg tilstand for gjenstanden.')
    }

    const owner = await one(app.db, sql`select town, postal_code from users where id = ${userId}`)

    const item = await one(
      app.db,
      sql`insert into items (owner_id, kind, title, description, category, subcategory,
                            condition, estimated_value_nok, town)
          values (${userId}, ${body.kind}, ${body.title}, ${body.description ?? null},
                  ${body.category}, ${body.subcategory ?? null},
                  ${body.kind === 'service' ? null : body.condition!},
                  ${body.estimatedValueNok ?? null},
                  ${body.town ?? owner?.['town'] ?? null})
          returning *`,
    )

    for (const [position, url] of body.media.entries()) {
      await app.db.execute(
        sql`insert into item_media (item_id, url, position)
            values (${item!['id']}, ${url}, ${position})`,
      )
    }

    reply.code(201)
    return publicItem({ ...item!, cover: body.media[0] ?? null, media: body.media })
  })

  app.get('/items/:id', async (request) => {
    const viewer = request.userId
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover,
                 exists (select 1 from likes l
                         where l.target_item = i.id and l.from_user = ${viewer ?? null}) as liked_by_me,
                 (select count(*) from likes l where l.target_item = i.id) as like_count
          from items i where i.id = ${id} and i.deleted_at is null`,
    )
    if (!item) throw notFound('Fant ikke gjenstanden.')

    const media = await many(
      app.db,
      sql`select url from item_media where item_id = ${id} order by position`,
    )
    const owner = await one(
      app.db,
      sql`select u.*, (select count(*) from items i2
                       where i2.owner_id = u.id and i2.deleted_at is null) as item_count,
                 (select count(*) from trade_participants p
                  join trades t on t.id = p.trade_id
                  where p.user_id = u.id and t.state = 'completed') as trade_count
          from users u where u.id = ${item['owner_id']}`,
    )

    return {
      ...publicItem({ ...item, media: media.map((m) => m['url']) }),
      owner: publicUser(owner!),
    }
  })

  app.patch('/items/:id', async (request) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = itemBody.partial().parse(request.body)

    const existing = await one(app.db, sql`select owner_id, active_trade_id from items where id = ${id}`)
    if (!existing) throw notFound('Fant ikke gjenstanden.')
    if (existing['owner_id'] !== userId) throw forbidden('Dette er ikke din gjenstand.')
    if (existing['active_trade_id']) {
      throw badRequest('item_reserved', 'Gjenstanden er reservert i et bytte og kan ikke endres.')
    }

    const item = await one(
      app.db,
      sql`update items set
            title = coalesce(${body.title ?? null}, title),
            description = coalesce(${body.description ?? null}, description),
            category = coalesce(${body.category ?? null}::category, category),
            subcategory = coalesce(${body.subcategory ?? null}, subcategory),
            condition = coalesce(${body.condition ?? null}::condition, condition),
            estimated_value_nok = coalesce(${body.estimatedValueNok ?? null}, estimated_value_nok),
            town = coalesce(${body.town ?? null}, town)
          where id = ${id} returning *`,
    )

    if (body.media) {
      await app.db.execute(sql`delete from item_media where item_id = ${id}`)
      for (const [position, url] of body.media.entries()) {
        await app.db.execute(
          sql`insert into item_media (item_id, url, position) values (${id}, ${url}, ${position})`,
        )
      }
    }

    // Read the photos back rather than echoing the row: the row does not carry
    // them, and a client that has just added one should not be told there is
    // none.
    const media = await many(
      app.db,
      sql`select url from item_media where item_id = ${id} order by position`,
    )
    return publicItem({
      ...item!,
      cover: media[0]?.['url'] ?? null,
      media: media.map((m) => m['url']),
    })
  })

  // Retired, never removed: a listing that has been in an offer is part of a
  // record somebody else may need.
  app.delete('/items/:id', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(app.db, sql`select owner_id, active_trade_id from items where id = ${id}`)
    if (!item) throw notFound('Fant ikke gjenstanden.')
    if (item['owner_id'] !== userId) throw forbidden('Dette er ikke din gjenstand.')
    if (item['active_trade_id']) {
      throw badRequest('item_reserved', 'Gjenstanden er reservert i et bytte.')
    }

    await app.db.execute(
      sql`update items set deleted_at = now(), status = 'withdrawn' where id = ${id}`,
    )
    reply.code(204)
  })
}
