import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { mediaUrl } from '../lib/media.js'
import { coverSql, iso, many, num, uuidArray, type Row } from '../lib/rows.js'
import { publicItem, publicUser } from '../routes/serialize.js'
import type { CloseCode } from './close.js'
import type { LastMessage } from './conversation.js'

/**
 * Everything the trade screens render, from one viewer's point of view.
 *
 * The screens are written in the second person — «DU FÅR», «DU GIR», «OLA GIR» —
 * so the server does the position arithmetic once rather than every client
 * doing it slightly differently. Position p gives to p+1 and receives from p-1.
 *
 * One trade is a list of one (`tradeViews`), so the screen behind a single
 * trade and the list on 11 are built by the same code.
 */
export async function tradeView(db: Database, tradeId: string, viewerId: string) {
  const [view] = await tradeViews(db, [tradeId], viewerId)
  return view ?? null
}

/** Rows of one query, grouped by the column that says which trade or offer they belong to. */
function byKey(rows: Row[], key: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>()
  for (const row of rows) {
    const k = row[key] as string
    const list = out.get(k)
    if (list) list.push(row)
    else out.set(k, [row])
  }
  return out
}

/**
 * [tradeView] for several trades at once, in the order given, leaving out any
 * that does not exist or that [viewerId] is not in.
 *
 * Eleven statements for the whole list rather than eleven per trade. Screen
 * 11 lists every trade a person has ever been in, finished ones included,
 * and anybody can add one to somebody else's list by writing about a listing
 * and declining, over and over: built one trade at a time, 300 of them took
 * five seconds on every visit to Bytter, and the time grew with each.
 */
export async function tradeViews(db: Database, tradeIds: string[], viewerId: string) {
  const ids = [...new Set(tradeIds)]
  if (ids.length === 0) return []
  const idList = uuidArray(ids)

  const trades = new Map(
    (await many(db, sql`select * from trades where id = any(${idList})`)).map((t) => [
      t['id'] as string,
      t,
    ]),
  )

  // `p.*` has no id of its own, so the user's has to be named explicitly or
  // every serialised participant comes back without one.
  const participantsOf = byKey(
    await many(
      db,
      sql`select p.*, u.id as id, u.display_name, u.town, u.phone, u.rating_avg,
                 u.rating_count, u.bankid_verified_at, u.created_at
          from trade_participants p join users u on u.id = p.user_id
          where p.trade_id = any(${idList}) order by p.trade_id, p.position`,
    ),
    'trade_id',
  )

  // The version on the table: the highest `seq` of each trade.
  const offers = new Map(
    (
      await many(
        db,
        sql`select distinct on (trade_id) * from trade_offers
            where trade_id = any(${idList}) order by trade_id, seq desc`,
      )
    ).map((o) => [o['trade_id'] as string, o]),
  )
  const offerList = uuidArray([...offers.values()].map((o) => o['id'] as string))

  const offerItemsOf = byKey(
    await many(
      db,
      sql`select oi.offer_id, oi.giver_position, i.*, ${coverSql('i')} as cover
          from trade_offer_items oi join items i on i.id = oi.item_id
          where oi.offer_id = any(${offerList}) order by oi.giver_position, i.title`,
    ),
    'offer_id',
  )
  const cashOf = byKey(
    await many(db, sql`select * from trade_offer_cash where offer_id = any(${offerList})`),
    'offer_id',
  )
  const acceptancesOf = byKey(
    await many(
      db,
      sql`select offer_id, user_id, accepted_at, revoked_at, terms_version
          from trade_acceptances where offer_id = any(${offerList})`,
    ),
    'offer_id',
  )

  const threads = new Map(
    (await many(db, sql`select id, trade_id from threads where trade_id = any(${idList})`)).map(
      (t) => [t['trade_id'] as string, t['id'] as string],
    ),
  )
  // The last thing said in each, as `lastMessageIn` reads one.
  const lastOf = new Map(
    (
      await many(
        db,
        sql`select distinct on (m.thread_id) m.*, u.display_name as sender_name
            from messages m join users u on u.id = m.sender_id
            where m.thread_id = any(${uuidArray([...threads.values()])})
            order by m.thread_id, m.created_at desc`,
      )
    ).map((m) => [
      m['thread_id'] as string,
      {
        body: m['body'] as string,
        senderName: (m['sender_name'] as string | null) ?? null,
        mine: m['sender_id'] === viewerId,
        createdAt: iso(m['created_at']),
      } satisfies LastMessage,
    ]),
  )

  const withdrawals = new Map(
    (
      await many(
        db,
        sql`select distinct on (trade_id) * from trade_withdrawals
            where trade_id = any(${idList}) order by trade_id, requested_at desc`,
      )
    ).map((w) => [w['trade_id'] as string, w]),
  )

  const snapshotsOf = byKey(
    await many(
      db,
      sql`select * from trade_item_snapshots
          where trade_id = any(${idList}) order by trade_id, giver_position`,
    ),
    'trade_id',
  )

  const reviews = new Map(
    (
      await many(
        db,
        sql`select distinct on (trade_id) * from reviews
            where trade_id = any(${idList}) and rater = ${viewerId}
            order by trade_id, created_at`,
      )
    ).map((r) => [r['trade_id'] as string, r]),
  )

  const views = []
  for (const tradeId of ids) {
    const trade = trades.get(tradeId)
    if (!trade) continue
    const participants = participantsOf.get(tradeId) ?? []
    const offer = offers.get(tradeId) ?? null
    const threadId = threads.get(tradeId) ?? null
    const view = buildView({
      viewerId,
      trade,
      participants,
      offer,
      offerItems: offer ? (offerItemsOf.get(offer['id']) ?? []) : [],
      cash: offer ? (cashOf.get(offer['id'])?.[0] ?? null) : null,
      acceptances: offer ? (acceptancesOf.get(offer['id']) ?? []) : [],
      threadId,
      lastMessage: threadId ? (lastOf.get(threadId) ?? null) : null,
      withdrawal: withdrawals.get(tradeId) ?? null,
      snapshots: snapshotsOf.get(tradeId) ?? [],
      myReview: reviews.get(tradeId) ?? null,
    })
    if (view) views.push(view)
  }
  return views
}

/** One trade as [viewerId] sees it, from the rows `tradeViews` read for it. */
function buildView(rows: {
  viewerId: string
  trade: Row
  participants: Row[]
  offer: Row | null
  offerItems: Row[]
  cash: Row | null
  acceptances: Row[]
  threadId: string | null
  lastMessage: LastMessage | null
  withdrawal: Row | null
  snapshots: Row[]
  myReview: Row | null
}) {
  const { viewerId, trade, participants, offer, offerItems, cash, acceptances } = rows
  const { threadId, lastMessage, withdrawal, snapshots, myReview } = rows

  const me = participants.find((p) => p['user_id'] === viewerId)
  if (!me) return null

  const n = participants.length
  const myPos = Number(me['position'])
  const at = (pos: number) => participants[((pos % n) + n) % n]!

  const byGiver = (pos: number) =>
    offerItems.filter((i) => Number(i['giver_position']) === pos).map(publicItem)

  const sum = (pos: number) =>
    offerItems
      .filter((i) => Number(i['giver_position']) === pos)
      .reduce((total, i) => total + (num(i['estimated_value_nok']) ?? 0), 0)

  const acceptedBy = new Set(
    acceptances.filter((a) => !a['revoked_at']).map((a) => a['user_id'] as string),
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
    // The words it was closed with, for the record, and the code the app
    // picks its own words from: one sentence cannot be right for everybody
    // reading it — the one who pulled out and the one left behind, a pair
    // and a ring of three (`trades/close.ts`). Null until it is cancelled,
    // and on a trade cancelled with words no code was ever written for.
    closeReason: trade['close_reason'],
    closeCode: (trade['close_code'] as CloseCode | null) ?? null,
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
          // The number to Vipps it to. We show it; we never touch it. Only to
          // the one paying, and only once everybody has agreed: anybody may
          // write to a lister and put a mellomlegg on the table, and a number
          // shown on a proposal was a number handed to whoever proposed it.
          payeePhone:
            Number(cash['payer_position']) === myPos &&
            ['accepted', 'paused', 'completed'].includes(trade['state'])
              ? at(Number(cash['payee_position']))['phone']
              : null,
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

    threadId,
    lastMessage,

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
      cover: mediaUrl(s['cover_url']),
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

  // Every one of them in one go: see `tradeViews`.
  const views = await tradeViews(
    db,
    rows.map((row) => row['id'] as string),
    viewerId,
  )

  const waiting = views.filter((v) => ['talking', 'pending', 'countered'].includes(v.state))
  return {
    waiting,
    active: views.filter((v) => ['accepted', 'paused'].includes(v.state)),
    done: views.filter((v) => ['completed', 'cancelled'].includes(v.state)),
    // «Din tur» on screen 11: a deal you could say yes to, and have not. Both
    // sides have to hold something — an offer with an empty side has no yes in
    // it, and counting one sends a person to a screen with nothing to press.
    yourTurn: waiting.filter(
      (v) =>
        !v.you.accepted &&
        v.state !== 'talking' &&
        v.youGive.length > 0 &&
        v.youGet.length > 0,
    ).length,
  }
}
