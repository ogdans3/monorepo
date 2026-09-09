import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The project keeps one .env, at its root, and every entry point reads it —
  // the API, the migrations, the seed, the tests. Vite would look in web/
  // instead, so the file is loaded here and put where SvelteKit's
  // `$env/dynamic/*` looks: process.env. Anything already exported wins, which
  // is how a deployment overrides a development default.
  for (const [key, value] of Object.entries(loadEnv(mode, '..', ''))) {
    process.env[key] ??= value
  }

  return { plugins: [sveltekit()] }
})
