import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { resolveSession } from '../auth/sessions.js'
import type { Database } from '../db/index.js'
import { unauthorized } from '../lib/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null
  }
  interface FastifyInstance {
    db: Database
    /** Throws 401 rather than returning null, so a route cannot forget to check. */
    requireUser(request: FastifyRequest): string
  }
}

// Tokens travel in the Authorization header and nowhere else. A token in a
// query string ends up in access logs, browser history and referrer headers.
export default fp(async function auth(app: FastifyInstance, opts: { db: Database }) {
  app.decorate('db', opts.db)
  app.decorateRequest('userId', null)

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) return
    request.userId = await resolveSession(opts.db, header.slice('Bearer '.length))
  })

  app.decorate('requireUser', (request: FastifyRequest) => {
    if (!request.userId) throw unauthorized()
    return request.userId
  })
})
