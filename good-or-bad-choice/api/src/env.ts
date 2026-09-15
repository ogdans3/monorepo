import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4003),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  /**
   * Apply pending migrations at boot. On inside the container, because the
   * image carries the SQL that matches it and nobody is going to run one by
   * hand against a container that is replaced on every deploy.
   */
  MIGRATE_ON_BOOT: z
    .string()
    .default('0')
    .transform((value) => value === '1' || value.toLowerCase() === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Where the built browser client is. Absent in tests, which serve nothing. */
  PUBLIC_DIR: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment:\n${problems}\n\n` +
      'If this is a fresh checkout, run `cp .env.example .env` from the project root and start again.',
  );
}
