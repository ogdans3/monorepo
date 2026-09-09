import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'

import type { Database } from './db/index.js'
import { env } from './env.js'
import { ApiError } from './lib/errors.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import discoveryRoutes from './routes/discovery.js'
import itemRoutes from './routes/items.js'
import likeRoutes from './routes/likes.js'
import miscRoutes from './routes/misc.js'
import profileRoutes from './routes/profile.js'
import tradeRoutes from './routes/trades.js'

// Building the app separately from listening on a port is what lets the tests
// drive it with `app.inject` and no socket.
export async function buildApp(db: Database): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty' } }
        : env.NODE_ENV !== 'test',
  })

  await app.register(cors, { origin: true })
  await app.register(authPlugin, { db })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message })
    }
    if (error instanceof ZodError) {
      // The first message is the one worth showing; the rest is for the log.
      const first = error.issues[0]
      return reply.code(400).send({
        code: 'invalid_request',
        message: first?.message ?? 'Noe manglet i forespørselen.',
        field: first?.path.join('.'),
      })
    }
    request.log.error(error)
    return reply.code(500).send({ code: 'server_error', message: 'Noe gikk galt hos oss.' })
  })

  app.get('/health', async () => ({ ok: true }))

  await app.register(authRoutes)
  await app.register(profileRoutes)
  await app.register(itemRoutes)
  await app.register(discoveryRoutes)
  await app.register(likeRoutes)
  await app.register(tradeRoutes)
  await app.register(chatRoutes)
  await app.register(miscRoutes)

  return app
}
