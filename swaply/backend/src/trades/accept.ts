import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { ApiError, conflict, notFound } from '../lib/errors.js'
import { one } from '../lib/rows.js'
import type { OfferCash, OfferItem } from './offer.js'
import { sweepForCycles } from './sweep.js'
import { acceptOffer, offerChanged, proposeCounterOffer, type AcceptResult } from './trades.js'
import { tradeView } from './view.js'

/**
 * Saying yes, with everything that has to be true first and everything that
 * has to happen after.
 *
 * It lives here rather than in the route because the test tooling says yes on
 * the counterparty's behalf, and a second copy of the guards is a second copy
 * that drifts. The first version of «Som motparten» called `acceptOffer`
 * directly and reached two states the product cannot produce: an accepted
 * trade whose offer has an empty side, and a completed trade un-completed.
 */
export async function acceptTrade(
  db: Database,
  tradeId: string,
  userId: string,
  termsVersion: string,
  /**
   * The version the person was shown, when the client says which. Without
   * it — the app as released on 30.09 sends none — the yes is for the newest.
   * Either way `acceptOffer` checks under the lock that it still is.
   */
  offerId?: string | null,
  /**
   * No «Noen godtok byttet» to the others. For the yes that comes with a
   * counter-offer (`counterAndAgree`): they are told about the new version
   * once, as «Nytt forslag i byttet», and the yes is part of that news.
   */
  opts: { quiet?: boolean } = {},
): Promise<AcceptResult> {
  const view = await tradeView(db, tradeId, userId)
  if (!view) throw notFound('Fant ikke byttet.')
  if (!view.offerId) throw conflict('no_offer', 'Det finnes ikke noe forslag å godta.')
  if (['completed', 'cancelled'].includes(view.state)) {
    throw conflict('trade_closed', 'Byttet er avsluttet.')
  }
  if (view.state === 'paused') {
    // 08b: somebody has asked to get out and the others are answering.
    // Accepting again here would quietly overwrite that question.
    throw conflict('trade_paused', 'Byttet er pauset mens noen svarer på en forespørsel.')
  }
  // The version on the screen has to be the one on the table, or the yes is
  // for something the person has not seen. An id from another trade is never
  // this one's newest, so it can only ever be refused here.
  if (offerId && offerId !== view.offerId) throw offerChanged()

  // «Each side of a hop is a list of 1–3 items.» The opening offer behind
  // «Jeg vil ha» names their listing and nothing back, and accepting that is
  // one tap that gives a thing away for nothing.
  const emptyHanded = await one(
    db,
    sql`select 1 from trade_participants p
        where p.trade_id = ${tradeId}
          and not exists (
            select 1 from trade_offer_items oi
            where oi.offer_id = ${view.offerId}::uuid and oi.giver_position = p.position)`,
  )
  if (emptyHanded) {
    throw conflict(
      'incomplete_offer',
      'Forslaget er ikke ferdig — alle må legge noe i byttet. Foreslå et motbytte.',
    )
  }

  // Asked again under the lock: a counter-offer may land after the read above.
  const result = await acceptOffer(db, view.offerId, userId, termsVersion)

  if (!opts.quiet || result.everyoneAccepted) await db.execute(sql`
    insert into notifications (user_id, type, payload)
    select p.user_id, ${result.everyoneAccepted ? 'trade_accepted' : 'trade_partly_accepted'},
           jsonb_build_object('tradeId', ${tradeId}::text)
    from trade_participants p where p.trade_id = ${tradeId} and p.user_id <> ${userId}
  `)

  // Displacing a trade puts whatever it was holding back on the market, and an
  // item becoming available again is one of the three search triggers.
  await sweepForCycles(db, result.freed)
  return result
}

/**
 * A counter-offer, and the yes of whoever proposed it.
 *
 * Proposing a version is agreeing to it: 09e draws the one who proposed it as
 * «✓ Har godtatt», and the other side's button as «Godta endringen» — decided
 * by the product owner 02.10.2026. So the proposal is followed by the
 * proposer's own yes, through every guard any yes goes through, and like any
 * owner's yes it holds their things in the new version for this trade.
 *
 * Only when the client names the terms the person agreed to: the app says
 * under «Send motbytte» that sending is agreeing, and an app from before that,
 * which names none, proposes without agreeing as it always did. Never for a
 * device, which may not say yes at all, and never to a version with a side
 * still empty, which nobody can say yes to. And if the yes cannot be given —
 * the other side countered in the same moment, or a thing went to another
 * trade first — the proposal stands without it, as one from the old app does:
 * the trade then shows what is true, and «Godta byttet» is there to press.
 */
export async function counterAndAgree(
  db: Database,
  tradeId: string,
  userId: string,
  items: OfferItem[],
  cash: OfferCash | undefined,
  opts: { baseOfferId?: string | null; termsVersion?: string | null } = {},
): Promise<{ offerId: string; freed: string[]; agreed: boolean }> {
  const { offerId, freed } = await proposeCounterOffer(db, tradeId, userId, items, cash, {
    baseOfferId: opts.baseOfferId,
  })
  if (!opts.termsVersion) return { offerId, freed, agreed: false }

  const person = await one(db, sql`select email from users where id = ${userId}`)
  if (!person?.['email']) return { offerId, freed, agreed: false }

  try {
    await acceptTrade(db, tradeId, userId, opts.termsVersion, offerId, { quiet: true })
    return { offerId, freed, agreed: true }
  } catch (e) {
    // A refusal is a state of the trade, not a failure of the proposal.
    if (e instanceof ApiError && e.statusCode === 409) return { offerId, freed, agreed: false }
    throw e
  }
}
