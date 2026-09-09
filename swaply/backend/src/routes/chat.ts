import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { forbidden, notFound } from '../lib/errors.js'
import { iso, many, one } from '../lib/rows.js'
import { publicMessage } from './serialize.js'

const idParam = z.object({ id: z.string().uuid() })

async function seatIn(app: FastifyInstance, threadId: string, userId: string) {
  const seat = await one(
    app.db,
    sql`select * from thread_participants where thread_id = ${threadId} and user_id = ${userId}`,
  )
  if (!seat) throw forbidden('Du er ikke med i denne samtalen.')
  return seat
}

export default async function chatRoutes(app: FastifyInstance) {
  // Screen 11a. One row per conversation, with what the trade is about
  // underneath the last message, because that is how you tell them apart.
  app.get('/threads', async (request) => {
    const userId = app.requireUser(request)

    const rows = await many(
      app.db,
      sql`
      select th.id, th.trade_id, t.state,
             (select count(*) from trade_participants p where p.trade_id = t.id) as party_size,
             (select json_agg(json_build_object('id', u.id, 'displayName', u.display_name))
              from trade_participants p join users u on u.id = p.user_id
              where p.trade_id = t.id and p.user_id <> ${userId}) as others,
             m.body as last_body, m.created_at as last_at, m.sender_id as last_sender,
             (select count(*) from messages mm
              where mm.thread_id = th.id and mm.sender_id <> ${userId}
                and (tp.last_read_message_id is null
                     or mm.created_at > (select created_at from messages
                                         where id = tp.last_read_message_id))) as unread,
             (select string_agg(i.title, ' ⇄ ' order by oi.giver_position)
              from trade_offers o
              join trade_offer_items oi on oi.offer_id = o.id
              join items i on i.id = oi.item_id
              where o.trade_id = t.id
                and o.seq = (select max(seq) from trade_offers where trade_id = t.id)) as subject
      from threads th
      join thread_participants tp on tp.thread_id = th.id and tp.user_id = ${userId}
      join trades t on t.id = th.trade_id
      left join lateral (
        select * from messages where thread_id = th.id order by created_at desc limit 1
      ) m on true
      order by coalesce(m.created_at, t.created_at) desc`,
    )

    return {
      threads: rows.map((r) => ({
        id: r['id'],
        tradeId: r['trade_id'],
        state: r['state'],
        kind: Number(r['party_size']) > 2 ? 'chain' : 'direct',
        others: r['others'] ?? [],
        subject: r['subject'],
        unread: Number(r['unread'] ?? 0),
        lastMessage: r['last_body']
          ? { body: r['last_body'], mine: r['last_sender'] === userId, createdAt: iso(r['last_at']) }
          : null,
      })),
      unreadTotal: rows.reduce((total, r) => total + Number(r['unread'] ?? 0), 0),
    }
  })

  // Screens 06g and 07k. The chain thread carries a banner that cannot be
  // dismissed, because the trade it belongs to is one we do not facilitate.
  app.get('/threads/:id', async (request) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await seatIn(app, id, userId)

    const thread = await one(
      app.db,
      sql`select th.*, t.state, t.id as trade_id from threads th
          join trades t on t.id = th.trade_id where th.id = ${id}`,
    )
    if (!thread) throw notFound('Fant ikke samtalen.')

    const messages = await many(
      app.db,
      sql`select m.*, u.display_name as sender_name,
                 (m.sender_id = ${userId}) as mine
          from messages m join users u on u.id = m.sender_id
          where m.thread_id = ${id} order by m.created_at`,
    )
    const participants = await many(
      app.db,
      sql`select u.id, u.display_name, p.position from trade_participants p
          join users u on u.id = p.user_id
          where p.trade_id = ${thread['trade_id']} order by p.position`,
    )
    const readMarks = await many(
      app.db,
      sql`select user_id, last_read_message_id from thread_participants where thread_id = ${id}`,
    )

    return {
      id: thread['id'],
      tradeId: thread['trade_id'],
      state: thread['state'],
      kind: participants.length > 2 ? 'chain' : 'direct',
      // Screen 07k, verbatim and not closeable.
      banner:
        participants.length > 2
          ? 'Swaply fasiliterer ikke dette byttet. Dere avtaler overlevering, mellomlegg og eventuell frakt selv i denne chatten.'
          : null,
      participants: participants.map((p) => ({
        id: p['id'],
        displayName: p['display_name'],
        position: Number(p['position']),
      })),
      messages: messages.map(publicMessage),
      readBy: readMarks.map((r) => ({
        userId: r['user_id'],
        lastReadMessageId: r['last_read_message_id'],
      })),
    }
  })

  app.post('/threads/:id/messages', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    const body = z.object({ body: z.string().min(1).max(2000) }).parse(request.body)
    await seatIn(app, id, userId)

    const message = await one(
      app.db,
      sql`insert into messages (thread_id, sender_id, body)
          values (${id}, ${userId}, ${body.body}) returning *`,
    )
    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      select tp.user_id, 'message', jsonb_build_object('threadId', ${id}::text)
      from thread_participants tp where tp.thread_id = ${id} and tp.user_id <> ${userId}
    `)

    reply.code(201)
    return publicMessage({ ...message!, mine: true })
  })

  app.post('/threads/:id/read', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = idParam.parse(request.params)
    await seatIn(app, id, userId)

    await app.db.execute(sql`
      update thread_participants set last_read_message_id =
        (select id from messages where thread_id = ${id} order by created_at desc limit 1)
      where thread_id = ${id} and user_id = ${userId}
    `)
    reply.code(204)
  })
}
