import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { badRequest, conflict } from '../lib/errors.js'
import { many, one, type Row } from '../lib/rows.js'
import {
  declineTrade,
  markHandover,
  requestWithdrawal,
} from '../trades/actions.js'
import { validateOffer } from '../trades/offer.js'
import { acceptOffer, completeTrade, proposeCounterOffer, startTalking } from '../trades/trades.js'
import { expressWish } from '../trades/wish.js'
import { CATALOGUE } from './fixtures.js'

/**
 * Bygg et bytte — a trade in a named state, in one call.
 *
 * The lever that earns the section. Nine of the states `TradeDetailScreen`
 * draws are a multi-account journey each: `countered` alone needs two accounts,
 * two listings, two wishes pointing the right way, a cycle search that finds
 * them and then somebody else's move.
 *
 * Every one of them is built by pressing the product's own buttons in order —
 * `expressWish`, `acceptOffer`, `proposeCounterOffer`, `declineTrade`,
 * `markHandover`, `requestWithdrawal`, `completeTrade`. Nothing here writes a
 * trade, a like, an offer or an acceptance directly. `db/seed.ts` took that
 * shortcut once and advertised a three-way ring that nothing would ever have
 * found, which is the whole argument: a state reached by a different route is
 * not the state the product produces, and testing it proves nothing.
 *
 * `steps` comes back so the screen can say what it did, in order, in Norwegian.
 */
export const SCENARIO_STATES = [
  'talking',
  'pending',
  'countered',
  'accepted',
  'handover',
  'paused',
  'completed',
  'declined',
  'displaced',
] as const

export type ScenarioState = (typeof SCENARIO_STATES)[number]

export type Scenario = {
  shape: 'two-way' | 'three-way'
  state: ScenarioState
  /** Test accounts to build it with. Filled from the ring when short. */
  with?: string[]
}

type Built = { tradeId: string | null; steps: string[]; participants: string[] }

const firstName = (row: Row) => String(row['display_name'] ?? 'Testbruker').split(' ')[0]

/** An available listing of theirs, or a new one from the catalogue. */
async function somethingToGive(db: Database, owner: Row, steps: string[]): Promise<string> {
  const existing = await one(
    db,
    sql`select id, title from items
        where owner_id = ${owner['id']} and deleted_at is null
          and status = 'available' and active_trade_id is null
        order by created_at limit 1`,
  )
  if (existing) return existing['id']

  const used = await many(db, sql`select title from items where owner_id = ${owner['id']}`)
  const taken = new Set(used.map((r) => r['title']))
  const fixture = CATALOGUE.find((f) => !taken.has(f.title)) ?? CATALOGUE[0]!
  const made = await one(
    db,
    sql`insert into items (owner_id, kind, title, description, category, subcategory,
                           condition, estimated_value_nok, town)
        values (${owner['id']}, ${fixture.kind ?? 'item'}, ${fixture.title},
                ${fixture.description ?? null}, ${fixture.category}::category,
                ${fixture.subcategory ?? null},
                ${fixture.kind === 'service' ? null : (fixture.condition ?? 'good')},
                ${fixture.valueNok ?? null}, ${owner['town'] ?? null})
        returning id, title`,
  )
  steps.push(`${firstName(owner)} la ut «${made!['title']}»`)
  return made!['id']
}

async function currentOffer(db: Database, tradeId: string): Promise<Row> {
  const offer = await one(
    db,
    sql`select * from trade_offers where trade_id = ${tradeId} order by seq desc limit 1`,
  )
  if (!offer) throw conflict('no_offer', 'Byttet fikk aldri et forslag.')
  return offer
}

export async function buildScenario(
  db: Database,
  people: Row[],
  scenario: Scenario,
): Promise<Built> {
  const steps: string[] = []
  const want = scenario.shape === 'three-way' ? 3 : 2
  if (people.length < want) {
    throw badRequest(
      'need_more_accounts',
      `Et ${want === 3 ? 'treveis' : 'toveis'}-bytte trenger ${want} kontoer. Lag en til først.`,
    )
  }
  const ring = people.slice(0, want)
  const gives: string[] = []
  for (const person of ring) gives.push(await somethingToGive(db, person, steps))

  // «Jeg vil ha» — the half-filled offer, and the only state with no cycle
  // behind it.
  if (scenario.state === 'talking') {
    const opened = await startTalking(
      db,
      ring[1]!['id'],
      gives[0]!,
      'Hei! Er denne fortsatt ledig?',
    )
    steps.push(`${firstName(ring[1]!)} skrev den første meldingen`)
    return { tradeId: opened.tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  // Everything else starts from a ring of wishes. Goods travel against them:
  // person i wants what person i+1 is giving, so i+1 gives to i.
  let tradeId: string | null = null
  for (let i = 0; i < want; i++) {
    const wanter = ring[i]!
    const wanted = gives[(i + 1) % want]!
    const wish = await expressWish(db, wanter['id'], wanted)
    steps.push(`${firstName(wanter)} likte en ting`)
    if (wish.tradeId) tradeId = wish.tradeId
  }
  if (!tradeId) {
    throw conflict(
      'no_cycle',
      'Ønskene lukket ingen sirkel. Sjekk at tingene er ledige og at ingen er blokkert.',
    )
  }
  steps.push(want === 3 ? 'Sirkelen lukket seg — treveis' : 'Sirkelen lukket seg — toveis')

  const participants = await many(
    db,
    sql`select p.position, u.* from trade_participants p join users u on u.id = p.user_id
        where p.trade_id = ${tradeId} order by p.position`,
  )
  // The cycle decides the seating, not the order the accounts were handed in,
  // so who is where has to be read back rather than assumed. `viewer` is the
  // person the screens are for — the admin, always first in `ring` — and
  // `other` is somebody else, because a counter-offer from yourself does not
  // draw 09e and a withdrawal request from yourself does not draw 08b.
  const viewer = participants.find((p) => p['id'] === ring[0]!['id']) ?? participants[0]!
  const other = participants.find((p) => p['id'] !== viewer['id'])!

  if (scenario.state === 'pending') return { tradeId, steps, participants: ring.map((p) => p['id']) }

  if (scenario.state === 'declined') {
    await declineTrade(db, tradeId, other['id'])
    steps.push(`${firstName(other)} avslo byttet`)
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  if (scenario.state === 'countered') {
    // The counter comes from somebody else, so the viewer lands on 09e — «Nytt
    // forslag fra …» — rather than on their own proposal.
    const offer = await currentOffer(db, tradeId)
    const items = await many(
      db,
      sql`select oi.item_id, oi.giver_position from trade_offer_items oi
          where oi.offer_id = ${offer['id']}`,
    )
    const composition = items.map((i) => ({
      itemId: i['item_id'] as string,
      giverPosition: Number(i['giver_position']),
    }))
    // «Du betaler 200 kr til …» on the viewer's own screen, which is the line
    // 09e is drawn around.
    const cash = {
      payerPosition: Number(viewer['position']),
      payeePosition: Number(other['position']),
      amountNok: 200,
    }
    await validateOffer(db, tradeId, composition, cash)
    await proposeCounterOffer(db, tradeId, other['id'], composition, cash)
    steps.push(`${firstName(other)} foreslo 200 kr i mellomlegg`)
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  // Everything below is agreed first.
  const offer = await currentOffer(db, tradeId)
  for (const person of participants) {
    await acceptOffer(db, offer['id'], person['id'], '2026-09-06')
  }
  steps.push('Alle godtok — tingene er reservert')

  if (scenario.state === 'accepted') return { tradeId, steps, participants: ring.map((p) => p['id']) }

  if (scenario.state === 'paused') {
    await requestWithdrawal(db, tradeId, other['id'])
    steps.push(`${firstName(other)} ba om å trekke seg — byttet er pauset`)
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  if (scenario.state === 'handover') {
    await markHandover(db, tradeId, other['id'], 'sent')
    steps.push(`${firstName(other)} markerte sin ting som sendt`)
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  if (scenario.state === 'completed') {
    for (const person of participants) {
      await markHandover(db, tradeId, person['id'], 'sent')
      await markHandover(db, tradeId, person['id'], 'received')
    }
    await completeTrade(db, tradeId)
    steps.push('Alle sendte og mottok — byttet er gjennomført')
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  if (scenario.state === 'displaced') {
    // 09f's other half: a second trade wanting one of the same listings, closed
    // the moment the owner's acceptance lands elsewhere. Needs a third person,
    // which is why the shape is forced.
    if (people.length < 3) {
      throw badRequest('need_more_accounts', 'Fortrengt bytte trenger tre kontoer.')
    }
    const third = people[2]!
    const theirs = await somethingToGive(db, third, steps)
    const contested = gives[0]!
    await expressWish(db, third['id'], contested)
    const closing = await expressWish(db, ring[0]!['id'], theirs)
    steps.push(`${firstName(third)} ville også ha den samme tingen`)
    if (closing.tradeId) {
      const second = await currentOffer(db, closing.tradeId)
      await acceptOffer(db, second['id'], ring[0]!['id'], '2026-09-06')
      steps.push('Det andre byttet ble avslått fordi tingen ble reservert her')
    }
    return { tradeId, steps, participants: [...ring.map((p) => p['id']), third['id']] }
  }

  return { tradeId, steps, participants: ring.map((p) => p['id']) }
}
