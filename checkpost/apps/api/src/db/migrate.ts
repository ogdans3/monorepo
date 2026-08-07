import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createDb } from './index.js';
import { loadEnv } from '../env.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Applies everything in apps/api/drizzle. Safe to run repeatedly. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, close } = createDb(databaseUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: resolve(here, '../../drizzle') });
  } finally {
    await close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  await runMigrations(env.DATABASE_URL);
  console.log('migrations applied');
}
