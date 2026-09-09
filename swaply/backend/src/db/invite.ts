// Mint an invitation from the command line.
//
// Somebody has to be first: with `INVITE_ONLY=1` there is no way into a fresh
// deployment through the app itself, and `invites.inviter_id` is nullable for
// exactly this. Pass an e-mail to invite on an existing member's behalf.
//
//   pnpm invite
//   pnpm invite ola@epost.no
import { sql } from 'drizzle-orm'

import { createInvite } from '../lib/invites.js'
import { connect } from './index.js'

const { client, db } = connect()

const email = process.argv[2]
let inviterId: string | null = null

if (email) {
  const [row] = await db.execute<{ id: string }>(
    sql`select id from users where email = ${email} and anonymised_at is null`,
  )
  if (!row) {
    await client.end()
    throw new Error(`No account with the e-mail ${email}.`)
  }
  inviterId = row.id
}

const { url } = await createInvite(db, { inviterId })
await client.end()

console.log(url)
console.log(email ? `Invitation from ${email}. One use.` : 'Invitation from nobody. One use.')
