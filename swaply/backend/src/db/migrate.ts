import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { connect } from './index.js'

const { client, db } = connect()

await migrate(db, { migrationsFolder: 'drizzle' })
await client.end()

console.log('migrations applied')
