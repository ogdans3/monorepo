import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { conflict, notFound } from '../lib/errors.js'
import { one } from '../lib/rows.js'
import { sweepForCycles } from './sweep.js'
import { acceptOffer, type AcceptResult } from './trades.js'
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

  const result = await acceptOffer(db, view.offerId, userId, termsVersion)

  await db.execute(sql`
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
