// The suite truncates tables. Refuse to do that to anything that is not an
// obviously local development database.
const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is not set. Run `pnpm db:up`, then copy .env.example to .env.')
}

const host = new URL(url).hostname
const name = new URL(url).pathname.slice(1)
const local = host === 'localhost' || host === '127.0.0.1' || host === 'db'

if (!local && !name.includes('test')) {
  throw new Error(
    `Refusing to run the suite against ${host}/${name}: it truncates tables, and this is ` +
      'neither a local host nor a database whose name says test.',
  )
}
