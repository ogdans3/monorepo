import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // One .env for the whole project, at its root, shared with the API. Vite
  // would otherwise only look inside apps/web.
  envDir: '../..',
  // $env/static/public reads from the loaded env at build time. Without a value
  // here the build fails rather than silently shipping a wrong origin, which is
  // the behaviour we want.
  server: { port: 5173 },
});
