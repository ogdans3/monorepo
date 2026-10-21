import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { TERMS_VERSION } from '../lib/constants.js'
import { badRequest, conflict } from '../lib/errors.js'
import { many, one, type Row } from '../lib/rows.js'
import {
  declineTrade,
  markHandover,
  requestWithdrawal,
} from '../trades/actions.js'
import { counterAndAgree } from '../trades/accept.js'
import { acceptOffer, completeTrade, startTalking } from '../trades/trades.js'
import type { Cycle } from '../trades/cycles.js'
import { expressWish, openTradeOver, takeBackWish } from '../trades/wish.js'
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
 * `expressWish`, `acceptOffer`, `counterAndAgree`, `declineTrade`,
 * `markHandover`, `requestWithdrawal`, `completeTrade` — and the hearts are
 * taken back with `takeBackWish` once the trade stands. Nothing here writes a
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

/**
 * A listing for this scenario to spend, made for it.
 *
 * Never one that is already there. An `accepted` scenario reserves what it is
 * given and a `completed` one marks it `traded` for good, so reaching for the
 * nearest available listing spends the owner's real inventory — and if that
 * listing is sitting in somebody else's open offer, accepting here displaces
 * their trade. Both are the tool reaching outside the ring through the front
 * door.
 *
 * The «[test]» in the title is what makes them findable afterwards;
 * Nullstill → gjenstander clears them. `made_by_scenario` is what keeps them
 * in the ring: the ones made on the admin's own account were on every real
 * person's Oppdag, by owner, and a real heart on one opened a real trade
 * (`trades/ring.ts`).
 */
async function somethingToGive(db: Database, owner: Row, steps: string[]): Promise<string> {
  const used = await many(db, sql`select title from items where owner_id = ${owner['id']}`)
  const taken = new Set(used.map((r) => r['title']))
  // Never a service. «A service is never exclusive» — one person can paint
  // three living rooms — so it never holds a reservation, and a scenario built
  // on one silently means something else: `accepted` reserves nothing and
  // nothing can be displaced. The catalogue has one, and after enough
  // scenarios the titles ran out and reached it.
  const things = CATALOGUE.filter((f) => f.kind !== 'service')
  const fixture =
    things.find((f) => !taken.has(`[test] ${f.title}`)) ?? things[used.length % things.length]!
  const title = `[test] ${fixture.title}`
  const made = await one(
    db,
    sql`insert into items (owner_id, kind, title, description, category, subcategory,
                           condition, estimated_value_nok, town, made_by_scenario)
        values (${owner['id']}, ${fixture.kind ?? 'item'}, ${title},
                ${fixture.description ?? null}, ${fixture.category}::category,
                ${fixture.subcategory ?? null},
                ${fixture.kind === 'service' ? null : (fixture.condition ?? 'good')},
                ${fixture.valueNok ?? null}, ${owner['town'] ?? null}, true)
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

  // Everything else starts from a ring of wishes, and the hearts that make it
  // are taken back once the trade over it stands — through the product's own
  // «ta tilbake hjertet», whatever became of the scenario. Left standing, they
  // were wishes nobody had, and the next scenario's hearts closed new rings
  // through them: a mixed one, an old «[test]» thing for a new one, opened by
  // the heart or by the hourly sweep, until «Bytter» held trades nobody asked
  // for. A trade does not lean on the hearts that opened it, so it stands
  // without them; «Likt» (12) just no longer shows them on the «[test]» things.
  const pressed: Array<{ who: string; what: string }> = []
  const takeBack = async () => {
    for (const { who, what } of pressed.splice(0)) await takeBackWish(db, who, what)
  }
  try {
    const built = await fromWishes(db, people, scenario, ring, gives, steps, pressed)
    await takeBack()
    steps.push('Hjertene ble tatt tilbake, så de ikke åpner flere bytter')
    return built
  } catch (err) {
    // The error the scenario met is the one to say; one from taking back
    // would only hide it.
    await takeBack().catch(() => {})
    throw err
  }
}

/**
 * The scenario from the ring of wishes on: the hearts, the trade over this
 * scenario's own ring, and the moves that bring it to [scenario.state].
 * Every heart pressed goes into [pressed] as it is pressed.
 */
async function fromWishes(
  db: Database,
  people: Row[],
  scenario: Scenario,
  ring: Row[],
  gives: string[],
  steps: string[],
  pressed: Array<{ who: string; what: string }>,
): Promise<Built> {
  const want = ring.length
  // Goods travel against the wishes: person i wants what person i+1 is
  // giving, so i+1 gives to i.
  const opened = new Set<string>()
  for (let i = 0; i < want; i++) {
    const wanter = ring[i]!
    const wanted = gives[(i + 1) % want]!
    const wish = await expressWish(db, wanter['id'], wanted)
    pressed.push({ who: wanter['id'], what: wanted })
    steps.push(`${firstName(wanter)} likte en ting`)
    if (wish.tradeId && wish.tradeIsNew) opened.add(wish.tradeId)
  }

  // The trade over this scenario's own ring — its own listings, going round
  // the way its hearts point — and not whichever trade the last heart named.
  // A heart answers with the first ring it closes, and with an older heart
  // still standing on an older «[test]» thing that can be a mixed one; the
  // scenario then built its state on that, and reported it as its own. In
  // giving order: the admin gives to the last of the ring, and so on back
  // round to the admin — 0, 1 in a pair and 0, 2, 1 in a ring of three.
  const seats = [0, ...Array.from({ length: want - 1 }, (_, n) => want - 1 - n)]
  const own: Cycle = seats.map((at) => ({
    userId: ring[at]!['id'] as string,
    givesItemId: gives[at]!,
  }))
  const tradeId = await openTradeOver(db, own)
  if (!tradeId) {
    throw conflict(
      'no_cycle',
      opened.size > 0
        ? 'Hjertene lukket en annen sirkel, med ting fra før, i stedet for denne. ' +
          'Nullstill likes og bytter for kontoene og prøv igjen.'
        : 'Ønskene lukket ingen sirkel. Sjekk at tingene er ledige og at ingen er blokkert.',
    )
  }
  steps.push(want === 3 ? 'Sirkelen lukket seg — treveis' : 'Sirkelen lukket seg — toveis')
  opened.delete(tradeId)
  if (opened.size > 0) {
    // Said, because the tool says what it did: these are the product's answer
    // to hearts it pressed, inside the ring, and «Nullstill → bytter» ends them.
    steps.push(
      opened.size === 1
        ? 'Hjertene åpnet også et annet bytte, med ting fra før'
        : `Hjertene åpnet også ${opened.size} andre bytter, med ting fra før`,
    )
  }

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
    // Agreed to by the one proposing it, as in the product: 09e draws them
    // as «✓ Har godtatt».
    await counterAndAgree(db, tradeId, other['id'], composition, cash, { termsVersion: TERMS_VERSION })
    steps.push(`${firstName(other)} foreslo 200 kr i mellomlegg`)
    return { tradeId, steps, participants: ring.map((p) => p['id']) }
  }

  if (scenario.state === 'displaced') {
    // 09f's other half: two trades want the same listing, and the owner's
    // acceptance in one closes the other with a reason in words.
    //
    // It has to happen *before* the ring is agreed — once the contested thing
    // is reserved it is no longer available and no competitor can form. The
    // first version of this ran after, and quietly built an ordinary accepted
    // trade while reporting a displaced one.
    //
    // The competitor is a conversation rather than a second cycle, and that is
    // deliberate: «several people can be in a talking trade about the same
    // item at once, which is correct — three people may want the same drill».
    // A second cycle would have to be *found*, and which one the search
    // returns depends on every wish those two people have ever expressed.
    if (people.length < 3) {
      throw badRequest('need_more_accounts', 'Et fortrengt bytte trenger tre kontoer.')
    }
    const third = people[2]!
    const contested = gives[0]!
    const rival = await startTalking(
      db,
      third['id'],
      contested,
      'Hei! Jeg vil gjerne ha denne — er den ledig?',
    )
    steps.push(`${firstName(third)} spurte om det samme som ${firstName(other)}`)

    const offer = await currentOffer(db, tradeId)
    const owner = participants.find((p) => p['id'] === ring[0]!['id'])!
    const result = await acceptOffer(db, offer['id'], owner['id'], '2026-09-06')
    if (!result.displaced.includes(rival.tradeId)) {
      throw conflict('not_displaced', 'Det andre byttet ble ikke fortrengt.')
    }
    steps.push('Du godtok her, og samtalen med den tredje ble avsluttet automatisk')
    return {
      tradeId: rival.tradeId,
      steps,
      participants: [...ring.map((p) => p['id']), third['id']],
    }
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

  return { tradeId, steps, participants: ring.map((p) => p['id']) }
}
