import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Returns the raw token. It is never stored, only its hash.
 *
 * `issuedBy` is the admin who minted it through the account switcher, and null
 * for every ordinary sign-in. It is on the row rather than in the app because
 * «you are Kari right now» is the state most easily forgotten, and a flag the
 * client kept would be lost by a refresh.
 */
export async function issueSession(
  db: Database,
  userId: string,
  opts: { issuedBy?: string } = {},
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.execute(
    sql`insert into sessions (token_hash, user_id, issued_by)
        values (${hash(token)}, ${userId}, ${opts.issuedBy ?? null})`,
  )
  // Signing in is the account's holder at the door with its own credential —
  // a password, or a device id coming back without its token — and that is
  // activity even before the token is used. A token the switcher minted is
  // the admin's doing and not the account's, so it is not.
  if (!opts.issuedBy) {
    await db.execute(sql`update users set last_active_at = now() where id = ${userId}`)
  }
  return token
}

/**
 * How stale `users.last_active_at` may be before a request writes it again.
 *
 * A write per request would be a write to `users` behind every read the app
 * makes. The stored value is only ever asked whether it is twelve months old,
 * so five minutes of lag is nothing — and it is bounded, because the next
 * request after the five minutes writes it.
 */
const ACTIVE_EVERY = '5 minutes'

/**
 * Who the bearer is, and whether they have made an account yet.
 *
 * The claim comes back from the same statement rather than a second lookup:
 * every route that writes anything has to know it, because an anonymous user may
 * look and wish but not enter into a trade with somebody under no name.
 */
export async function resolveSession(
  db: Database,
  token: string,
): Promise<{ userId: string; claimed: boolean; isAdmin: boolean; issuedBy: string | null } | null> {
  // Every authenticated request is activity, and this is the one place every
  // authenticated request passes, so it is written here — and at a sign-in, in
  // `issueSession` — and nowhere else: somebody liking what the account liked,
  // an admin reading it, the sweep passing over it — none of those is a
  // request by its own token, and none of them counts. The app sends one when
  // it is opened and when it comes back from the background, which is what
  // makes «opening the app» reach the server.
  //
  // A session the switcher minted is the admin at the controls, not the
  // account: its requests move that session's `last_seen_at`, which the sweep's
  // second witness looks past, and never the account's mark — the same line
  // `issueSession` draws when the switcher mints it.
  //
  // One statement, so the session and the account cannot disagree. The row
  // lock on `users` is taken with `skip locked`: the two statements inside a
  // `with` run in no fixed order, and a merge or an erasure holds the user
  // row and then deletes the sessions under it — waiting here would be the
  // other half of a deadlock. For a device, the only things that hold its row
  // are its own requests, each of which came through here itself, and a
  // merge or an erasure, after which there is nothing left to keep active.
  // Anything else skipped is written by the next request, since the value is
  // still stale.
  const rows = await db.execute<{
    user_id: string
    claimed: boolean
    is_admin: boolean
    issued_by: string | null
  }>(
    sql`with seen as (
          update sessions s set last_seen_at = now()
          from users u
          where s.token_hash = ${hash(token)} and u.id = s.user_id
            and u.anonymised_at is null
          returning s.user_id, (u.email is not null) as claimed, u.is_admin, s.issued_by
        ), active as (
          update users set last_active_at = now()
          where id in (
            select u.id from users u join seen on seen.user_id = u.id
            where seen.issued_by is null
              and u.last_active_at < now() - ${ACTIVE_EVERY}::interval
            for no key update of u skip locked)
        )
        select user_id, claimed, is_admin, issued_by from seen`,
  )
  const row = rows[0]
  return row
    ? {
        userId: row.user_id,
        claimed: row.claimed,
        isAdmin: row.is_admin,
        issuedBy: row.issued_by,
      }
    : null
}

export async function revokeSession(db: Database, token: string) {
  await db.execute(sql`delete from sessions where token_hash = ${hash(token)}`)
}
