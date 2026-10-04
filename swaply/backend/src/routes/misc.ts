import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { ApiError, badRequest, conflict, notFound } from '../lib/errors.js'
import { iso, many, one, textArray } from '../lib/rows.js'
import { agreedTradeInTheWay, blockAndEnd, participantOf } from '../trades/actions.js'
import { sweepForCycles } from '../trades/sweep.js'

export default async function miscRoutes(app: FastifyInstance) {
  // Screen 12a. The payload is ids; the words are assembled by the client, so a
  // push through Google or Apple never carries somebody's name.
  app.get('/notifications', async (request) => {
    const userId = app.requireUser(request)
    const rows = await many(
      app.db,
      sql`select * from notifications where user_id = ${userId}
          order by created_at desc limit 100`,
    )

    const hydrated = []
    for (const row of rows) {
      const payload = (row['payload'] ?? {}) as Record<string, string>
      const actor = payload['byUserId']
        ? await one(app.db, sql`select display_name from users where id = ${payload['byUserId']}`)
        : null
      const item = payload['itemId']
        ? await one(app.db, sql`select title from items where id = ${payload['itemId']}`)
        : null
      hydrated.push({
        id: row['id'],
        type: row['type'],
        payload,
        actorName: actor?.['display_name'] ?? null,
        itemTitle: item?.['title'] ?? null,
        readAt: iso(row['read_at']),
        createdAt: iso(row['created_at']),
      })
    }
    return {
      notifications: hydrated,
      unread: hydrated.filter((n) => !n.readAt).length,
    }
  })

  app.post('/notifications/read', async (request, reply) => {
    const userId = app.requireUser(request)
    await app.db.execute(
      sql`update notifications set read_at = now() where user_id = ${userId} and read_at is null`,
    )
    reply.code(204)
  })

  // Screen 06h / 07l. Rating a chain means rating two people, so the trade id
  // and the ratee together are the key.
  app.post('/trades/:id/reviews', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z
      .object({
        ratee: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        // `.nullish()`, not `.optional()`: a person who gives four stars and no
        // words is the ordinary case, and a client with nothing to put in a
        // field sends `comment: null`, because that is what encoding an absent
        // string produces. Refusing it made «Send vurdering» demand a sentence
        // — and answer in English while it did.
        comment: z.string().max(1000).nullish(),
        chips: z.array(z.string().max(40)).max(5).default([]),
      })
      .parse(request.body)

    await participantOf(app.db, id, userId)
    await participantOf(app.db, id, body.ratee)
    if (body.ratee === userId) throw badRequest('self_review', 'Du kan ikke vurdere deg selv.')

    // Both kinds of feedback come after a completed trade — 06h off 09h, 07l
    // for the chain we were not part of. A rating given before anything
    // happened is a rating of nothing, and it moves the number the whole trust
    // model leans on.
    const trade = await one(app.db, sql`select state from trades where id = ${id}`)
    if (trade?.['state'] !== 'completed') {
      throw conflict('not_completed', 'Du kan vurdere når byttet er gjennomført.')
    }

    // The chips are the person's own words on the way in — «Møtte ikke opp» —
    // so they travel as a parameter. Building the array literal by hand put a
    // quote from a user straight into the statement.
    await app.db.execute(sql`
      insert into reviews (trade_id, rater, ratee, score, comment, chips)
      values (${id}, ${userId}, ${body.ratee}, ${body.score}, ${body.comment ?? null},
              ${textArray(body.chips)})
      on conflict (trade_id, rater, ratee)
      do update set score = excluded.score, comment = excluded.comment, chips = excluded.chips
    `)

    // The profile rating is the aggregate, recomputed rather than incremented so
    // an edited review cannot drift it.
    await app.db.execute(sql`
      update users set
        rating_avg = (select round(avg(score)::numeric, 2) from reviews where ratee = ${body.ratee}),
        rating_count = (select count(*) from reviews where ratee = ${body.ratee})
      where id = ${body.ratee}
    `)

    reply.code(201)
    return { ok: true }
  })

  // Screen 06i, which is about us and not about the counterparty.
  app.post('/feedback', async (request, reply) => {
    const userId = app.requireUser(request)
    const body = z
      .object({
        score: z.number().int().min(1).max(5),
        chips: z.array(z.string().max(40)).max(6).default([]),
        comment: z.string().max(1000).nullish(),
      })
      .parse(request.body)

    await app.db.execute(sql`
      insert into app_feedback (user_id, score, chips, comment)
      values (${userId}, ${body.score}, ${textArray(body.chips)}, ${body.comment ?? null})
    `)
    reply.code(201)
    return { ok: true }
  })

  // Screen 16a. Reporting and blocking are one gesture there, so they are one
  // call here — but two rows, because a block outlives the report.
  app.post('/reports', async (request, reply) => {
    const userId = app.requireUser(request)
    const body = z
      .object({
        targetUser: z.string().uuid().nullish(),
        targetItem: z.string().uuid().nullish(),
        reason: z.enum(['spam', 'inappropriate', 'fraud', 'other']),
        detail: z.string().max(1000).nullish(),
        block: z.boolean().default(false),
      })
      .parse(request.body)

    if (!body.targetUser && !body.targetItem) {
      throw badRequest('no_target', 'Velg hva du vil rapportere.')
    }

    let blockTarget = body.targetUser ?? null
    if (!blockTarget && body.targetItem) {
      const item = await one(app.db, sql`select owner_id from items where id = ${body.targetItem}`)
      if (!item) throw notFound('Fant ikke gjenstanden.')
      blockTarget = item['owner_id']
    }

    // The block first, because it can be refused — the two have a trade they
    // have both agreed to (`agreedTradeInTheWay`) — and the sheet is one
    // gesture: refused, nothing is written, and the sheet keeps what was typed
    // for a second press without the tick. Written after a report, a refused
    // block would leave the report in, and that second press would make two.
    if (body.block && blockTarget && blockTarget !== userId) {
      // The same block as `/blocks/:id`, and so the same end to what the two
      // of them were negotiating.
      let freed: string[]
      try {
        freed = await blockAndEnd(app.db, userId, blockTarget)
      } catch (e) {
        if (e instanceof ApiError && e.code === 'agreed_trade') {
          throw agreedTradeInTheWay(
            'Dere har et godtatt bytte på gang, så du kan ikke blokkere ennå. Fjern krysset ' +
              'for å sende rapporten, og blokker når byttet er ferdig eller avsluttet.',
          )
        }
        throw e
      }
      await sweepForCycles(app.db, freed)
    }

    await app.db.execute(sql`
      insert into reports (reporter, target_user, target_item, reason)
      values (${userId}, ${body.targetUser ?? null}, ${body.targetItem ?? null},
              ${body.detail ? `${body.reason}: ${body.detail}` : body.reason})
    `)

    reply.code(201)
    return { ok: true, blocked: body.block }
  })

  app.post('/blocks/:id', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    if (id === userId) throw badRequest('self_block', 'Du kan ikke blokkere deg selv.')

    // A block reaches what is already going on, not only what has yet to
    // start: the negotiations the two share end (`blockAndEnd`), and what
    // they were holding is back on the market for the search.
    await sweepForCycles(app.db, await blockAndEnd(app.db, userId, id))
    reply.code(204)
  })

  app.delete('/blocks/:id', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    await app.db.execute(sql`delete from blocks where blocker = ${userId} and blocked = ${id}`)
    reply.code(204)
  })
}
