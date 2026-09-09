import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Order matters: env.ts points the run at the test database before guard.ts
    // imports the parsed environment.
    setupFiles: ['./test/env.ts', './test/guard.ts'],
    // Every file truncates the database it shares with the others, so they take
    // turns. Isolating them would mean a schema each, which buys nothing here.
    fileParallelism: false,
  },
})
