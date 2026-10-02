import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// In development the Go server is the API and Vite is the app: the same
// origin either way, so cookies and the event stream behave as deployed.
const api = process.env.PODIUM_API ?? 'http://127.0.0.1:8080';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5180,
		proxy: { '/api': api, '/media': api }
	},
	test: { include: ['src/**/*.test.ts'] }
});
