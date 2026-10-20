import { defineConfig } from "@playwright/test";
import authConfig from "./playwright.auth.config";

// The guide pages (/mockups, /use-cases, /alternatives). Point
// PLAYWRIGHT_BASE_URL at `npm start` to test the production server.
export default defineConfig({
  ...authConfig,
  testMatch: ["guides.spec.ts"],
  timeout: 120_000,
});
