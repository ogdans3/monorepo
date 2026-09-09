// The project keeps one .env at its root, and every entry point needs it: the
// server, the migration runner, the test-database setup and the tests alike.
// Node reads it natively, so this costs no dependency, and it does not override
// anything already exported — which is how the test run points itself at a
// different database.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // No .env; fall back to whatever is already exported.
}
