import { sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { CATEGORIES, CONDITIONS } from '../lib/constants.js'
import { notHiddenFrom } from '../lib/hidden.js'
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

    // What an account may see of the test tooling's accounts: its own admin's
    // set, or nothing. Test accounts are real rows in the same database a
    // deployment serves, so without this a stranger hearts a test drill, a real
    // trade opens between them, and from that moment neither reset nor delete
    // may touch it — it is somebody's history. Written once here and once in
    // the rows below, and nowhere else: `/items/:id` and `/users/:id` are
    // reached by a link or an id somebody already has.
    const scope = sql`(select case when x.is_admin then x.id else x.test_account_of end
                       from users x where x.id = ${viewer ?? null})`

    // What was searched for, asked two ways. The first is the search DESIGN
    // describes: the Norwegian stems of the title and the description, and
    // the title's trigrams at pg_trgm's own threshold (0.6), which is what
    // finds «terrengsykel». A slip in a short word scores below that —
    // «drll» and «boch» against «Bosch drill 18V» are 0.4, «sykel» against
    // «Sykkelhjelm» 0.5 — and the answer was «Ingen treff» about a drill
    // that was right there. So when the first finds nothing at all, the
    // title is asked again at 0.4. Only then: a search that finds something
    // is not padded out with near misses.
    const q = args.q ?? null
    const exact = sql`(${q}::text is null
             or i.search @@ plainto_tsquery('norwegian', ${q})
             or ${q} <% i.title)`
    const near = sql`word_similarity(${q}, i.title) >= 0.4`

    // Your own things never appear, and neither does anything held by a trade,
    // anything already traded, anything from someone either of you blocked, or
    // anything of a kind you asked not to be shown — whichever way the words
    // were matched, because only the match is different.
    const base = (match: SQL) => sql`
      from items i
      join users u on u.id = i.owner_id
      where i.deleted_at is null
        and (u.test_account_of is null or u.test_account_of = ${scope})
        and i.status = 'available'
        and i.active_trade_id is null
        and (${viewer ?? null}::uuid is null or i.owner_id <> ${viewer ?? null})
        and not exists (
          select 1 from blocks b
          where (b.blocker = ${viewer ?? null} and b.blocked = i.owner_id)
             or (b.blocker = i.owner_id and b.blocked = ${viewer ?? null})
        )
        and ${notHiddenFrom(viewer ?? null, 'i')}
        and ${match}
        and (${args.category ?? null}::category is null or i.category = ${args.category ?? null}::category)
        and (${args.subcategory ?? null}::text is null or i.subcategory = ${args.subcategory ?? null})
        and (${args.minValue ?? null}::int is null or i.estimated_value_nok >= ${args.minValue ?? null})
        and (${args.maxValue ?? null}::int is null or i.estimated_value_nok <= ${args.maxValue ?? null})
        and (${args.condition ?? null}::condition is null or i.condition = ${args.condition ?? null}::condition)
    `

    // The first personalisation in the product, and the only one: with nothing
    // searched for and no category picked, the categories chosen on screen 02
    // come first. Not a ranking model — a boolean on a column, and the rest of
    // the page is the same collage for everybody.
    //
    // It sits here rather than in the chip row above it because round 5 draws
    // that row in a fixed order for somebody whose interests are a different
    // three, and the export is the authority for what a screen says.
    const personal =
      viewer && !args.q && !args.category && args.sort === 'newest'
        ? sql`(i.category = any (coalesce(
             (select u2.interests from users u2 where u2.id = ${viewer}::uuid),
             '{}'::category[]))) desc,`
        : sql``

    // «Nærmest» needs the viewer's town, so it is written out below with the
    // rest of the query rather than as a fragment with a placeholder in it.
    // Where a thing is, is the listing's own town — the postcode typed on 10b
    // — and only without one its owner's: a drill kept at the cabin is at
    // the cabin. Same town first, and the rest newest first, as it always
    // was; for somebody who has not said where they are, that is all of it.
    //
    // Every order ends on the id. A page is an offset into the order, and
    // listings that tie on everything before it — one value, one town, one
    // moment — came back in whatever order the plan liked that time, so the
    // next page could repeat one and never show another.
    const order =
      args.sort === 'value'
        ? sql`order by i.estimated_value_nok asc nulls last, i.id`
        : sql`order by ${personal} i.created_at desc, i.id`

    const count = async (from: SQL) =>
      Number((await one<{ n: string }>(app.db, sql`select count(*) as n ${from}`))?.['n'] ?? 0)
    let from = base(exact)
    let n = await count(from)
    if (q && n === 0) {
      from = base(near)
      n = await count(from)
    }

    const rows = await many(
      app.db,
      args.sort === 'nearest'
        ? sql`select i.*, ${coverSql('i')} as cover,
                     exists (select 1 from likes l where l.target_item = i.id
                             and l.from_user = ${viewer ?? null}) as liked_by_me
              ${from}
              order by (lower(coalesce(nullif(i.town, ''), nullif(u.town, ''))) =
                        (select lower(nullif(v.town, '')) from users v
                         where v.id = ${viewer ?? null})) is true desc,
                       i.created_at desc, i.id
              limit ${args.limit} offset ${args.offset}`
        : sql`select i.*, ${coverSql('i')} as cover,
                     exists (select 1 from likes l where l.target_item = i.id
                             and l.from_user = ${viewer ?? null}) as liked_by_me
              ${from} ${order} limit ${args.limit} offset ${args.offset}`,
    )

    return { total: n, items: rows.map(publicItem) }
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
            join users u on u.id = i.owner_id
            where i.deleted_at is null and i.status = 'available' and i.active_trade_id is null
              and i.category = ${c}::category and i.owner_id <> ${viewer}
              and (u.test_account_of is null
                   or u.test_account_of = (select case when x.is_admin then x.id
                                                       else x.test_account_of end
                                           from users x where x.id = ${viewer}))
              and not exists (select 1 from blocks b
                where (b.blocker = ${viewer} and b.blocked = i.owner_id)
                   or (b.blocker = i.owner_id and b.blocked = ${viewer}))
              and ${notHiddenFrom(viewer, 'i')}
            order by i.created_at desc, i.id limit 12`,
      )
      rows.push({ category: c, items: items.map(publicItem) })
    }
    return { rows }
  })

  // Screen 05b lists the subcategories that actually exist under a category,
  // rather than a hard-coded taxonomy nobody maintains. Less the kinds this
  // viewer asked not to be shown: offered one, the search found nothing and
  // said «Vis 0 treff» about a word that was right there in the list.
  app.get('/discover/subcategories', async (request) => {
    const { category } = z.object({ category: z.enum(CATEGORIES) }).parse(request.query)
    const rows = await many<{ subcategory: string }>(
      app.db,
      sql`select distinct i.subcategory from items i
          where i.category = ${category}::category and i.subcategory is not null
            and i.deleted_at is null
            and ${notHiddenFrom(request.userId ?? null, 'i')}
          order by i.subcategory`,
    )
    return { subcategories: rows.map((r) => r['subcategory']) }
  })
}
