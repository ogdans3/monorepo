import { sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { CATEGORIES, CONDITIONS, MAX_VALUE_NOK } from '../lib/constants.js'
import { notHiddenFrom } from '../lib/hidden.js'
import { coverSql, many, one } from '../lib/rows.js'
import { publicItem } from './serialize.js'

// Typed into 05b's two boxes. Past what any listing can be worth a filter
// can only find nothing, and past what an `int` holds it was a 500.
const valueFilter = z.coerce
  .number()
  .int()
  .min(0)
  .max(MAX_VALUE_NOK, 'Verdien kan være høyst 10 000 000 kr.')
  .optional()

const query = z.object({
  q: z.string().max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().max(60).optional(),
  minValue: valueFilter,
  maxValue: valueFilter,
  condition: z.enum(CONDITIONS).optional(),
  sort: z.enum(['newest', 'nearest', 'value']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  // Bounded for the same reason: an offset past a bigint was a 500 too.
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
})

/**
 * What Oppdag may put in front of [viewer], as a predicate on a listing `i`
 * and its owner `u`. One definition for the page, its rows and the
 * subcategories 05b offers, so that none of them offers what another hides.
 *
 * Your own things never appear, and neither does anything held by a trade,
 * anything already traded, anything from someone either of you blocked, or
 * anything of a kind you asked not to be shown.
 *
 * Nor anything of the test tooling's accounts but your own admin's set. Test
 * accounts are real rows in the same database a deployment serves, so without
 * this a stranger hearts a test drill, a real trade opens between them, and
 * from that moment neither reset nor delete may touch it — it is somebody's
 * history. Written here and nowhere else: `/items/:id` and `/users/:id` are
 * reached by a link or an id somebody already has.
 *
 * And the other way round: a test account is shown its own ring and nothing
 * else — its admin's listings and the admin's other test accounts'. A heart
 * from one on a real person's listing is refused (`test_ring`), so a real
 * listing on its Oppdag is a card whose one button says no. The admin's own
 * Oppdag is everybody's plus their ring, as before.
 */
function shownTo(viewer: string | null): SQL {
  // The admin a test account was born to, or null for everybody else.
  const ring = sql`(select x.test_account_of from users x where x.id = ${viewer})`
  // The viewer, if they hold the key, whose own ring they may see.
  const admin = sql`(select x.id from users x where x.id = ${viewer} and x.is_admin)`
  return sql`i.deleted_at is null
    and i.status = 'available'
    and i.active_trade_id is null
    and (${viewer}::uuid is null or i.owner_id <> ${viewer})
    and (case when ${ring} is not null
              then (u.id = ${ring} or u.test_account_of = ${ring})
              else (u.test_account_of is null or u.test_account_of = ${admin}) end)
    and not exists (
      select 1 from blocks b
      where (b.blocker = ${viewer} and b.blocked = i.owner_id)
         or (b.blocker = i.owner_id and b.blocked = ${viewer}))
    and ${notHiddenFrom(viewer, 'i')}`
}

export default async function discoveryRoutes(app: FastifyInstance) {
  // Screen 05. One page under Discover's name, with the search page's
  // behaviour: the field is always there, and before a search the rows come
  // from the interests picked at first run.
  app.get('/discover', async (request) => {
    const viewer = request.userId
    const args = query.parse(request.query)

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

    // What the page may show, whichever way the words were matched: only the
    // match is different. A subcategory is whatever its lister typed, so it
    // is compared the way 05b groups it and hiding compares it, without
    // regard to case.
    const base = (match: SQL) => sql`
      from items i
      join users u on u.id = i.owner_id
      where ${shownTo(viewer ?? null)}
        and ${match}
        and (${args.category ?? null}::category is null or i.category = ${args.category ?? null}::category)
        and (${args.subcategory ?? null}::text is null
             or lower(i.subcategory) = lower(${args.subcategory ?? null}))
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
            where ${shownTo(viewer)} and i.category = ${c}::category
            order by i.created_at desc, i.id limit 12`,
      )
      rows.push({ category: c, items: items.map(publicItem) })
    }
    return { rows }
  })

  // Screen 05b lists the subcategories that actually exist under a category,
  // rather than a hard-coded taxonomy nobody maintains — of the listings
  // Oppdag would show this viewer, and only those. Offered one that only
  // their own things, a reserved one, a blocked person's or a kind they hid
  // carries, the search found nothing and said «Vis 0 treff» about a word
  // that was right there in the list.
  //
  // One kind once, however it was typed: «Elsykler» and «elsykler» are the
  // same thing listed by two people, in the spelling most of them used (and
  // on a tie the one with the capital, which sorts first byte by byte). A
  // subcategory emptied to '' by an edit is no subcategory.
  app.get('/discover/subcategories', async (request) => {
    const { category } = z.object({ category: z.enum(CATEGORIES) }).parse(request.query)
    const rows = await many<{ subcategory: string }>(
      app.db,
      sql`select mode() within group (order by i.subcategory collate "C") as subcategory
          from items i
          join users u on u.id = i.owner_id
          where ${shownTo(request.userId ?? null)}
            and i.category = ${category}::category
            and btrim(coalesce(i.subcategory, '')) <> ''
          group by lower(i.subcategory)
          order by lower(i.subcategory)`,
    )
    return { subcategories: rows.map((r) => r['subcategory']) }
  })
}
