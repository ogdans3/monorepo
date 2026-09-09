import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { CATEGORIES, CONDITIONS } from '../lib/constants.js'
import { coverSql, many, one } from '../lib/rows.js'
import { publicItem } from './serialize.js'

const query = z.object({
  q: z.string().max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().max(60).optional(),
  minValue: z.coerce.number().int().min(0).optional(),
  maxValue: z.coerce.number().int().min(0).optional(),
  condition: z.enum(CONDITIONS).optional(),
  sort: z.enum(['newest', 'nearest', 'value']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
})

export default async function discoveryRoutes(app: FastifyInstance) {
  // Screen 05. One page under Discover's name, with the search page's
  // behaviour: the field is always there, and before a search the rows come
  // from the interests picked at first run.
  app.get('/discover', async (request) => {
    const viewer = request.userId
    const args = query.parse(request.query)

    // Your own things never appear, and neither does anything held by a trade,
    // anything already traded, or anything from someone either of you blocked.
    const base = sql`
      from items i
      join users u on u.id = i.owner_id
      where i.deleted_at is null
        and i.status = 'available'
        and i.active_trade_id is null
        and (${viewer ?? null}::uuid is null or i.owner_id <> ${viewer ?? null})
        and not exists (
          select 1 from blocks b
          where (b.blocker = ${viewer ?? null} and b.blocked = i.owner_id)
             or (b.blocker = i.owner_id and b.blocked = ${viewer ?? null})
        )
        and (${args.q ?? null}::text is null
             or i.search @@ plainto_tsquery('norwegian', ${args.q ?? null})
             or ${args.q ?? null} <% i.title)
        and (${args.category ?? null}::category is null or i.category = ${args.category ?? null}::category)
        and (${args.subcategory ?? null}::text is null or i.subcategory = ${args.subcategory ?? null})
        and (${args.minValue ?? null}::int is null or i.estimated_value_nok >= ${args.minValue ?? null})
        and (${args.maxValue ?? null}::int is null or i.estimated_value_nok <= ${args.maxValue ?? null})
        and (${args.condition ?? null}::condition is null or i.condition = ${args.condition ?? null}::condition)
    `

    const order =
      args.sort === 'value'
        ? sql.raw('order by i.estimated_value_nok asc nulls last')
        : args.sort === 'nearest'
          ? sql.raw('order by (i.town is distinct from (select town from users where id = $viewer)) asc, i.created_at desc')
          : sql.raw('order by i.created_at desc')

    const counted = await one<{ n: string }>(app.db, sql`select count(*) as n ${base}`)
    const n = counted?.['n'] ?? '0'

    const rows = await many(
      app.db,
      args.sort === 'nearest'
        ? sql`select i.*, ${coverSql('i')} as cover,
                     exists (select 1 from likes l where l.target_item = i.id
                             and l.from_user = ${viewer ?? null}) as liked_by_me
              ${base}
              order by (u.town is distinct from (select town from users where id = ${viewer ?? null})) asc,
                       i.created_at desc
              limit ${args.limit} offset ${args.offset}`
        : sql`select i.*, ${coverSql('i')} as cover,
                     exists (select 1 from likes l where l.target_item = i.id
                             and l.from_user = ${viewer ?? null}) as liked_by_me
              ${base} ${order} limit ${args.limit} offset ${args.offset}`,
    )

    return { total: Number(n), items: rows.map(publicItem) }
  })

  // The rows shown before anyone has searched: one per interest, in the order
  // the picker put them. Not a ranking model — a filter on a column.
  app.get('/discover/rows', async (request) => {
    const viewer = request.userId
    if (!viewer) return { rows: [] }

    const interests = await many<{ c: string }>(
      app.db,
      sql`select unnest(interests) as c from users where id = ${viewer}`,
    )

    const rows = []
    for (const { c } of interests) {
      const items = await many(
        app.db,
        sql`select i.*, ${coverSql('i')} as cover,
                   exists (select 1 from likes l where l.target_item = i.id
                           and l.from_user = ${viewer}) as liked_by_me
            from items i
            where i.deleted_at is null and i.status = 'available' and i.active_trade_id is null
              and i.category = ${c}::category and i.owner_id <> ${viewer}
              and not exists (select 1 from blocks b
                where (b.blocker = ${viewer} and b.blocked = i.owner_id)
                   or (b.blocker = i.owner_id and b.blocked = ${viewer}))
            order by i.created_at desc limit 12`,
      )
      rows.push({ category: c, items: items.map(publicItem) })
    }
    return { rows }
  })

  // Screen 05b lists the subcategories that actually exist under a category,
  // rather than a hard-coded taxonomy nobody maintains.
  app.get('/discover/subcategories', async (request) => {
    const { category } = z.object({ category: z.enum(CATEGORIES) }).parse(request.query)
    const rows = await many<{ subcategory: string }>(
      app.db,
      sql`select distinct subcategory from items
          where category = ${category}::category and subcategory is not null
            and deleted_at is null
          order by subcategory`,
    )
    return { subcategories: rows.map((r) => r['subcategory']) }
  })
}
