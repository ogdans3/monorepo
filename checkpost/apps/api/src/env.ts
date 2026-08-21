import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  PUBLIC_WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: csv,
  LIST_TTL_DAYS: z.coerce.number().int().positive().default(365),
  EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
  /** Set to '0' to disable the background reaper (tests, one-off scripts). */
  RUN_REAPER: z
    .string()
    .default('1')
    .transform((v) => v !== '0' && v.toLowerCase() !== 'false'),

  /**
   * Apply pending migrations at boot. Right for a single-instance deployment.
   * Turn it off and run `pnpm db:migrate` as a release step once there is more
   * than one API container.
   */
  MIGRATE_ON_BOOT: z
    .string()
    .default('1')
    .transform((v) => v !== '0' && v.toLowerCase() !== 'false'),

  /**
   * The operator console at /v1/admin exists only when both are set. There is
   * deliberately no fallback password: an admin surface that appears by default
   * is a way to hand somebody your database.
   */
  ADMIN_USER: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),

  /**
   * The read cache in front of Postgres (apps/api/src/services/list-cache.ts).
   *
   * It is in-process and invalidated by the writes that happen in this process,
   * which is what lets its lifetime be long. Turn it off for a deployment
   * running more than one API container, where one instance cannot see the
   * other's writes and the only bound on staleness would be the TTL.
   */
  CACHE_ENABLED: z
    .string()
    .default('1')
    .transform((v) => v !== '0' && v.toLowerCase() !== 'false'),
  /** How long an unwritten entry survives. A memory bound, not a correctness one. */
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  /** Ceiling per cache. The least recently used entry goes first. */
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(10_000),
  /**
   * How often a list's `last_active_at` may be rewritten. It only decides
   * whether the reaper eventually deletes an abandoned list, so writing it on
   * every read was a write per read for no extra information.
   */
  TOUCH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(600),

  /** Requests per IP per minute across the whole API. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /** New lists per IP per hour. The one endpoint that grows the database. */
  RATE_LIMIT_CREATE_MAX: z.coerce.number().int().positive().default(30),
  /** Link replacements per IP per hour. */
  RATE_LIMIT_ROTATE_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // The overwhelmingly common cause is a fresh clone with no .env, so say so
    // rather than making someone go and read the schema.
    throw new Error(
      `Invalid environment:\n${detail}\n\n` +
        'If this is a fresh checkout, run `cp .env.example .env` from the ' +
        'project root and start again.',
    );
  }
  return parsed.data;
}
