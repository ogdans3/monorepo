import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** Returns the raw token. It is never stored, only its hash. */
export async function issueSession(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.execute(
    sql`insert into sessions (token_hash, user_id) values (${hash(token)}, ${userId})`,
  )
  return token
}

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
): Promise<{ userId: string; claimed: boolean } | null> {
  const rows = await db.execute<{ user_id: string; claimed: boolean }>(
    sql`update sessions s set last_seen_at = now()
        from users u
        where s.token_hash = ${hash(token)} and u.id = s.user_id
          and u.anonymised_at is null
        returning s.user_id, (u.email is not null) as claimed`,
  )
  const row = rows[0]
  return row ? { userId: row.user_id, claimed: row.claimed } : null
}

export async function revokeSession(db: Database, token: string) {
  await db.execute(sql`delete from sessions where token_hash = ${hash(token)}`)
}
