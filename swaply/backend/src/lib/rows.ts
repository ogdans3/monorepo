import { sql, type SQL } from 'drizzle-orm'

import type { Database } from '../db/index.js'

export type Row = Record<string, any>

/** One row or nothing, without the `[0]!` dance at every call site. */
export async function one<T extends Row = Row>(db: Database, query: SQL): Promise<T | null> {
  const rows = await db.execute<T>(query)
  return (rows[0] as T | undefined) ?? null
}

export async function many<T extends Row = Row>(db: Database, query: SQL): Promise<T[]> {
  return (await db.execute<T>(query)) as unknown as T[]
}

/** Screens show «Verdi 2 500 kr», so numbers cross the wire as numbers. */
export const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null)

/** The cover is the lowest-positioned photo, and a listing may have none. */
export const coverSql = (alias: string) =>
  sql.raw(`(select url from item_media m where m.item_id = ${alias}.id order by m.position limit 1)`)
