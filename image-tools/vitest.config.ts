import { defineConfig } from 'vitest/config';

// The engine's pure parts (format registry, sniffing, BMP/ICO encoders) run in
// plain Node — no Svelte plugin or DOM needed here.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
