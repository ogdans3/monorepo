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

export async function resolveSession(db: Database, token: string): Promise<string | null> {
  const rows = await db.execute<{ user_id: string }>(
    sql`update sessions set last_seen_at = now()
        where token_hash = ${hash(token)}
        returning user_id`,
  )
  return rows[0]?.user_id ?? null
}

export async function revokeSession(db: Database, token: string) {
  await db.execute(sql`delete from sessions where token_hash = ${hash(token)}`)
}
