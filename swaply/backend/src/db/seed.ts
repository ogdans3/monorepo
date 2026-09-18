// Development data: two people who want each other's things, so the app has
// something to show the moment it starts. Refuses to touch anything but a local
// database, for the same reason the test guard does.
import { sql } from 'drizzle-orm'

import { hashPassword } from '../auth/passwords.js'
import { createInvite } from '../lib/invites.js'
import { findCyclesThrough } from '../trades/cycles.js'
import { openTradeFromCycle, startTalking } from '../trades/trades.js'
import { connect } from './index.js'

const { client, db } = connect()

const { hostname } = new URL(process.env['DATABASE_URL']!)
if (!['localhost', '127.0.0.1', 'db'].includes(hostname)) {
  throw new Error(`Refusing to seed ${hostname}: this wipes the database.`)
}

await db.execute(sql`truncate table users, trades, retained.identities cascade`)

const password = await hashPassword('swaply123')

async function user(name: string, email: string, phone: string, town: string, interests: string[]) {
  const [row] = await db.execute<{ id: string }>(sql`
    insert into users (display_name, email, phone, town, password_hash, interests,
                       bankid_subject, bankid_verified_at)
    values (${name}, ${email}, ${phone}, ${town}, ${password},
            ${sql.raw(`'{${interests.join(',')}}'::category[]`)},
            ${`dev-${email}`}, now())
    returning id`)
  return row!.id
}

async function item(
  owner: string,
  title: string,
  category: string,
  value: number,
  opts: { description?: string; subcategory?: string; kind?: 'item' | 'service' } = {},
) {
  const [row] = await db.execute<{ id: string }>(sql`
    insert into items (owner_id, kind, title, description, category, subcategory,
                       condition, estimated_value_nok, town)
    values (${owner}, ${opts.kind ?? 'item'}, ${title}, ${opts.description ?? null},
            ${category}::category, ${opts.subcategory ?? null},
            ${opts.kind === 'service' ? null : 'good'}, ${value},
            (select town from users where id = ${owner}))
    returning id`)
  return row!.id
}

const ola = await user('Ola N.', 'ola@epost.no', '412 34 567', 'Trondheim',
  ['verktoy', 'gaming', 'sykling'])
const kari = await user('Kari N.', 'kari@epost.no', '911 22 333', 'Bergen',
  ['friluft', 'bat', 'klaer'])
const per = await user('Per H.', 'per@epost.no', '922 33 444', 'Stjørdal',
  ['sykling', 'sport', 'hjem'])

const drill = await item(ola, 'Bosch drill 18V', 'verktoy', 600, {
  description: 'Lite brukt, lader og koffert følger med.',
  subcategory: 'Elektroverktøy',
})
await item(ola, 'Sykkelhjelm', 'sykling', 250)
const board = await item(ola, 'Skateboard', 'sport', 450)
const console_ = await item(kari, 'Retro spillkonsoll', 'gaming', 1200, {
  description: 'To kontrollere og ni spill.',
})
const rod = await item(kari, 'Fiskestang med snelle', 'friluft', 850, {
  description: 'Shimano-stang, 2,7 m, brukt to somre.',
  subcategory: 'Fiske',
})
const kayak = await item(kari, 'Kajakk med åre', 'bat', 2400)
const bike = await item(per, 'Bysykkel, dame', 'sykling', 1100)
await item(per, 'Snømåking en vinter', 'hjem', 1500, { kind: 'service' })

// A two-way loop that is ready to accept, and a conversation that is not a
// trade yet — the two states the trade list has to tell apart.
await db.execute(sql`insert into likes (from_user, target_item) values (${ola}, ${console_})`)
await db.execute(sql`insert into likes (from_user, target_item) values (${kari}, ${drill})`)
const [cycle] = await findCyclesThrough(db, kari, drill)
if (cycle) await openTradeFromCycle(db, cycle)

await startTalking(db, per, rod, 'Hei! Er fiskestangen fortsatt ledig?')

// A three-way ring, on listings the two-way trade is not already holding: Ola
// wants the kayak, Kari wants the bicycle, Per wants the skateboard. Goods go
// the other way round — Ola gives the skateboard to Per, Per the bicycle to
// Kari, Kari the kayak to Ola.
//
// Opened here rather than left for the nightly sweep. Writing the likes
// straight into the table skips the search that the heart runs, and the ring
// the seed advertised was one nothing would ever find: it went through the
// drill, which the two-way trade above already has on its table.
await db.execute(sql`insert into likes (from_user, target_item) values (${ola}, ${kayak})`)
await db.execute(sql`insert into likes (from_user, target_item) values (${kari}, ${bike})`)
await db.execute(sql`insert into likes (from_user, target_item) values (${per}, ${board})`)
const [ring] = await findCyclesThrough(db, per, board)
if (ring) await openTradeFromCycle(db, ring)

// And one wish pointing at the rod, so the fishing rod has a like on it for
// screen 12 to show.
await db.execute(sql`insert into likes (from_user, target_item) values (${ola}, ${rod})`)

// Two links to open the closed door with: one that carries a listing, the way
// the share button makes them, and one that carries only an invitation.
const shared = await createInvite(db, { inviterId: ola, itemId: drill })
const plain = await createInvite(db, { inviterId: kari })

await client.end()

console.log(`Seeded. Sign in as ola@epost.no / kari@epost.no / per@epost.no, password "swaply123".`)
console.log(`\nInvitations, one use each:`)
console.log(`  a shared listing  ${shared.url}`)
console.log(`  a plain invite    ${plain.url}`)
