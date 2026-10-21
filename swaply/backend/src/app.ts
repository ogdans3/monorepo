import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { ZodError } from 'zod'

import { SignInBackoff, type SignInBackoffOptions } from './auth/backoff.js'
import type { Database } from './db/index.js'
import { env } from './env.js'
import { ApiError, notFound, uniqueViolation } from './lib/errors.js'
import { speakNorwegian } from './lib/validation.js'
import authPlugin from './plugins/auth.js'
import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chat.js'
import discoveryRoutes from './routes/discovery.js'
import inviteRoutes from './routes/invites.js'
import itemRoutes from './routes/items.js'
import mediaRoutes from './routes/media.js'
import likeRoutes from './routes/likes.js'
import miscRoutes from './routes/misc.js'
import postcodeRoutes from './routes/postcodes.js'
import profileRoutes from './routes/profile.js'
import tradeRoutes from './routes/trades.js'

// Building the app separately from listening on a port is what lets the tests
// drive it with `app.inject` and no socket.
export async function buildApp(
  db: Database,
  // The tests run both sides of the invite wall, and the environment is parsed
  // once at import, so this is an argument rather than a variable read. The
  // wait after wrong passwords is one too, so that a test can turn its clock.
  opts: { inviteOnly?: boolean; signIns?: Partial<SignInBackoffOptions> } = {},
): Promise<FastifyInstance> {
  // Before any schema is built, so that nothing the API refuses is refused in
  // English. See lib/validation.ts.
  speakNorwegian()

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
    // `idempotency-key` is what «Legg ut» sends so that pressing it again
    // after a lost answer does not list the thing twice (`POST /items`). Left
    // out, a browser refuses the listing before it is sent.
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key'],
  })
  // One file per request, cut off at the ceiling rather than read into memory
  // and rejected afterwards.
  await app.register(multipart, {
    limits: { files: 1, fileSize: env.MEDIA_MAX_BYTES },
  })
  await app.register(authPlugin, { db, inviteOnly: opts.inviteOnly ?? env.INVITE_ONLY })

  // A POST with nothing to say still says `application/json` in some clients,
  // and Fastify refuses an empty body under that content type before any route
  // sees it. Every action without a payload — the heart, sharing, declining,
  // signing out — goes through here, so an empty body is read as an empty
  // object and the route's own validation gets to answer.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body: string, done) => {
      if (body === '') return done(null, {})
      try {
        done(null, JSON.parse(body))
      } catch (err) {
        // A body that is not JSON is the caller's to fix, as Fastify's own
        // parser said before this one replaced it. Without a status the
        // handler below took the SyntaxError for our failure, a 500.
        done(Object.assign(err as Error, { statusCode: 400 }), undefined)
      }
    },
  )

  // A text with U+0000 in it — in the body, the query string or the path —
  // is one Postgres will not keep (`text` has no NUL), and every statement
  // that met one failed as «Noe gikk galt hos oss»: a message, a title, a
  // name, a search. Refused here, before any route has done anything, so a
  // report with «Blokkér» ticked is not left as a block with no report, and
  // in words, because it is the sender's to fix.
  app.addHook('preValidation', async (request) => {
    if (holdsNul(request.body) || holdsNul(request.query) || holdsNul(request.params)) {
      throw new ApiError(
        400,
        'invalid_text',
        'Teksten inneholder et tegn vi ikke kan lagre. Fjern det og prøv igjen.',
      )
    }
  })

  /**
   * The unique indexes a person can walk into by typing, and what to say when
   * they do. Norwegian, because it is shown to them.
   */
  const uniqueMessages: Record<string, { code: string; message: string }> = {
    // On lower(email), so «Ola@epost.no» walks into «ola@epost.no» here too.
    // The name is the old constraint's; see the index in db/schema.ts.
    users_email_unique: {
      code: 'email_taken',
      message: 'Det finnes allerede en konto med denne e-posten.',
    },
    users_phone_unique: {
      code: 'phone_taken',
      message: 'Det finnes allerede en konto med dette telefonnummeret.',
    },
  }

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
    // Fastify's own refusals — a malformed body, a request too large — are the
    // caller's fault and carry their own status. Answering 500 blames us for it
    // and tells the client nothing it can act on.
    const status = (error as { statusCode?: number }).statusCode
    if (typeof status === 'number' && status >= 400 && status < 500) {
      request.log.warn({ err: error }, 'refused a request')
      return reply.code(status).send({
        code: 'invalid_request',
        message: 'Forespørselen var ikke gyldig.',
      })
    }

    // A unique index is a rule the product has, so breaking one is the
    // caller's answer to fix, not our failure. Anything not named here is
    // still a 500 — a surprise collision is a bug, and should read like one.
    const violated = uniqueViolation(error)
    if (violated && violated in uniqueMessages) {
      const { code, message } = uniqueMessages[violated]!
      request.log.warn({ err: error, constraint: violated }, 'unique violation')
      return reply.code(409).send({ code, message })
    }

    request.log.error(error)
    return reply.code(500).send({ code: 'server_error', message: 'Noe gikk galt hos oss.' })
  })

  // A route nobody wrote. Fastify's own answer is English — «Route GET:/x
  // not found» — and the app shows a refusal's message as it comes. Said the
  // way every other «not found» is, which is also what the admin section
  // answers somebody it is not for.
  app.setNotFoundHandler((_request, reply) => {
    const missing = notFound()
    return reply.code(404).send({ code: missing.code, message: missing.message })
  })

  app.get('/health', async () => ({ ok: true }))

  // One per app: a test's wrong passwords are its own.
  await app.register(authRoutes, { signIns: new SignInBackoff(opts.signIns) })
  await app.register(profileRoutes)
  await app.register(itemRoutes)
  await app.register(inviteRoutes)
  await app.register(mediaRoutes)
  await app.register(discoveryRoutes)
  await app.register(likeRoutes)
  await app.register(tradeRoutes)
  await app.register(chatRoutes)
  await app.register(miscRoutes)
  await app.register(postcodeRoutes)
  // Last, and behind `requireAdmin`, which answers 404 for everybody else.
  await app.register(adminRoutes)

  return app
}

/**
 * Whether a parsed body, query or set of path parameters holds U+0000
 * anywhere, in a value or a key. Bodies are small — Fastify stops reading at
 * a megabyte — and the walk stops at the first one found.
 */
export function holdsNul(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000')
  if (value === null || typeof value !== 'object' || depth > 32) return false
  if (Array.isArray(value)) return value.some((v) => holdsNul(v, depth + 1))
  return Object.entries(value).some(
    ([key, v]) => key.includes('\u0000') || holdsNul(v, depth + 1),
  )
}
