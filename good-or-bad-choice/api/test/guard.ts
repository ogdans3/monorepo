/**
 * The test suite truncates every table. This refuses to let it point at
 * anything that is not obviously disposable.
 *
 * Both halves matter. "Local" alone would happily wipe a production database
 * reached through an SSH tunnel on localhost, which is exactly how the real one
 * is reached for a backup.
 */
export function assertDisposableDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Refusing to run tests against an unparseable DATABASE_URL: ${url}`);
  }

  const local = ['localhost', '127.0.0.1', '::1', 'db'].includes(parsed.hostname);
  const name = parsed.pathname.replace(/^\//, '');
  const disposable = /test/i.test(name);

  if (!local || !disposable) {
    throw new Error(
      `Refusing to run tests against ${parsed.hostname}/${name}. ` +
        'The suite truncates every table, so it only runs against a local database whose name says "test".',
    );
  }
}
