import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { badRequest, conflict, notFound } from '../lib/errors.js'
import { coverSql, many, one } from '../lib/rows.js'
import {
  cancelWithdrawalRequest,
  declineTrade,
  markHandover,
  participantOf,
  requestWithdrawal,
  respondToWithdrawal,
  withdrawEarly,
} from '../trades/actions.js'
import { acceptOffer, completeTrade, proposeCounterOffer, startTalking } from '../trades/trades.js'
import { tradeList, tradeView } from '../trades/view.js'
import { publicItem } from './serialize.js'

const idParam = z.object({ id: z.string().uuid() })

export default async function tradeRoutes(app: FastifyInstance) {
  app.get('/trades', async (request) => tradeList(app.db, app.requireUser(request)))

  app.get('/trades/:id', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const view = await tradeView(app.db, id, userId)
    if (!view) throw notFound('Fant ikke byttet.')
    return view
  })

  // Screen 04's message box. Writing is what opens the negotiation, so there is
  // no separate "start a chat" call.
  app.post('/items/:id/message', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const body = z.object({ body: z.string().min(1).max(2000) }).parse(request.body)

    const item = await one(app.db, sql`select owner_id from items where id = ${id} and deleted_at is null`)
    if (!item) throw notFound('Fant ikke gjenstanden.')
    if (item['owner_id'] === userId) throw badRequest('own_item', 'Dette er din egen gjenstand.')

    // One conversation per pair per listing: a second message goes to the same
    // place rather than opening a second trade.
    const existing = await one(
      app.db,
      sql`select t.id from trades t
          join trade_participants me on me.trade_id = t.id and me.user_id = ${userId}
          join trade_participants them on them.trade_id = t.id and them.user_id = ${item['owner_id']}
          join trade_offers o on o.trade_id = t.id
          join trade_offer_items oi on oi.offer_id = o.id and oi.item_id = ${id}
          where t.state not in ('completed', 'cancelled')
          order by t.created_at desc limit 1`,
    )

    if (existing) {
      const thread = await one(app.db, sql`select id from threads where trade_id = ${existing['id']}`)
      await app.db.execute(
        sql`insert into messages (thread_id, sender_id, body)
            values (${thread!['id']}, ${userId}, ${body.body})`,
      )
      reply.code(201)
      return { tradeId: existing['id'], threadId: thread!['id'] }
    }

    const opened = await startTalking(app.db, userId, id, body.body)
    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      values (${item['owner_id']}, 'message', jsonb_build_object('tradeId', ${opened.tradeId}::text))
    `)
    reply.code(201)
    return opened
  })

  // Screen 06c: the swipe at the bottom of the agreement. Everything above it is
  // what the terms version records.
  app.post('/trades/:id/accept', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const body = z.object({ termsVersion: z.string().default('2026-09-06') }).parse(request.body ?? {})

    const view = await tradeView(app.db, id, userId)
    if (!view) throw notFound('Fant ikke byttet.')
    if (!view.offerId) throw conflict('no_offer', 'Det finnes ikke noe forslag å godta.')
    if (['completed', 'cancelled'].includes(view.state)) {
      throw conflict('trade_closed', 'Byttet er avsluttet.')
    }

    const result = await acceptOffer(app.db, view.offerId, userId, body.termsVersion)
    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      select p.user_id, ${result.everyoneAccepted ? 'trade_accepted' : 'trade_partly_accepted'},
             jsonb_build_object('tradeId', ${id}::text)
      from trade_participants p where p.trade_id = ${id} and p.user_id <> ${userId}
    `)
    return { ...result, trade: await tradeView(app.db, id, userId) }
  })

  app.post('/trades/:id/counter', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const body = z
      .object({
        items: z.array(z.object({ itemId: z.string().uuid(), giverPosition: z.number().int().min(0) })).min(1),
        cash: z
          .object({
            payerPosition: z.number().int().min(0),
            payeePosition: z.number().int().min(0),
            amountNok: z.number().int().positive(),
          })
          .nullish(),
      })
      .parse(request.body)

    await participantOf(app.db, id, userId)
    await proposeCounterOffer(app.db, id, userId, body.items, body.cash ?? undefined)

    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      select p.user_id, 'counter_offer', jsonb_build_object('tradeId', ${id}::text)
      from trade_participants p where p.trade_id = ${id} and p.user_id <> ${userId}
    `)
    return tradeView(app.db, id, userId)
  })

  app.post('/trades/:id/decline', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await declineTrade(app.db, id, userId)
    return tradeView(app.db, id, userId)
  })

  app.post('/trades/:id/withdraw-early', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await withdrawEarly(app.db, id, userId)
    return tradeView(app.db, id, userId)
  })

  app.post('/trades/:id/withdrawal', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const result = await requestWithdrawal(app.db, id, userId)
    return { blocked: result.blocked, trade: await tradeView(app.db, id, userId) }
  })

  app.post('/trades/:id/withdrawal/respond', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const { approve } = z.object({ approve: z.boolean() }).parse(request.body)
    const result = await respondToWithdrawal(app.db, id, userId, approve)
    return { ...result, trade: await tradeView(app.db, id, userId) }
  })

  app.delete('/trades/:id/withdrawal', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await cancelWithdrawalRequest(app.db, id, userId)
    return tradeView(app.db, id, userId)
  })

  app.post('/trades/:id/mark', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const body = z
      .object({ marker: z.enum(['sent', 'received', 'paid']), value: z.boolean().default(true) })
      .parse(request.body)

    const result = await markHandover(app.db, id, userId, body.marker, body.value)
    // Everyone has sent and received: it is over, and the snapshot is taken.
    if (result.complete) await completeTrade(app.db, id)
    return { ...result, trade: await tradeView(app.db, id, userId) }
  })

  // «Marker byttet som gjennomført» on screen 07j, where we facilitate nothing
  // and the parties tell us how it went.
  app.post('/trades/:id/complete', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await participantOf(app.db, id, userId)
    await markHandover(app.db, id, userId, 'sent')
    await markHandover(app.db, id, userId, 'received')

    const outstanding = await one(
      app.db,
      sql`select count(*) as n from trade_participants
          where trade_id = ${id} and (sent_at is null or received_at is null)`,
    )
    if (Number(outstanding!['n']) === 0) await completeTrade(app.db, id)
    return tradeView(app.db, id, userId)
  })

  // What screens 09a, 09b, 09c and 09c2 pick from: everything either side could
  // put on the table, with the ones another trade is holding marked as locked.
  app.get('/trades/:id/candidates', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const view = await tradeView(app.db, id, userId)
    if (!view) throw notFound('Fant ikke byttet.')

    const inOffer = new Set([...view.youGive, ...view.youGet].map((i) => i.id))

    const forUser = async (owner: string) => {
      const rows = await many(
        app.db,
        sql`select i.*, ${coverSql('i')} as cover from items i
            where i.owner_id = ${owner} and i.deleted_at is null and i.status <> 'traded'
            order by i.created_at desc`,
      )
      return rows.map((r) => ({
        ...publicItem(r),
        inOffer: inOffer.has(r['id']),
        // «reservert i annet bytte · Låst» on screen 09b.
        lockedByOtherTrade: Boolean(r['active_trade_id']) && r['active_trade_id'] !== id,
      }))
    }

    return {
      yours: await forUser(userId),
      theirs: await forUser(view.receivingFrom.id as string),
      counterparty: view.receivingFrom,
    }
  })
}
