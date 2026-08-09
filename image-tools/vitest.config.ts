import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The engine's and tools' pure parts (format registry, sniffing, BMP/ICO
// encoders, crop math, flood fill, layouts) run in plain Node — no Svelte
// plugin or DOM needed here.
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
