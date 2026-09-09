import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { coverSql, iso, many, num, one } from '../lib/rows.js'
import { publicItem, publicUser } from '../routes/serialize.js'

/**
 * Everything the trade screens render, from one viewer's point of view.
 *
 * The screens are written in the second person — «DU FÅR», «DU GIR», «OLA GIR» —
 * so the server does the position arithmetic once rather than every client
 * doing it slightly differently. Position p gives to p+1 and receives from p-1.
 */
export async function tradeView(db: Database, tradeId: string, viewerId: string) {
  const trade = await one(db, sql`select * from trades where id = ${tradeId}`)
  if (!trade) return null

  const participants = await many(
    db,
    // `p.*` has no id of its own, so the user's has to be named explicitly or
    // every serialised participant comes back without one.
    sql`select p.*, u.id as id, u.display_name, u.town, u.phone, u.rating_avg,
               u.rating_count, u.bankid_verified_at, u.created_at
        from trade_participants p join users u on u.id = p.user_id
        where p.trade_id = ${tradeId} order by p.position`,
  )
  const me = participants.find((p) => p['user_id'] === viewerId)
  if (!me) return null

  const n = participants.length
  const myPos = Number(me['position'])
  const at = (pos: number) => participants[((pos % n) + n) % n]!

  const offer = await one(
    db,
    sql`select * from trade_offers where trade_id = ${tradeId} order by seq desc limit 1`,
  )
  const offerItems = offer
    ? await many(
        db,
        sql`select oi.giver_position, i.*, ${coverSql('i')} as cover
            from trade_offer_items oi join items i on i.id = oi.item_id
            where oi.offer_id = ${offer['id']} order by oi.giver_position, i.title`,
      )
    : []
  const cash = offer
    ? await one(db, sql`select * from trade_offer_cash where offer_id = ${offer['id']}`)
    : null

  const byGiver = (pos: number) =>
    offerItems.filter((i) => Number(i['giver_position']) === pos).map(publicItem)

  const sum = (pos: number) =>
    offerItems
      .filter((i) => Number(i['giver_position']) === pos)
      .reduce((total, i) => total + (num(i['estimated_value_nok']) ?? 0), 0)

  const acceptances = offer
    ? await many(
        db,
        sql`select user_id, accepted_at, revoked_at, terms_version
            from trade_acceptances where offer_id = ${offer['id']}`,
      )
    : []
  const acceptedBy = new Set(
    acceptances.filter((a) => !a['revoked_at']).map((a) => a['user_id'] as string),
  )

  const thread = await one(db, sql`select id from threads where trade_id = ${tradeId}`)
  const lastMessage = thread
    ? await one(
        db,
        sql`select m.*, u.display_name as sender_name from messages m
            join users u on u.id = m.sender_id
            where m.thread_id = ${thread['id']} order by m.created_at desc limit 1`,
      )
    : null

  const withdrawal = await one(
    db,
    sql`select * from trade_withdrawals where trade_id = ${tradeId}
        order by requested_at desc limit 1`,
  )

  const snapshots = await many(
    db,
    sql`select * from trade_item_snapshots where trade_id = ${tradeId} order by giver_position`,
  )

  const myReview = await one(
    db,
    sql`select * from reviews where trade_id = ${tradeId} and rater = ${viewerId} limit 1`,
  )

  // Position travels with the person: the counter-offer screens address items
  // to a seat in the ring, not to a name.
  const giverOf = (pos: number) => ({
    ...publicUser(at(pos)),
    position: Number(at(pos)['position']),
  })

  return {
    id: trade['id'],
    state: trade['state'],
    // Two participants is a swap; three is the chain we cannot facilitate.
    kind: n > 2 ? 'chain' : 'direct',
    closedAt: iso(trade['closed_at']),
    closeReason: trade['close_reason'],
    offerId: offer?.['id'] ?? null,
    offerSeq: offer ? Number(offer['seq']) : null,
    counterOfferBy: offer?.['proposed_by'] ?? null,

    you: {
      userId: viewerId,
      position: myPos,
      accepted: acceptedBy.has(viewerId),
      sentAt: iso(me['sent_at']),
      receivedAt: iso(me['received_at']),
      paidAt: iso(me['paid_at']),
    },
    // In a chain these are two different people, which is why they are separate
    // fields rather than one «the other party».
    givingTo: giverOf(myPos + 1),
    receivingFrom: giverOf(myPos - 1),

    youGive: byGiver(myPos),
    youGet: byGiver(((myPos - 1) % n + n) % n),
    // The third leg of a chain: «OLA GIR … til Kari».
    otherLegs: participants
      .filter((p) => Number(p['position']) !== myPos && Number(p['position']) !== ((myPos - 1 + n) % n))
      .map((p) => ({
        giver: publicUser(p),
        receiver: giverOf(Number(p['position']) + 1),
        items: byGiver(Number(p['position'])),
      })),

    youGiveValue: sum(myPos),
    youGetValue: sum(((myPos - 1) % n + n) % n),
    difference: Math.abs(sum(((myPos - 1) % n + n) % n) - sum(myPos)),

    cash: cash
      ? {
          amountNok: num(cash['amount_nok']),
          youPay: Number(cash['payer_position']) === myPos,
          payer: giverOf(Number(cash['payer_position'])),
          payee: giverOf(Number(cash['payee_position'])),
          // The number to Vipps it to. We show it; we never touch it.
          payeePhone: at(Number(cash['payee_position']))['phone'],
        }
      : null,

    participants: participants.map((p) => ({
      ...publicUser(p),
      position: Number(p['position']),
      accepted: acceptedBy.has(p['user_id'] as string),
      sentAt: iso(p['sent_at']),
      receivedAt: iso(p['received_at']),
      paidAt: iso(p['paid_at']),
      gives: byGiver(Number(p['position'])),
    })),

    threadId: thread?.['id'] ?? null,
    lastMessage: lastMessage
      ? {
          body: lastMessage['body'],
          senderName: lastMessage['sender_name'],
          mine: lastMessage['sender_id'] === viewerId,
          createdAt: iso(lastMessage['created_at']),
        }
      : null,

    withdrawal: withdrawal
      ? {
          id: withdrawal['id'],
          requestedBy: withdrawal['requested_by'],
          byYou: withdrawal['requested_by'] === viewerId,
          state: withdrawal['state'],
          respondsBy: iso(withdrawal['responds_by']),
          blockedBySent: Boolean(withdrawal['blocked_by_sent']),
        }
      : null,

    snapshots: snapshots.map((s) => ({
      title: s['title'],
      giverPosition: Number(s['giver_position']),
      estimatedValueNok: num(s['estimated_value_nok']),
      cover: s['cover_url'],
    })),

    yourReview: myReview
      ? { score: num(myReview['score']), comment: myReview['comment'], ratee: myReview['ratee'] }
      : null,
  }
}

/** Screen 11, in its three tabs. */
export async function tradeList(db: Database, viewerId: string) {
  const rows = await many(
    db,
    sql`select t.id, t.state from trades t
        join trade_participants p on p.trade_id = t.id
        where p.user_id = ${viewerId}
        order by t.created_at desc`,
  )

  const views = []
  for (const row of rows) {
    const view = await tradeView(db, row['id'], viewerId)
    if (view) views.push(view)
  }

  const waiting = views.filter((v) => ['talking', 'pending', 'countered'].includes(v.state))
  return {
    waiting,
    active: views.filter((v) => ['accepted', 'paused'].includes(v.state)),
    done: views.filter((v) => ['completed', 'cancelled'].includes(v.state)),
    // «Din tur» on screen 11: pending, and you have not answered yet.
    yourTurn: waiting.filter((v) => !v.you.accepted && v.state !== 'talking').length,
  }
}
