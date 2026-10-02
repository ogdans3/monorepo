import { defineConfig } from '@playwright/test';

// The whole loop against a running Podium: `docker compose up -d --build`
// from the project folder, or the Go server and Vite in development. Point
// PODIUM_URL at it, with the admin password in PODIUM_PASSWORD.
export default defineConfig({
	testDir: 'e2e',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: process.env.PODIUM_URL ?? 'http://127.0.0.1:4120',
		trace: 'retain-on-failure'
	}
});
