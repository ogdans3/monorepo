import Fastify, { type FastifyInstance } from 'fastify'

import { env } from './env.js'

// Building the app separately from listening on a port is what lets the tests
// drive it with `app.inject` and no socket.
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty' } }
        : env.NODE_ENV !== 'test',
  })

  app.get('/health', async () => ({ ok: true }))

  return app
}
