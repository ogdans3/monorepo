import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { buildApp } from './app.js'
import { connect } from './db/index.js'
import { env } from './env.js'
import { startJobs } from './jobs.js'

const { db } = connect()
const app = await buildApp(db)

if (env.MIGRATE_ON_BOOT) {
  await migrate(db, { migrationsFolder: 'drizzle' })
  app.log.info('migrations applied')
}

startJobs(db, app.log)

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
