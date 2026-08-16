import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The parts worth testing here are pure: the anatomy registry, the pattern
// matcher and the red-flag rules. No DOM, no Svelte plugin.
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
