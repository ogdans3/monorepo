import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '../env.js'
import * as schema from './schema.js'

export function connect() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env, or run pnpm db:up.')
  }

  const client = postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === 'test' ? 1 : 10,
    // Postgres emits a NOTICE per cascaded table on truncate, which buries the
    // output of the seed and the tests in noise the reader cannot act on.
    onnotice: () => {},
  })
  return { client, db: drizzle(client, { schema }) }
}

export type Database = ReturnType<typeof connect>['db']
export { schema }
