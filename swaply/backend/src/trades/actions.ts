import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { WITHDRAWAL_RESPONSE_HOURS } from '../lib/constants.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { many, one } from '../lib/rows.js'
import { cancelTrade } from './trades.js'

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
  return cancelTrade(db, tradeId, 'Byttet ble avslått')
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
  return cancelTrade(db, tradeId, 'Den andre parten trakk seg før byttet var godtatt')
}

/**
 * «Spør om å trekke meg» after everyone accepted — screens 08a and 08b.
 *
 * Once the other side has marked something sent, the answer is already no: they
 * have parted with their thing on the strength of the agreement.
 */
export async function requestWithdrawal(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)

  const trade = await one(db, sql`select state from trades where id = ${tradeId}`)
  if (trade?.['state'] !== 'accepted') {
    throw conflict('not_accepted', 'Byttet er ikke godtatt ennå.')
  }

  const sent = await one(
    db,
    sql`select 1 from trade_participants
        where trade_id = ${tradeId} and user_id <> ${userId} and sent_at is not null`,
  )

  const open = await one(
    db,
    sql`select 1 from trade_withdrawals where trade_id = ${tradeId} and state = 'waiting'`,
  )
  if (open) throw conflict('already_asked', 'Det ligger allerede en forespørsel inne.')

  if (sent) {
    // Screen 08c. Recorded rather than refused, so the record shows it was asked.
    const row = await one(
      db,
      sql`insert into trade_withdrawals (trade_id, requested_by, responds_by, state,
                                         resolved_at, blocked_by_sent)
          values (${tradeId}, ${userId}, now(), 'rejected', now(), true)
          returning *`,
    )
    return { ...row!, blocked: true }
  }

  const row = await one(
    db,
    sql`insert into trade_withdrawals (trade_id, requested_by, responds_by)
        values (${tradeId}, ${userId},
                now() + ${`${WITHDRAWAL_RESPONSE_HOURS} hours`}::interval)
        returning *`,
  )
  await db.execute(sql`update trades set state = 'paused' where id = ${tradeId}`)
  await db.execute(sql`
    insert into notifications (user_id, type, payload)
    select p.user_id, 'withdrawal_requested', jsonb_build_object('tradeId', ${tradeId}::text)
    from trade_participants p where p.trade_id = ${tradeId} and p.user_id <> ${userId}
  `)
  return { ...row!, blocked: false }
}

export async function respondToWithdrawal(
  db: Database,
  tradeId: string,
  userId: string,
  approve: boolean,
) {
  await participantOf(db, tradeId, userId)
  const req = await one(
    db,
    sql`select * from trade_withdrawals
        where trade_id = ${tradeId} and state = 'waiting' order by requested_at desc limit 1`,
  )
  if (!req) throw notFound('Ingen forespørsel å svare på.')
  if (req['requested_by'] === userId) {
    throw badRequest('own_request', 'Du kan ikke svare på din egen forespørsel.')
  }

  const mine = await one(
    db,
    sql`select sent_at from trade_participants where trade_id = ${tradeId} and user_id = ${userId}`,
  )
  // Saying yes after you have sent is not a thing you can do — the screen says
  // as much, and the answer flips to no with the reason recorded.
  if (approve && mine?.['sent_at']) {
    await db.execute(
      sql`update trade_withdrawals set state = 'rejected', resolved_at = now(),
                 blocked_by_sent = true where id = ${req['id']}`,
    )
    await db.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
    return { state: 'rejected', blockedBySent: true, freed: [] as string[] }
  }

  if (approve) {
    await db.execute(
      sql`update trade_withdrawals set state = 'approved', resolved_at = now()
          where id = ${req['id']}`,
    )
    const freed = await cancelTrade(db, tradeId, 'Byttet ble avbrutt etter avtale mellom partene')
    return { state: 'approved', blockedBySent: false, freed }
  }

  await db.execute(
    sql`update trade_withdrawals set state = 'rejected', resolved_at = now()
        where id = ${req['id']}`,
  )
  await db.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
  return { state: 'rejected', blockedBySent: false, freed: [] as string[] }
}

/** «Angre forespørselen» on screen 08b. */
export async function cancelWithdrawalRequest(db: Database, tradeId: string, userId: string) {
  const req = await one(
    db,
    sql`select * from trade_withdrawals
        where trade_id = ${tradeId} and state = 'waiting' and requested_by = ${userId}`,
  )
  if (!req) throw notFound('Ingen forespørsel å angre.')

  await db.execute(
    sql`update trade_withdrawals set state = 'withdrawn', resolved_at = now()
        where id = ${req['id']}`,
  )
  await db.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
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
