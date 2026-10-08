import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? base.use?.baseURL,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : base.webServer,
  testMatch: ["mobile-motion-playback.spec.ts", "preview-delivery.spec.ts"],
  projects: [
    {
      name: "android-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: base.projects?.[0].use?.launchOptions,
      },
    },
    {
      name: "iphone-webkit",
      use: {
        ...devices["iPhone 13"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,
        },
      },
    },
  ],
});
