// The suite truncates tables. It runs against a database whose name says so,
// and nothing else — on a machine where a deployment and a developer share one
// Postgres, «the host is local» is not a safety property.
import { env } from '../src/env.js'

if (!env.DATABASE_URL) {
  throw new Error(
    'No database. Copy .env.example to .env, run `pnpm db:up`, then `pnpm db:test:setup`.',
  )
}

const { hostname, pathname } = new URL(env.DATABASE_URL)
const name = pathname.slice(1)

if (!name.includes('test')) {
  throw new Error(
    `Refusing to run the suite against "${name}": it truncates every table it can reach, ` +
      'and this database is not named as a test one. Set TEST_DATABASE_URL, or run ' +
      '`pnpm db:test:setup`.',
  )
}

if (!['localhost', '127.0.0.1', 'db'].includes(hostname)) {
  throw new Error(`Refusing to run the suite against ${hostname}: it is not a local host.`)
}
