import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { startReaper } from './reaper.js';
import { VERSION } from './version.js';

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
