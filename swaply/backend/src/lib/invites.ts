import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { env } from '../env.js'
import { ApiError, badRequest } from './errors.js'
import type { Row } from './rows.js'

/**
 * A connection or an open transaction. Admitting someone has to happen in the
 * same transaction as creating them, or a lost race leaves an account nobody
 * invited standing in an invite-only app.
 */
export type Executor = Pick<Database, 'execute'>

// Only the hash is stored, the same way a session token and a password are. A
// stolen database should not hand out working invitations, and an invitation is
// the key to a closed app.
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

// Sixteen bytes, not the thirty-two a session gets. This one ends up in a chat
// message that a person reads, and sometimes types; 128 bits is already far past
// guessing, and the rest would only be length.
const mint = () => randomBytes(16).toString('base64url')

/** The link that gets pasted into a chat. One shape for both kinds of invite. */
export const inviteUrl = (token: string) => `${env.WEB_ORIGIN}/i/${token}`

/**
 * A new invitation, optionally carrying the item it was shared from.
 *
 * `inviterId` is null for the invitations that bootstrap the thing — somebody
 * has to be first, and the schema allows it.
 */
export async function createInvite(
  db: Executor,
  opts: { inviterId?: string | null; itemId?: string | null } = {},
): Promise<{ token: string; url: string }> {
  const token = mint()
  await db.execute(
    sql`insert into invites (token_hash, inviter_id, item_id)
        values (${hash(token)}, ${opts.inviterId ?? null}, ${opts.itemId ?? null})`,
  )
  return { token, url: inviteUrl(token) }
}

/** The row behind a raw token, or null. */
export async function findInvite(db: Executor, token: string): Promise<Row | null> {
  const rows = await db.execute<Row>(sql`select * from invites where token_hash = ${hash(token)}`)
  return (rows[0] as Row | undefined) ?? null
}

/**
 * Spend an invitation on the account that was just made.
 *
 * **An invitation is used once.** The schema says so — `used_by` and `used_at`
 * are single columns — and it is what makes an invite a key rather than a public
 * door: a link that opens for everyone who ever sees it is not an invitation.
 * The consequence is deliberate and worth knowing: a share link posted in a
 * group admits the first person who takes it, and the next one is told plainly
 * that it is spent and who to ask for another. The item page behind the link
 * keeps working for all of them, because looking is not joining.
 */
export async function redeemInvite(db: Executor, token: string, userId: string): Promise<Row> {
  const rows = await db.execute<Row>(
    sql`update invites set used_by = ${userId}, used_at = now()
        where token_hash = ${hash(token)} and used_by is null
        returning *`,
  )
  const invite = rows[0] as Row | undefined
  if (invite) return invite

  // Two different failures, and the person holding the link needs to know which.
  if (await findInvite(db, token)) {
    throw badRequest(
      'invite_used',
      'Denne invitasjonen er allerede brukt. Be den som sendte den om en ny.',
    )
  }
  throw badRequest('invite_unknown', 'Vi kjenner ikke igjen denne invitasjonen.')
}

/**
 * The gate in front of making an account: spend the token, or say why not.
 *
 * Returns the invitation that was spent, or null where none was given and none
 * was demanded. A redemption is always recorded when a token is handed over —
 * `inviteOnly` only decides whether an account may be made without one.
 */
export async function admit(
  db: Executor,
  token: string | undefined,
  userId: string,
  inviteOnly: boolean,
): Promise<Row | null> {
  if (token) return redeemInvite(db, token, userId)
  if (!inviteOnly) return null
  throw new ApiError(
    403,
    'invite_required',
    'Swaply er invitasjonsbasert. Du trenger en invitasjon fra noen som allerede er med.',
  )
}
