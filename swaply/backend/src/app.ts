import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { ZodError } from 'zod'

import type { Database } from './db/index.js'
import { env } from './env.js'
import { ApiError } from './lib/errors.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import discoveryRoutes from './routes/discovery.js'
import inviteRoutes from './routes/invites.js'
import itemRoutes from './routes/items.js'
import mediaRoutes from './routes/media.js'
import likeRoutes from './routes/likes.js'
import miscRoutes from './routes/misc.js'
import profileRoutes from './routes/profile.js'
import tradeRoutes from './routes/trades.js'

// Building the app separately from listening on a port is what lets the tests
// drive it with `app.inject` and no socket.
export async function buildApp(
  db: Database,
  // The tests run both sides of the invite wall, and the environment is parsed
  // once at import, so this is an argument rather than a variable read.
  opts: { inviteOnly?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty' } }
        : env.NODE_ENV !== 'test',
  })

  const allowed = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  await app.register(cors, {
    origin: allowed.length > 0 ? allowed : true,
    // The default list is GET, HEAD and POST. Everything that edits a profile,
    // sets interests, retires a listing or takes back a like is one of the
    // others, and a browser refuses them without this.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
  })
  // One file per request, cut off at the ceiling rather than read into memory
  // and rejected afterwards.
  await app.register(multipart, {
    limits: { files: 1, fileSize: env.MEDIA_MAX_BYTES },
  })
  await app.register(authPlugin, { db, inviteOnly: opts.inviteOnly ?? env.INVITE_ONLY })

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
  await app.register(inviteRoutes)
  await app.register(mediaRoutes)
  await app.register(discoveryRoutes)
  await app.register(likeRoutes)
  await app.register(tradeRoutes)
  await app.register(chatRoutes)
  await app.register(miscRoutes)

  return app
}
