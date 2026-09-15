import postgres from 'postgres';
import { runMigrations } from '../src/migrate.js';
import { assertDisposableDatabase } from './guard.js';

/**
 * Tests run against a real Postgres. The unique index on `lower(username)`, the
 * `on conflict do nothing` upsert and the cascade from a deleted account are all
 * database behaviour, and mocking them would only test the mock.
 */
const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://gobc:gobc@localhost:5435/postgres';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://gobc:gobc@localhost:5435/gobc_test';

const NAME = new URL(TEST_DATABASE_URL).pathname.slice(1);

export default async function setup(): Promise<void> {
  assertDisposableDatabase(TEST_DATABASE_URL);

  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${NAME}`;
    if (existing.length === 0) await admin.unsafe(`create database "${NAME}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  await runMigrations(TEST_DATABASE_URL);
}
