// The suite truncates tables. Refuse to do that to anything that is not an
// obviously local development database.
import { env } from '../src/env.js'

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env, then run `pnpm db:up`.')
}

const { hostname, pathname } = new URL(env.DATABASE_URL)
const name = pathname.slice(1)
const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'db'

if (!local && !name.includes('test')) {
  throw new Error(
    `Refusing to run the suite against ${hostname}/${name}: it truncates tables, and this is ` +
      'neither a local host nor a database whose name says test.',
  )
}
