import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // One .env for the whole project, at its root, shared with the API. Vite
  // would otherwise only look inside apps/web.
  envDir: '../..',
  server: { port: 5173 },
});
