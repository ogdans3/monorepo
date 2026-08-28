import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Everything worth testing here is pure: the document and its operations, the
// geometry that decides where an arrow meets a shape, the tidy-up layout and
// the Mermaid reader and writer. No DOM, no Svelte plugin.
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
