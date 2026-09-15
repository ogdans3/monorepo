import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

/**
 * Applies every `.sql` file in `migrations/`, in filename order, once.
 *
 * Deliberately not a migration framework. There is one schema file and there
 * will not be many more, and a framework here would be more code than the thing
 * it manages. Each file is applied inside a transaction and recorded, so
 * running this twice is a no-op.
 */
export async function runMigrations(databaseUrl: string): Promise<number> {
  const here = dirname(fileURLToPath(import.meta.url));
  // Resolves from dist/ in the image and from src/ under tsx. Both sit one
  // level below the project root, where migrations/ lives.
  const dir = join(here, '..', 'migrations');

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
    const applied = new Set(
      (await sql<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name),
    );

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = await readFile(join(dir, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      count += 1;
    }
    return count;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Run directly: `npm run migrate`.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }
  const applied = await runMigrations(url);
  console.log(applied === 0 ? 'nothing to apply' : `applied ${applied} migration(s)`);
}
