import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, {
    max: options.max ?? 10,
    // Timestamps come back as Date. Everything crossing the wire is serialised
    // to ISO strings in one place (src/serialize.ts) so clients see one format.
    transform: undefined,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
export * from './schema.js';
