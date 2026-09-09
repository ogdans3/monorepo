import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { resolveSession } from '../auth/sessions.js'
import type { Database } from '../db/index.js'
import { ApiError, unauthorized } from '../lib/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null
    /** False for a device-scoped account that has not been claimed on 10c. */
    userClaimed: boolean
  }
  interface FastifyInstance {
    db: Database
    /** Whether an account can be made without an invitation. See `env.ts`. */
    inviteOnly: boolean
    /** Throws 401 rather than returning null, so a route cannot forget to check. */
    requireUser(request: FastifyRequest): string
    /**
     * The same, but for the things an anonymous user may not do: list, write to
     * someone, accept. Looking and wishing are open to a device; anything that
     * puts you in front of another person needs a name they can hold you to.
     */
    requireClaimedUser(request: FastifyRequest): string
  }
}

// Tokens travel in the Authorization header and nowhere else. A token in a
// query string ends up in access logs, browser history and referrer headers.
export default fp(async function auth(
  app: FastifyInstance,
  opts: { db: Database; inviteOnly: boolean },
) {
  app.decorate('db', opts.db)
  app.decorate('inviteOnly', opts.inviteOnly)
  app.decorateRequest('userId', null)
  app.decorateRequest('userClaimed', false)

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) return
    const session = await resolveSession(opts.db, header.slice('Bearer '.length))
    request.userId = session?.userId ?? null
    request.userClaimed = session?.claimed ?? false
  })

  app.decorate('requireUser', (request: FastifyRequest) => {
    if (!request.userId) throw unauthorized()
    return request.userId
  })

  app.decorate('requireClaimedUser', (request: FastifyRequest) => {
    if (!request.userId) throw unauthorized()
    if (!request.userClaimed) {
      throw new ApiError(
        403,
        'account_required',
        'Lag en profil for å gjøre dette. Du beholder det du har likt.',
      )
    }
    return request.userId
  })
})
