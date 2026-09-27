import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { WITHDRAWAL_RESPONSE_HOURS } from '../lib/constants.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { many, one, type Row } from '../lib/rows.js'
import { lockTrades } from './locks.js'
import { cancelTrade, endTrade, type Tx } from './trades.js'

export async function participantOf(db: Database, tradeId: string, userId: string) {
  const row = await one(
    db,
    sql`select * from trade_participants where trade_id = ${tradeId} and user_id = ${userId}`,
  )
  if (!row) throw forbidden('Du er ikke med i dette byttet.')
  return row
}

/** The states in which a trade is still being negotiated rather than carried out. */
export const NEGOTIABLE = ['talking', 'pending', 'countered']

/**
 * «Avslå» — screen 09f. Ends it for everyone and frees what was held.
 *
 * Only while it is still a negotiation. Once everybody has accepted, backing
 * out is the withdrawal flow on 08a–08c and needs the other side's yes; a
 * decline here would be a way around the one screen that exists to stop it.
 */
export async function declineTrade(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)
  const trade = await one(db, sql`select state from trades where id = ${tradeId}`)
  if (!trade) throw notFound('Fant ikke byttet.')
  if (['completed', 'cancelled'].includes(trade['state'])) {
    throw conflict('trade_closed', 'Byttet er allerede avsluttet.')
  }
  if (!NEGOTIABLE.includes(trade['state'])) {
    throw conflict('needs_permission', 'Alle har godtatt. Du må spørre de andre først.')
  }
  return cancelTrade(db, tradeId, 'declined')
}

/**
 * «Trekk deg» before everyone has accepted — screen 09g.
 *
 * Nobody has committed anything yet, so it just ends. The conversation is kept,
 * because the screen promises that in writing.
 */
export async function withdrawEarly(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)
  const trade = await one(db, sql`select state from trades where id = ${tradeId}`)
  if (!trade) throw notFound('Fant ikke byttet.')
  if (['completed', 'cancelled'].includes(trade['state'])) {
    // Cancelling a closed trade a second time would overwrite the reason the
    // first one is showing on 09f.
    throw conflict('trade_closed', 'Byttet er allerede avsluttet.')
  }
  if (!NEGOTIABLE.includes(trade['state'])) {
    throw conflict('needs_permission', 'Alle har godtatt. Du må spørre de andre først.')
  }
  return cancelTrade(db, tradeId, 'withdrawn_early')
}

/**
 * The trade a withdrawal action is about, locked until the action is written.
 *
 * Every one of them reads the state first and refuses a trade that has ended,
 * in words. A question can outlive its trade — the other side deleted their
 * account, the tool ended it, everybody sent and received while it waited —
 * and each answer ends by putting the trade back to `accepted`. Given to a
 * cancelled trade that brought it back to life with nothing reserved; given
 * to a completed one, it un-completed it. The lock is what keeps a
 * cancellation from landing between the check and the write.
 *
 * Only the trade is locked, and that is the whole of the one order
 * (`index.ts`) for a step that writes nothing but the trade and its question:
 * the trade's row is the lock on what it holds, so a yes that goes on to end
 * the trade takes the listings after it, inside `endTrade`. The first version
 * of this took the listings first, to match endings that let go of the
 * listings before they wrote the trade; every ending now takes the trade
 * first, and a yes and a deletion in the same moment queue on it instead of
 * each holding what the other needed next — a 500 for Tor, or «Slett
 * kontoen» failing for Siri.
 */
async function openTradeFor(tx: Tx, tradeId: string): Promise<string> {
  const state = (await lockTrades(tx, [tradeId])).get(tradeId)
  if (!state) throw notFound('Fant ikke byttet.')
  if (['completed', 'cancelled'].includes(state)) {
    throw conflict('trade_closed', 'Byttet er allerede avsluttet.')
  }
  return state
}

/**
 * Back to `accepted`, from the pause and from nothing else. The lock in
 * `openTradeFor` already says the trade is open; this says it twice, because
 * a line that can resurrect a trade should not depend on a caller remembering.
 */
async function resume(tx: Tx, tradeId: string) {
  await tx.execute(
    sql`update trades set state = 'accepted' where id = ${tradeId} and state = 'paused'`,
  )
}

/**
 * «Spør om å trekke meg» after everyone accepted — screens 08a and 08b.
 *
 * Once the other side has marked something sent, the answer is already no: they
 * have parted with their thing on the strength of the agreement.
 */
export async function requestWithdrawal(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)

  return db.transaction(async (tx) => {
    const state = await openTradeFor(tx, tradeId)
    // Paused is what an open question looks like from the trade's side.
    if (state === 'paused') throw conflict('already_asked', 'Det ligger allerede en forespørsel inne.')
    if (state !== 'accepted') throw conflict('not_accepted', 'Byttet er ikke godtatt ennå.')

    const [sent] = await tx.execute<Row>(
      sql`select 1 from trade_participants
          where trade_id = ${tradeId} and user_id <> ${userId} and sent_at is not null`,
    )

    const [open] = await tx.execute<Row>(
      sql`select 1 from trade_withdrawals where trade_id = ${tradeId} and state = 'waiting'`,
    )
    if (open) throw conflict('already_asked', 'Det ligger allerede en forespørsel inne.')

    if (sent) {
      // Screen 08c. Recorded rather than refused, so the record shows it was asked.
      const [row] = await tx.execute<Row>(
        sql`insert into trade_withdrawals (trade_id, requested_by, responds_by, state,
                                           resolved_at, blocked_by_sent)
            values (${tradeId}, ${userId}, now(), 'rejected', now(), true)
            returning *`,
      )
      return { ...row!, blocked: true }
    }

    const [row] = await tx.execute<Row>(
      sql`insert into trade_withdrawals (trade_id, requested_by, responds_by)
          values (${tradeId}, ${userId},
                  now() + ${`${WITHDRAWAL_RESPONSE_HOURS} hours`}::interval)
          returning *`,
    )
    await tx.execute(sql`update trades set state = 'paused' where id = ${tradeId}`)
    await tx.execute(sql`
      insert into notifications (user_id, type, payload)
      select p.user_id, 'withdrawal_requested', jsonb_build_object('tradeId', ${tradeId}::text)
      from trade_participants p where p.trade_id = ${tradeId} and p.user_id <> ${userId}
    `)
    return { ...row!, blocked: false }
  })
}

export async function respondToWithdrawal(
  db: Database,
  tradeId: string,
  userId: string,
  approve: boolean,
) {
  await participantOf(db, tradeId, userId)

  return db.transaction(async (tx) => {
    await openTradeFor(tx, tradeId)

    const [req] = await tx.execute<Row>(
      sql`select * from trade_withdrawals
          where trade_id = ${tradeId} and state = 'waiting' order by requested_at desc limit 1`,
    )
    if (!req) throw notFound('Ingen forespørsel å svare på.')
    if (req['requested_by'] === userId) {
      throw badRequest('own_request', 'Du kan ikke svare på din egen forespørsel.')
    }

    const [mine] = await tx.execute<Row>(
      sql`select sent_at from trade_participants where trade_id = ${tradeId} and user_id = ${userId}`,
    )
    // Saying yes after you have sent is not a thing you can do — the screen says
    // as much, and the answer flips to no with the reason recorded.
    if (approve && mine?.['sent_at']) {
      await tx.execute(
        sql`update trade_withdrawals set state = 'rejected', resolved_at = now(),
                   blocked_by_sent = true where id = ${req['id']}`,
      )
      await resume(tx, tradeId)
      return { state: 'rejected', blockedBySent: true, freed: [] as string[] }
    }

    if (approve) {
      await tx.execute(
        sql`update trade_withdrawals set state = 'approved', resolved_at = now()
            where id = ${req['id']}`,
      )
      // Inside the lock: the trade was open when this was decided, and it
      // ends with the reason this answer gives rather than one written over
      // somebody else's.
      const freed = await endTrade(tx, tradeId, 'withdrawal_approved')
      return { state: 'approved', blockedBySent: false, freed }
    }

    await tx.execute(
      sql`update trade_withdrawals set state = 'rejected', resolved_at = now()
          where id = ${req['id']}`,
    )
    await resume(tx, tradeId)
    return { state: 'rejected', blockedBySent: false, freed: [] as string[] }
  })
}

/** «Angre forespørselen» on screen 08b. */
export async function cancelWithdrawalRequest(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)

  await db.transaction(async (tx) => {
    await openTradeFor(tx, tradeId)

    const [req] = await tx.execute<Row>(
      sql`select * from trade_withdrawals
          where trade_id = ${tradeId} and state = 'waiting' and requested_by = ${userId}`,
    )
    if (!req) throw notFound('Ingen forespørsel å angre.')

    await tx.execute(
      sql`update trade_withdrawals set state = 'withdrawn', resolved_at = now()
          where id = ${req['id']}`,
    )
    await resume(tx, tradeId)
  })
}

/** The deadline decides it if nobody answers: the trade simply carries on. */
export async function expireWithdrawals(db: Database) {
  const rows = await many(
    db,
    sql`update trade_withdrawals set state = 'expired', resolved_at = now()
        where state = 'waiting' and responds_by < now()
        returning trade_id`,
  )
  for (const row of rows) {
    await db.execute(
      sql`update trades set state = 'accepted' where id = ${row['trade_id']} and state = 'paused'`,
    )
  }
  return rows.length
}

export type Marker = 'sent' | 'received' | 'paid'

/**
 * The handover markers on screen 06f. All three are self-reported, because we
 * neither ship nor take the money — which makes them the only record that any
 * of it happened. `sent` is also what closes the door on withdrawing.
 */
export async function markHandover(
  db: Database,
  tradeId: string,
  userId: string,
  marker: Marker,
  value = true,
) {
  await participantOf(db, tradeId, userId)

  // 06f is the screen behind these, and it only exists once everybody has
  // accepted. Marking a thing sent in a trade still being negotiated would
  // close the door on withdrawing from something nobody has agreed to.
  const trade = await one(db, sql`select state from trades where id = ${tradeId}`)
  if (!trade) throw notFound('Fant ikke byttet.')
  if (!['accepted', 'paused', 'completed'].includes(trade['state'])) {
    throw conflict('not_accepted', 'Byttet er ikke godtatt ennå.')
  }

  const column = { sent: 'sent_at', received: 'received_at', paid: 'paid_at' }[marker]

  await db.execute(
    sql`update trade_participants set ${sql.raw(column)} = ${value ? sql`now()` : sql`null`}
        where trade_id = ${tradeId} and user_id = ${userId}`,
  )

  // When everybody has both sent and received, the trade is done without anyone
  // having to press a separate button.
  const outstanding = await one(
    db,
    sql`select count(*) as n from trade_participants
        where trade_id = ${tradeId} and (sent_at is null or received_at is null)`,
  )
  return { complete: Number(outstanding!['n']) === 0 }
}
