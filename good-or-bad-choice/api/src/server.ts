import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { runMigrations } from './migrate.js';

const here = dirname(fileURLToPath(import.meta.url));

const env = loadEnv({
  // The built client sits beside the compiled server in the image. Overridable
  // so a development run can point at a `flutter build web` output elsewhere.
  PUBLIC_DIR: join(here, '..', 'public'),
  ...process.env,
});

if (env.MIGRATE_ON_BOOT) {
  const applied = await runMigrations(env.DATABASE_URL);
  if (applied > 0) console.log(`applied ${applied} migration(s)`);
}

const { app, close } = await buildApp(env);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info({ port: env.PORT, env: env.NODE_ENV }, 'good or bad choice is up');
