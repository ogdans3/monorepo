import { readFileSync } from 'node:fs'

import { defineConfig } from 'vitest/config'

// The suite runs against a real database, so it needs the project's .env rather
// than whatever happens to be exported. Vite only exposes VITE_-prefixed keys,
// which is not what a server test wants.
try {
  for (const line of readFileSync('../.env', 'utf8').split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!
  }
} catch {
  // No .env is fine; the guard below explains what is missing.
}

export default defineConfig({
  test: {
    setupFiles: ['./test/guard.ts'],
  },
})
