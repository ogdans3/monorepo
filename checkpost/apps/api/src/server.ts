import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { startReaper } from './reaper.js';
import { VERSION } from './version.js';

/**
 * Pick up the repo-root `.env` so `cp .env.example .env && pnpm dev` actually
 * works. Real environment variables win over the file, which is what Node's
 * loader does by default, so Docker and CI are unaffected by a stray `.env`.
 *
 * Only the entrypoint does this. Tests build the app directly and set their own
 * environment, and a test suite that silently inherited a developer's `.env`
 * would be a menace.
 */
function loadDotEnv(): void {
  // src/server.ts and dist/server.js sit at the same depth, so one path covers
  // both running from source and running the build.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  try {
    process.loadEnvFile(resolve(root, '.env'));
  } catch {
    // No .env is a perfectly normal way to run this. If something required is
    // missing, loadEnv says so by name a moment from now.
  }
}

loadDotEnv();
const env = loadEnv();
if (env.MIGRATE_ON_BOOT) await runMigrations(env.DATABASE_URL);
const { app, close } = await buildApp(env);

const stopReaper = env.RUN_REAPER
  ? startReaper(app.listService, app.log, {
      listTtlDays: env.LIST_TTL_DAYS,
      eventRetentionDays: env.EVENT_RETENTION_DAYS,
    })
  : () => {};

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  stopReaper();
  try {
    await close();
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, 'unclean shutdown');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info({ version: VERSION, env: env.NODE_ENV }, 'checkpost api listening');
} catch (error) {
  app.log.error({ error }, 'failed to start');
  process.exit(1);
}
