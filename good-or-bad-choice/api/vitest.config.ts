import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Scrypt is deliberately slow, and every account in here pays for it twice.
    testTimeout: 20_000,
    // One database, and the suite truncates it between cases.
    fileParallelism: false,
  },
});
