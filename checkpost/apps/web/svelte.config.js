import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// This file runs before Vite loads any .env, so it reads the one at the project
// root itself. Without this the Content Security Policy would be built from a
// different API origin than the client actually calls, and the browser would
// block every request with no obvious cause.
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));
} catch {
  // No .env is fine. The fallback below covers local development.
}

/**
 * The browser now talks to the API directly, so the connect policy has to name
 * it. Everything else stays shut: no third-party script, no analytics, no font
 * CDN. Baked at build time from PUBLIC_API_ORIGIN, because a Content Security
 * Policy that has to guess is not a policy.
 */
const apiOrigin = process.env.PUBLIC_API_ORIGIN || 'http://localhost:4000';
const apiHost = new URL(apiOrigin).host;
const secure = new URL(apiOrigin).protocol === 'https:';
const connectSrc = [
  'self',
  `${secure ? 'https' : 'http'}://${apiHost}`,
  // The change feed rides the same host on the matching websocket scheme.
  `${secure ? 'wss' : 'ws'}://${apiHost}`,
];

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' }),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'font-src': ['self'],
        'img-src': ['self', 'data:'],
        'connect-src': connectSrc,
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['none'],
      },
    },
  },
};
