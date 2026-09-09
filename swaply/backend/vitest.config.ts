import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/guard.ts'],
    // Every file truncates the database it shares with the others, so they take
    // turns. Isolating them would mean a schema each, which buys nothing here.
    fileParallelism: false,
  },
})
