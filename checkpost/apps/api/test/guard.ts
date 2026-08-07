const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres']);

/**
 * Refuses to let the test suite point at a database it is not allowed to
 * destroy.
 *
 * The suite truncates every table between cases, and the project's real
 * DATABASE_URL is a hosted database with people's lists in it. One exported
 * shell variable is all that stands between a normal `pnpm test` and wiping
 * production, so it is not left to convention.
 *
 * The name must also look disposable. A local database called `checkpost` is
 * still somebody's development data.
 */
export function assertDisposableDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Refusing to run tests: DATABASE_URL is not a URL.\n  got: ${redact(url)}`);
  }

  const name = parsed.pathname.replace(/^\//, '');

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      'Refusing to run tests against a remote database.\n' +
        `  host: ${parsed.hostname}\n` +
        '  The suite truncates every table between cases. Point TEST_DATABASE_URL at a\n' +
        '  local Postgres (`pnpm db:up` starts one on 5433) and try again.',
    );
  }

  if (!/test/i.test(name)) {
    throw new Error(
      'Refusing to run tests against a database whose name does not say "test".\n' +
        `  database: ${name}\n` +
        '  The suite truncates every table between cases, so it only runs somewhere\n' +
        '  obviously disposable.',
    );
  }
}

/** Never let a password reach a log line, even in a crash. */
function redact(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//[redacted]@');
}
