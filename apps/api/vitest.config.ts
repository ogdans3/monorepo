import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Every suite shares one Postgres. Running them in one process keeps the
    // truncate-between-tests contract honest.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
