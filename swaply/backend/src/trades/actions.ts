import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { WITHDRAWAL_RESPONSE_HOURS } from '../lib/constants.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { many, one, uuidArray, type Row } from '../lib/rows.js'
import { lockItems, lockTrades, lockTradesWhere } from './locks.js'
import { NEGOTIABLE, cancelTrade, endTrade, type Tx } from './trades.js'

export { NEGOTIABLE }

export async function participantOf(db: Database, tradeId: string, userId: string) {
  const row = await one(
    db,
    sql`select * from trade_participants where trade_id = ${tradeId} and user_id = ${userId}`,
  )
  if (!row) throw forbidden('Du er ikke med i dette byttet.')
  return row
}

/**
 * «Avslå» — screen 09f. Ends it for everyone and frees what was held.
 *
 * Only while it is still a negotiation. Once everybody has accepted, backing
 * out is the withdrawal flow on 08a–08c and needs the other side's yes; a
 * decline here would be a way around the one screen that exists to stop it.
 * Judged under the trade's lock (`endTrade`), so a yes landing in the same
 * moment cannot slip between the check and the ending.
 */
export async function declineTrade(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)
  return cancelTrade(db, tradeId, 'declined', { actor: userId, onlyWhileNegotiating: true })
}

/**
 * «Trekk deg» before everyone has accepted — screen 09g.
 *
 * Nobody has committed anything yet, so it just ends. The conversation is kept,
 * because the screen promises that in writing. A closed trade is refused
 * rather than cancelled a second time, which would overwrite the reason the
 * first ending is showing on 09f.
 */
export async function withdrawEarly(db: Database, tradeId: string, userId: string) {
  await participantOf(db, tradeId, userId)
  return cancelTrade(db, tradeId, 'withdrawn_early', { actor: userId, onlyWhileNegotiating: true })
}

/**
 * Why a block was refused: the two have a trade they have both agreed to.
 *
 * Decided by the product owner 04.10.2026. An agreed trade is two people who
 * have promised each other something, and a block in the middle of it ended
 * nothing and left both of them unable to say a word about the handover. So it
 * is finished first — or left, through the withdrawal question on 08a — and
 * then blocked. Reporting is never refused: a person is looking at reports.
 */
export const agreedTradeInTheWay = (message?: string) =>
  conflict(
    'agreed_trade',
    message ??
      'Dere har et godtatt bytte på gang, så du kan ikke blokkere ennå. Fullfør byttet eller ' +
        'trekk deg fra det først. Du kan rapportere uansett.',
  )

/**
 * Block somebody, and end every negotiation the two of you are both in —
 * unless there is a trade between you that you have both agreed to, which
 * refuses the block (`agreedTradeInTheWay`).
 *
 * Talking, pending and countered — a negotiation — end with `blocked`, which
 * tells the others in each trade and never says who blocked whom. What is left
 * between the two after that refuses the moves across the block
 * (`blocking.ts`), which still matters for a block made before 04.10.2026,
 * when an agreed trade could stand beside one.
 *
 * In one transaction, holding every open trade the two share from the first
 * look to the last write: a yes landing in one of them while this decided
 * would agree a trade across the block, or slip one past the refusal. In the
 * one order (`index.ts`): the trades, then everything they hold in one batch,
 * then each ending, which takes nothing new.
 *
 * Returns the listings those trades held, back on the market: the caller runs
 * the search over them once this has committed.
 */
export async function blockAndEnd(db: Database, blocker: string, blocked: string) {
  return db.transaction(async (tx) => {
    const shared = await lockTradesWhere(
      tx,
      sql`t.state in ('talking', 'pending', 'countered', 'accepted', 'paused')
          and exists (select 1 from trade_participants p
                      where p.trade_id = t.id and p.user_id = ${blocker})
          and exists (select 1 from trade_participants p
                      where p.trade_id = t.id and p.user_id = ${blocked})`,
    )
    if ([...shared.values()].some((state) => state === 'accepted' || state === 'paused')) {
      throw agreedTradeInTheWay()
    }

    await tx.execute(
      sql`insert into blocks (blocker, blocked) values (${blocker}, ${blocked})
          on conflict do nothing`,
    )
    // Judged on each row as it is held: only a negotiation is ended.
    const negotiations = [...shared]
      .filter(([, state]) => ['talking', 'pending', 'countered'].includes(state))
      .map(([id]) => id)
    if (negotiations.length === 0) return [] as string[]
    await lockItems(tx, sql`i.active_trade_id = any(${uuidArray(negotiations)})`)

    const freed: string[] = []
    for (const tradeId of negotiations) {
      freed.push(...(await endTrade(tx, tradeId, 'blocked', { actor: blocker })))
    }
    return freed
  })
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
      await toldNo(tx, tradeId, req['requested_by']!)
      return { state: 'rejected', blockedBySent: true, freed: [] as string[] }
    }

    if (approve) {
      await tx.execute(
        sql`update trade_withdrawals set state = 'approved', resolved_at = now()
            where id = ${req['id']}`,
      )
      // Inside the lock: the trade was open when this was decided, and it
      // ends with the reason this answer gives rather than one written over
      // somebody else's. The one who asked is told it ended, as everybody
      // but the one answering is.
      const freed = await endTrade(tx, tradeId, 'withdrawal_approved', { actor: userId })
      return { state: 'approved', blockedBySent: false, freed }
    }

    await tx.execute(
      sql`update trade_withdrawals set state = 'rejected', resolved_at = now()
          where id = ${req['id']}`,
    )
    await resume(tx, tradeId)
    await toldNo(tx, tradeId, req['requested_by']!)
    return { state: 'rejected', blockedBySent: false, freed: [] as string[] }
  })
}

/**
 * The one who asked to get out, told that the answer is no and the trade goes
 * on. They are waiting on 08b for exactly this, and the others answered it.
 */
async function toldNo(tx: Tx, tradeId: string, askedBy: string) {
  await tx.execute(sql`
    insert into notifications (user_id, type, payload)
    values (${askedBy}, 'withdrawal_rejected', jsonb_build_object('tradeId', ${tradeId}::text))
  `)
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

/**
 * The deadline decides it if nobody answers: the trade simply carries on.
 *
 * One trade at a time, under its lock, the way every answer to the question
 * is given — so a no that arrives in the last second and the clock cannot
 * both decide it. And everybody in the trade is told it goes on: the one who
 * asked is waiting on 08b for an answer, and the others had one to give.
 */
export async function expireWithdrawals(db: Database) {
  const due = await many(
    db,
    sql`select distinct trade_id from trade_withdrawals
        where state = 'waiting' and responds_by < now()`,
  )
  let expired = 0
  for (const { trade_id: tradeId } of due) {
    expired += await db.transaction(async (tx) => {
      await lockTrades(tx, [tradeId])
      const lapsed = await tx.execute<Row>(
        sql`update trade_withdrawals set state = 'expired', resolved_at = now()
            where trade_id = ${tradeId} and state = 'waiting' and responds_by < now()
            returning id`,
      )
      if (lapsed.length === 0) return 0
      const resumed = await tx.execute<Row>(
        sql`update trades set state = 'accepted' where id = ${tradeId} and state = 'paused'
            returning id`,
      )
      if (resumed.length > 0) {
        await tx.execute(sql`
          insert into notifications (user_id, type, payload)
          select p.user_id, 'withdrawal_lapsed', jsonb_build_object('tradeId', ${tradeId}::text)
          from trade_participants p join users u on u.id = p.user_id
          where p.trade_id = ${tradeId} and u.anonymised_at is null
        `)
      }
      return lapsed.length
    })
  }
  return expired
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
