// Creates the test database and brings it up to date. The suite truncates every
// table it can reach, so it gets one of its own rather than borrowing whatever
// DATABASE_URL happens to point at — which on this host also serves a
// deployment.
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import '../load-env.js'

const url = process.env['TEST_DATABASE_URL']
if (!url) throw new Error('TEST_DATABASE_URL is not set. See .env.example.')

const parsed = new URL(url)
const name = parsed.pathname.slice(1)
if (!name.includes('test')) {
  throw new Error(`Refusing to treat "${name}" as a test database: the name has to say so.`)
}

// Connect to the server's default database to issue CREATE DATABASE, which
// cannot run inside the database it creates.
const adminUrl = new URL(url)
adminUrl.pathname = '/postgres'
const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })

const [existing] = await admin`select 1 from pg_database where datname = ${name}`
if (!existing) {
  await admin.unsafe(`create database "${name}"`)
  console.log(`created ${name}`)
}
await admin.end()

const client = postgres(url, { max: 1, onnotice: () => {} })
await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
await client.end()

console.log(`${name} is up to date`)
