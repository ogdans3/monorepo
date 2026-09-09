import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://swaply:swaply@localhost:5434/swaply',
  },
  // The search column is generated and the trigram index needs an extension, so
  // the first migration carries a hand-written prelude. Keep it.
  casing: 'snake_case',
})
