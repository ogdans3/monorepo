import { buildApp } from './app.js'
import { connect } from './db/index.js'
import { env } from './env.js'
import { startJobs } from './jobs.js'

const { db } = connect()
const app = await buildApp(db)

startJobs(db, app.log)

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
