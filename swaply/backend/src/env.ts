import { z } from 'zod'

// Parsed once, at boot, so a missing variable is a startup error with a name in
// it rather than an undefined threaded three calls deep.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
  throw new Error(`Bad environment:\n${issues.join('\n')}`)
}

export const env = parsed.data
