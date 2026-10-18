import { defineConfig } from "@playwright/test";
import authConfig from "./playwright.auth.config";

export default defineConfig({
  ...authConfig,
  testMatch: [
    "library-ux.spec.ts",
    "editor-responsive.spec.ts",
    "regressions.spec.ts",
  ],
  timeout: 60_000,
  use: { ...authConfig.use, navigationTimeout: 30_000 },
});
