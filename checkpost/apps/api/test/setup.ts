import { assertDisposableDatabase } from './guard.js';

process.env.NODE_ENV = 'test';
process.env.RUN_REAPER = '0';

/**
 * Forced, not defaulted.
 *
 * The tests truncate every table between cases. The real DATABASE_URL now
 * points at a hosted database with real lists in it, and a `??=` here would
 * quietly let an exported shell variable, a loaded .env or a stray CI setting
 * aim that truncate at production. This assignment cannot be overridden, and
 * the guard below refuses to run against anything that is not local anyway.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://checkpost:checkpost@localhost:5433/checkpost_test';

assertDisposableDatabase(process.env.DATABASE_URL);

process.env.PUBLIC_WEB_ORIGIN ??= 'https://checkpost.test';
process.env.CORS_ORIGINS ??= '';

// Rate limits are production behaviour, not test behaviour: one suite makes
// hundreds of calls from one "IP". The limiter itself is covered explicitly in
// rate-limit.test.ts, which sets its own low ceiling.
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.RATE_LIMIT_CREATE_MAX ??= '100000';
process.env.RATE_LIMIT_ROTATE_MAX ??= '100000';
