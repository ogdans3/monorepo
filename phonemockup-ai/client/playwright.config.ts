import {defineConfig, devices} from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
    testDir: "./tests",
    timeout: 90_000,
    expect: {timeout: 10_000},
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 2,
    reporter: [
        ["list"],
        ["html", {outputFolder: "playwright-report", open: "never"}],
    ],
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                headless: true,
                launchOptions: {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
                    args: [
                        "--headless=new",
                        "--no-sandbox",
                        "--use-gl=angle",
                        "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader",
                        "--ignore-gpu-blocklist",
                        "--enable-webgl",
                    ]
                },
            },
        },
    ],
    webServer: [
        {
            command: `npm run dev -- --port ${port} --strictPort`,
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            // Give Vite/SvelteKit time to boot and compile in CI
            timeout: 120_000,
        },
    ],
});