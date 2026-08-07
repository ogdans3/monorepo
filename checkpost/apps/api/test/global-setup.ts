import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate.js';

/**
 * Tests run against a real Postgres. The ordering guarantees, the partial
 * unique index and the row-lock serialisation are all database behaviour, and
 * mocking them would only test the mock.
 *
 * Point TEST_DATABASE_URL somewhere else if you keep Postgres on another port.
 * The default matches `docker compose up -d db`.
 */
const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://checkpost:checkpost@localhost:5433/postgres';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://checkpost:checkpost@localhost:5433/checkpost_test';

const TEST_DB_NAME = new URL(TEST_DATABASE_URL).pathname.slice(1);

export default async function setup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.RUN_REAPER = '0';

  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${TEST_DB_NAME}`;
    if (existing.length === 0) {
      await admin.unsafe(`create database "${TEST_DB_NAME}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }

  await runMigrations(TEST_DATABASE_URL);
}
