import { z } from 'zod'

// The project keeps one .env at its root, and every entry point needs it: the
// server, the migration runner and the tests alike. Node reads it natively, so
// this costs no dependency. Missing is fine — the schema below reports what for.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // No .env; fall back to whatever is already exported.
}

// Parsed once, at boot, so a missing variable is a startup error with a name in
// it rather than an undefined threaded three calls deep.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
  // A container has nobody to run `pnpm db:migrate` for it, so the image
  // applies the migrations it carries. More than one replica would race here.
  MIGRATE_ON_BOOT: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),
  // Comma-separated. Empty means reflect any origin, which is what a developer
  // wants and a deployment does not.
  CORS_ORIGINS: z.string().default(''),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
  throw new Error(`Bad environment:\n${issues.join('\n')}`)
}

export const env = parsed.data
