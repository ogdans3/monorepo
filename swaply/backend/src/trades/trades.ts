import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { blocked } from '../lib/blocks.js'
import { conflict } from '../lib/errors.js'
import { uuidArray } from '../lib/rows.js'
import { blockedInTrade } from './blocking.js'
import { TOLD, closeReasonSql, type CloseCode } from './close.js'
import type { Cycle } from './cycles.js'
import { lockItems, lockTrades } from './locks.js'
import { validateOffer, type OfferCash, type OfferItem } from './offer.js'

type Row = Record<string, string | null>

/** A transaction's handle, for the steps that have to share one with their caller. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

/** The states in which a trade is still being negotiated rather than carried out. */
export const NEGOTIABLE = ['talking', 'pending', 'countered']

/**
 * What a listing goes back to when a trade lets go of it: the market — or,
 * for one its owner removed while a trade held it, withdrawn, as removing it
 * said. Removal refuses a held listing now (`removeListings`), but before it
 * did, the check and the write were two statements and a yes could land
 * between them; such a listing came back `available` and deleted at once, and
 * went into the cycle search like any other.
 */
const RELEASED = sql.raw(
  `(case when deleted_at is null then 'available' else 'withdrawn' end)::item_status`,
)

/** The listings a release put back on the market, for the search to look at. */
const backOnTheMarket = (rows: Row[]) =>
  rows.filter((row) => row['status'] === 'available').map((row) => row['id']!)

/**
 * Turn a found cycle into a trade with its first offer on the table.
 *
 * Nothing is reserved here. A cycle is a suggestion until the owners say yes,
 * and reserving on a suggestion would freeze people's things on a maybe.
 */
export async function openTradeFromCycle(db: Database, cycle: Cycle): Promise<string> {
  return db.transaction(async (tx) => {
    const [trade] = await tx.execute<Row>(
      sql`insert into trades (state) values ('pending') returning id`,
    )
    const tradeId = trade!['id']!

    for (const [position, hop] of cycle.entries()) {
      await tx.execute(
        sql`insert into trade_participants (trade_id, user_id, position)
            values (${tradeId}, ${hop.userId}, ${position})`,
      )
    }

    // proposed_by stays null: the cycle search is not a person.
    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq) values (${tradeId}, 1) returning id`,
    )

    for (const [position, hop] of cycle.entries()) {
      await tx.execute(
        sql`insert into trade_offer_items (offer_id, item_id, giver_position)
            values (${offer!['id']!}, ${hop.givesItemId}, ${position})`,
      )
    }

    await tx.execute(sql`insert into threads (trade_id) values (${tradeId})`)
    await tx.execute(
      sql`insert into thread_participants (thread_id, user_id)
          select t.id, p.user_id from threads t
          join trade_participants p on p.trade_id = t.trade_id
          where t.trade_id = ${tradeId}`,
    )

    return tradeId
  })
}

/**
 * Open a trade by writing to someone about their listing.
 *
 * This is the only way a conversation starts, because every thread belongs to a
 * trade. The offer names their item and nothing back yet — the half-filled
 * offer behind the `Jeg vil ha` chip.
 */
export async function startTalking(
  db: Database,
  opener: string,
  aboutItem: string,
  body: string,
): Promise<{ tradeId: string; threadId: string }> {
  return db.transaction(async (tx) => {
    const [item] = await tx.execute<Row>(sql`select owner_id from items where id = ${aboutItem}`)
    const owner = item!['owner_id']!

    const [trade] = await tx.execute<Row>(sql`insert into trades default values returning id`)
    const tradeId = trade!['id']!

    // The opener is position 0 and receives; the owner gives. That is the shape
    // of "I want this", and a counter-offer can rearrange it later.
    await tx.execute(
      sql`insert into trade_participants (trade_id, user_id, position)
          values (${tradeId}, ${opener}, 0), (${tradeId}, ${owner}, 1)`,
    )

    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq, proposed_by)
          values (${tradeId}, 1, ${opener}) returning id`,
    )
    await tx.execute(
      sql`insert into trade_offer_items (offer_id, item_id, giver_position)
          values (${offer!['id']!}, ${aboutItem}, 1)`,
    )

    const [thread] = await tx.execute<Row>(
      sql`insert into threads (trade_id) values (${tradeId}) returning id`,
    )
    const threadId = thread!['id']!
    await tx.execute(
      sql`insert into thread_participants (thread_id, user_id)
          values (${threadId}, ${opener}), (${threadId}, ${owner})`,
    )
    await tx.execute(
      sql`insert into messages (thread_id, sender_id, body)
          values (${threadId}, ${opener}, ${body})`,
    )

    return { tradeId, threadId }
  })
}

/** 409 for a yes to a version that is no longer the one on the table. */
export const offerChanged = () =>
  conflict('offer_changed', 'Forslaget er endret. Se over det nye før du godtar.')

/** The version on the table: the highest `seq`. Read under the trade's lock. */
async function newestOffer(tx: Tx, tradeId: string): Promise<string | null> {
  const [row] = await tx.execute<Row>(
    sql`select id from trade_offers where trade_id = ${tradeId} order by seq desc limit 1`,
  )
  return row?.['id'] ?? null
}

/** A counter-offer on the table, and what the trade let go of to put it there. */
export type CounterResult = {
  offerId: string
  /**
   * Listings the trade held for an earlier version, back on the market. Their
   * wishes were dead while it held them, so the caller runs the search again.
   */
  freed: string[]
}

/**
 * Put a new version of the deal on the table.
 *
 * Never an edit. Earlier acceptances stay attached to the version they were
 * given for, which is the only way to avoid having accepted something else.
 * And since a reservation *is* an owner's acceptance, the reservations go:
 * a yes to the old version is not a yes to this one, and a listing held for
 * an offer nobody can accept any more is frozen by a promise about nothing.
 *
 * Judged under the trade's lock, like every other move: the state, and the
 * offer itself (`validateOffer`). Read beforehand, a counter-offer landing in
 * the moment the last yes agreed the trade put an agreed trade back to
 * `countered`, undoing everybody's acceptance without anybody seeing it.
 */
export async function proposeCounterOffer(
  db: Database,
  tradeId: string,
  proposedBy: string,
  items: OfferItem[],
  cash?: OfferCash,
  opts: {
    /**
     * The version the proposal was made from, when the client says. A newer
     * one on the table means the person answered a deal that has already
     * been answered, and their proposal would quietly replace it.
     */
    baseOfferId?: string | null
  } = {},
): Promise<CounterResult> {
  return db.transaction(async (tx) => {
    const state = (await lockTrades(tx, [tradeId])).get(tradeId)
    // A counter-offer is a move inside a negotiation. Each refusal says what
    // is true and what the screen offers: an agreed trade is left through the
    // withdrawal question on 08a, and a paused one is waiting for an answer.
    if (state === 'accepted') {
      throw conflict('not_negotiable', 'Alle har godtatt byttet, så det kan ikke endres lenger.')
    }
    if (state === 'paused') {
      throw conflict('not_negotiable', 'Byttet er pauset mens noen svarer på en forespørsel.')
    }
    if (!state || !NEGOTIABLE.includes(state)) {
      throw conflict('not_negotiable', 'Byttet er avsluttet.')
    }
    if (opts.baseOfferId && (await newestOffer(tx, tradeId)) !== opts.baseOfferId) {
      throw conflict(
        'offer_changed',
        'Forslaget er endret. Se over det nye før du foreslår noe annet.',
      )
    }
    // Nothing new on the table across a block (`blocking.ts`).
    if (await blockedInTrade(tx, tradeId, proposedBy)) throw blocked()
    await validateOffer(tx, tradeId, items, cash)

    const [offer] = await tx.execute<Row>(
      sql`insert into trade_offers (trade_id, seq, proposed_by)
          select ${tradeId}, coalesce(max(seq), 0) + 1, ${proposedBy}
          from trade_offers where trade_id = ${tradeId}
          returning id`,
    )
    const offerId = offer!['id']!

    // One row per listing: an offer holds a set of things, and proposing
    // something already on the table is a person pressing the same button
    // twice, not a new deal with two of it. The primary key would refuse it
    // and the screen would show a 500.
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.itemId)) continue
      seen.add(item.itemId)
      await tx.execute(
        sql`insert into trade_offer_items (offer_id, item_id, giver_position)
            values (${offerId}, ${item.itemId}, ${item.giverPosition})`,
      )
    }

    if (cash) {
      await tx.execute(
        sql`insert into trade_offer_cash (offer_id, payer_position, payee_position, amount_nok)
            values (${offerId}, ${cash.payerPosition}, ${cash.payeePosition}, ${cash.amountNok})`,
      )
    }

    // Everything the trade holds was held for a version that is no longer the
    // one on the table. In the one order (`index.ts`): the trade is held
    // above, and these are what it holds.
    await lockItems(tx, sql`i.active_trade_id = ${tradeId}`)
    const released = await tx.execute<Row>(
      sql`update items set active_trade_id = null, status = ${RELEASED}
          where active_trade_id = ${tradeId}
          returning id, status`,
    )

    // Negotiable, as judged under the lock above.
    await tx.execute(sql`update trades set state = 'countered' where id = ${tradeId}`)
    return { offerId, freed: backOnTheMarket(released) }
  })
}

export type AcceptResult = {
  reserved: string[]
  /** Trades closed because this acceptance took a listing they were counting on. */
  displaced: string[]
  /**
   * Listings that went back on the market because the trades holding them were
   * displaced. Their owners' wishes were dead while those trades held them, so
   * the caller has to run the cycle search over them again.
   */
  freed: string[]
  everyoneAccepted: boolean
}

/**
 * Accept a specific version of the deal, and reserve what you are giving.
 *
 * The lock is the point of this function. An owner's acceptance is what turns a
 * listing from available into spoken for, and two people accepting at the same
 * moment must not both walk away with the same drill.
 *
 * In the one order (`index.ts`): this trade and every trade the yes will push
 * out, then this person's listings and whatever the pushed-out trades hold.
 * The trades are decided before anything is locked and judged again once they
 * are held, because each of them may have moved while this waited.
 */
export async function acceptOffer(
  db: Database,
  offerId: string,
  userId: string,
  termsVersion: string,
): Promise<AcceptResult> {
  return db.transaction(async (tx) => {
    const [offer] = await tx.execute<Row>(
      sql`select trade_id from trade_offers where id = ${offerId}`,
    )
    const tradeId = offer!['trade_id']!

    // What this person gives in this version. Offer rows never change and
    // neither does who owns a listing, so this needs no lock.
    const offered = (
      await tx.execute<Row>(sql`
        select oi.item_id as id from trade_offer_items oi
        join items i on i.id = oi.item_id
        where oi.offer_id = ${offerId} and i.owner_id = ${userId}
      `)
    ).map((row) => row['id']!)

    // The trades this yes can push out: every other one with one of the
    // things it reserves on the table, in any version. A service is never
    // reserved, so it pushes nothing out.
    const rivals = await tx.execute<Row>(sql`
      select distinct o.trade_id as id
      from items i
      join trade_offer_items oi on oi.item_id = i.id
      join trade_offers o on o.id = oi.offer_id
      join trades t on t.id = o.trade_id
      where i.id = any(${uuidArray(offered)}) and i.kind = 'item'
        and o.trade_id <> ${tradeId} and t.state not in ('completed', 'cancelled')
    `)
    const states = await lockTrades(tx, [tradeId, ...rivals.map((row) => row['id']!)])

    // Read under the lock. A yes into a trade that ended while it waited — the
    // other side deleted their account, or another yes pushed this one out —
    // reserved things for a trade nobody would ever free them from, and put a
    // cancelled trade back to `accepted` when it was the last yes.
    const state = states.get(tradeId)
    if (state === 'completed' || state === 'cancelled') {
      throw conflict('trade_closed', 'Byttet er avsluttet.')
    }
    if (state === 'paused') {
      throw conflict('trade_paused', 'Byttet er pauset mens noen svarer på en forespørsel.')
    }
    // A yes is for the version on the table, and that is the newest one. A
    // counter-offer that landed since this one was read — while the person
    // was looking at it, or between the read and this lock — means the thing
    // they said yes to is no longer what is proposed; and enough yeses to an
    // old version agreed a trade on a deal nobody had on the table.
    if ((await newestOffer(tx, tradeId)) !== offerId) throw offerChanged()
    // And no yes across a block: a trade the block did not end — agreed, and
    // then taken back — or a block from before blocks ended anything.
    if (await blockedInTrade(tx, tradeId, userId)) throw blocked()
    // Nor to a deal with something in it that is gone: removed by its owner,
    // or traded away. Removal ends the negotiations it was on the table in
    // (`removeListings`), but a trade from before that did, or a version put
    // on the table in the same moment, still names it — and a yes to it
    // agrees to receive a thing nobody can give.
    const [gone] = await tx.execute<Row>(
      sql`select 1 from trade_offer_items oi join items i on i.id = oi.item_id
          where oi.offer_id = ${offerId}
            and (i.deleted_at is not null or i.status in ('withdrawn', 'traded'))
          limit 1`,
    )
    if (gone) {
      throw conflict('item_unavailable', 'En av tingene i forslaget er ikke tilgjengelig lenger.')
    }
    // Only a negotiation loses its things to another trade's yes, judged as
    // it stands now that it is held. An agreed trade holding one of them is
    // refused below, as `item_reserved`.
    const displaced = [...states]
      .filter(([id, now]) => id !== tradeId && ['talking', 'pending', 'countered'].includes(now))
      .map(([id]) => id)

    // Every listing this is going to write, in one sorted batch: the ones this
    // person gives, and the ones the pushed-out trades were holding.
    const locked = await lockItems(
      tx,
      sql`i.id = any(${uuidArray(offered)}) or i.active_trade_id = any(${uuidArray(displaced)})`,
    )
    const mine = locked.filter((row) => offered.includes(row['id']))

    for (const row of mine) {
      const held = row['active_trade_id']
      if (held && held !== tradeId) {
        // A refusal a person can read, not a 500. The race is ordinary: two
        // trades wanted the same drill and the other one got there first.
        throw conflict(
          'item_reserved',
          'En av tingene dine er allerede reservert i et annet bytte.',
        )
      }
    }

    // A service is never exclusive: one person can paint three living rooms.
    const reserved = mine.filter((row) => row['kind'] !== 'service').map((row) => row['id'] as string)
    if (reserved.length > 0) {
      await tx.execute(
        sql`update items set active_trade_id = ${tradeId}, status = 'reserved'
            where id = any(${uuidArray(reserved)})`,
      )
    }

    // The losers get a reason in words, never a silent disappearance — and
    // let go of whatever they were holding, because whoever else had already
    // accepted in one of them locked their things, and a listing reserved by
    // a trade that no longer exists is one nothing would ever free.
    const freed: string[] = []
    for (const loser of displaced) {
      freed.push(...(await endTrade(tx, loser, 'displaced', { actor: userId })))
    }

    await tx.execute(
      sql`insert into trade_acceptances (offer_id, user_id, terms_version)
          values (${offerId}, ${userId}, ${termsVersion})
          on conflict (offer_id, user_id)
          do update set accepted_at = now(), revoked_at = null,
                        terms_version = excluded.terms_version`,
    )

    const [tally] = await tx.execute<Row>(sql`
      select count(*) filter (where a.user_id is not null) as accepted,
             count(*) as participants
      from trade_participants p
      left join trade_acceptances a
        on a.user_id = p.user_id and a.offer_id = ${offerId} and a.revoked_at is null
      where p.trade_id = ${tradeId}
    `)
    const everyoneAccepted = tally!['accepted'] === tally!['participants']

    if (everyoneAccepted) {
      await tx.execute(sql`update trades set state = 'accepted' where id = ${tradeId}`)
    }

    return { reserved, displaced, freed, everyoneAccepted }
  })
}

/**
 * Undo your acceptance — the de-accept in `docs/DESIGN.md`'s lifecycle.
 *
 * The row stays: deleting it would hide that it happened. What does go is the
 * reservation, because the reservation *is* the acceptance — an owner's yes is
 * what locks their things, so taking the yes back has to unlock them or they
 * are frozen by a promise nobody is making any more.
 *
 * Any single de-accept holds the whole trade, which is why an accepted trade
 * drops back to `pending` rather than staying agreed with a gap in it.
 */
export async function revokeAcceptance(
  db: Database,
  offerId: string,
  userId: string,
): Promise<{ freed: string[] }> {
  return db.transaction(async (tx) => {
    const [offer] = await tx.execute<Row>(
      sql`select trade_id from trade_offers where id = ${offerId}`,
    )
    const tradeId = offer!['trade_id']!

    // The one order (`index.ts`): the trade, then what it holds.
    await lockTrades(tx, [tradeId])
    await lockItems(tx, sql`i.active_trade_id = ${tradeId} and i.owner_id = ${userId}`)

    await tx.execute(
      sql`update trade_acceptances set revoked_at = now()
          where offer_id = ${offerId} and user_id = ${userId} and revoked_at is null`,
    )

    const released = await tx.execute<Row>(
      sql`update items set active_trade_id = null, status = ${RELEASED}
          where active_trade_id = ${tradeId} and owner_id = ${userId}
          returning id, status`,
    )

    // Only out of `accepted`. `countered` says a newer offer is on the table,
    // which is a different fact about the trade and not one this undoes.
    await tx.execute(sql`
      update trades set state = 'pending' where id = ${tradeId} and state = 'accepted'
    `)

    return { freed: backOnTheMarket(released) }
  })
}

/**
 * Finish the trade, and take the copy that outlives the listings.
 *
 * The snapshot is what lets a listing be deleted, or its owner erased, without
 * taking the counterparty's history with it — and it stops an edit to an item
 * quietly rewriting what was traded.
 *
 * Only an agreed trade finishes, judged under its lock. The last «Mottatt»
 * can land in the same moment as a deletion that ends the trade, and
 * completing it after that would mark as traded what the deletion had just
 * put back on the market; and a marker set again on a finished trade must not
 * move the day it finished, which is where the retention clock starts.
 *
 * Returns the listings it let go of rather than marking traded: anything it
 * held that the final version does not give. A counter-offer lets go of what
 * the trade held for the version before, but one made before it did left them
 * held, and completing marked them traded — things the deal had dropped.
 */
export async function completeTrade(db: Database, tradeId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    // The one order (`index.ts`): the trade, then what it holds.
    const state = (await lockTrades(tx, [tradeId])).get(tradeId)
    if (state !== 'accepted' && state !== 'paused') return []
    await lockItems(tx, sql`i.active_trade_id = ${tradeId}`)

    await tx.execute(sql`
      insert into trade_item_snapshots
        (trade_id, item_id, giver_position, title, kind, category, estimated_value_nok, cover_url)
      select ${tradeId}, i.id, oi.giver_position, i.title, i.kind, i.category, i.estimated_value_nok,
             (select url from item_media m where m.item_id = i.id order by m.position limit 1)
      from trade_offers o
      join trade_offer_items oi on oi.offer_id = o.id
      join items i on i.id = oi.item_id
      where o.trade_id = ${tradeId}
        and o.seq = (select max(seq) from trade_offers where trade_id = ${tradeId})
      on conflict do nothing
    `)

    await tx.execute(
      sql`update items set status = 'traded', active_trade_id = null
          where active_trade_id = ${tradeId}
            and id in (select oi.item_id from trade_offers o
                       join trade_offer_items oi on oi.offer_id = o.id
                       where o.trade_id = ${tradeId}
                         and o.seq = (select max(seq) from trade_offers where trade_id = ${tradeId}))`,
    )
    const released = await tx.execute<Row>(
      sql`update items set active_trade_id = null, status = ${RELEASED}
          where active_trade_id = ${tradeId}
          returning id, status`,
    )
    await tx.execute(
      sql`update trades set state = 'completed', closed_at = now() where id = ${tradeId}`,
    )
    // Handover is open while a withdrawal question waits, so everybody can
    // have sent and received with one still unanswered. It is moot now, and
    // it closes as lapsed rather than staying open for an answer that would
    // put a finished trade back to `accepted`.
    await tx.execute(
      sql`update trade_withdrawals set state = 'expired', resolved_at = now()
          where trade_id = ${tradeId} and state = 'waiting'`,
    )
    return backOnTheMarket(released)
  })
}

/** How a trade is ended, beyond the code that says why. */
export type Ending = {
  /**
   * Whoever ended it — the one who declined, withdrew, answered yes, or whose
   * yes in another trade pushed this one out. Everybody else in the trade is
   * told (`TOLD` in `close.ts`); they are not told about their own move.
   */
  actor?: string | null
  /**
   * Only while it is still a negotiation, judged under the lock — the rule for
   * a person's own «Avslå» and «Trekk deg». Read before the lock, a decline
   * landing in the moment the last yes agreed the trade ended an agreed trade,
   * which is the withdrawal question on 08a and needs the others' yes. A trade
   * that has ended under it is refused in words rather than passed over.
   */
  onlyWhileNegotiating?: boolean
}

/**
 * Release everything a trade was holding, and say why it ended.
 *
 * Returns the listings that went back on the market, because wishes pointing at
 * them were dead while the trade held them and the caller has to look again.
 */
export async function cancelTrade(
  db: Database,
  tradeId: string,
  code: CloseCode,
  ending: Ending = {},
): Promise<string[]> {
  return db.transaction((tx) => endTrade(tx, tradeId, code, ending))
}

/**
 * `cancelTrade` inside a transaction the caller already holds — for a caller
 * that has locked the trade and decided on its state, and must not let go of
 * the lock before the trade has ended.
 *
 * The code says why (`close.ts` has the words it is stored with). A trade ends
 * once: one that has already ended keeps the reason it ended with, and this
 * writes nothing — a decline landing just after a deletion must not tell the
 * others the trade was declined.
 */
export async function endTrade(
  tx: Tx,
  tradeId: string,
  code: CloseCode,
  ending: Ending = {},
): Promise<string[]> {
  // The one order (`index.ts`): the trade, then what it holds. A caller that
  // holds them already — an answer to a withdrawal, an acceptance pushing
  // this trade out — takes nothing new here.
  const state = (await lockTrades(tx, [tradeId])).get(tradeId)
  if (ending.onlyWhileNegotiating) {
    if (state === 'completed' || state === 'cancelled') {
      throw conflict('trade_closed', 'Byttet er allerede avsluttet.')
    }
    if (state && !NEGOTIABLE.includes(state)) {
      throw conflict('needs_permission', 'Alle har godtatt. Du må spørre de andre først.')
    }
  }
  if (!state || state === 'completed' || state === 'cancelled') return []
  await lockItems(tx, sql`i.active_trade_id = ${tradeId}`)

  const freed = await tx.execute<Row>(
    sql`update items set active_trade_id = null, status = ${RELEASED}
        where active_trade_id = ${tradeId}
        returning id, status`,
  )
  await tx.execute(
    sql`update trades set state = 'cancelled', closed_at = now(),
               close_code = ${code}::trade_close_code, close_reason = ${closeReasonSql(code)}
        where id = ${tradeId}`,
  )
  // A withdrawal question still waiting is moot: the trade it asked about has
  // ended under it. Closed as lapsed, because an answer given later to a
  // waiting row — a no, or «Angre forespørselen» — puts the trade back to
  // `accepted`.
  await tx.execute(
    sql`update trade_withdrawals set state = 'expired', resolved_at = now()
        where trade_id = ${tradeId} and state = 'waiting'`,
  )
  // Told here, where the ending is decided and only when it is: a trade that
  // had already ended returned above, so nobody hears of one ending twice.
  // Nobody already erased either — a tombstone has no list to read it in.
  if (TOLD[code]) {
    await tx.execute(sql`
      insert into notifications (user_id, type, payload)
      select p.user_id, 'trade_cancelled',
             jsonb_build_object('tradeId', ${tradeId}::text, 'reason', ${code}::text)
      from trade_participants p join users u on u.id = p.user_id
      where p.trade_id = ${tradeId} and u.anonymised_at is null
        and p.user_id is distinct from ${ending.actor ?? null}::uuid
    `)
  }
  return backOnTheMarket(freed)
}
