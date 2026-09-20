import { sql } from 'drizzle-orm'
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
    /** The test tooling's key. Never settable through this API — see 0004. */
    userIsAdmin: boolean
    /**
     * The admin who minted this session through the account switcher, and null
     * for every ordinary sign-in. Server truth for «you are Kari right now».
     */
    sessionIssuedBy: string | null
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
    /**
     * The door to the test tooling. Answers 404 rather than 403 for an ordinary
     * account: whether this deployment has an admin section is not something
     * the API volunteers.
     *
     * A session the switcher minted is never admin, whoever it belongs to —
     * acting as somebody must not carry the key along, or one forgotten switch
     * turns into a tool acting on a tool.
     */
    requireAdmin(request: FastifyRequest): string
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
  app.decorateRequest('userIsAdmin', false)
  app.decorateRequest('sessionIssuedBy', null)

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) return
    const session = await resolveSession(opts.db, header.slice('Bearer '.length))
    request.userId = session?.userId ?? null
    request.userClaimed = session?.claimed ?? false
    request.userIsAdmin = session?.isAdmin ?? false
    request.sessionIssuedBy = session?.issuedBy ?? null
  })

  /**
   * What the tooling did, and on whose behalf.
   *
   * On the hook that runs after routing and before the handler, so a route
   * cannot forget the row: every admin call and every write made while acting
   * as somebody else lands here whether or not the handler remembers it
   * exists. A wrong tap is only survivable if it can be found afterwards.
   */
  app.addHook('preHandler', async (request) => {
    const admin = request.userIsAdmin ? request.userId : request.sessionIssuedBy
    if (!admin) return
    // Changes only. Reading is not a thing anybody needs to find afterwards,
    // and the tool screen loads its own overview every time it opens — logging
    // that would bury the twenty rows it shows under twenty of itself.
    if (request.method === 'GET') return
    // An admin's own ordinary writes are their own: the row is for what the
    // tooling did, and for what was done under somebody else's name.
    if (!request.url.startsWith('/admin') && !request.sessionIssuedBy) return

    await opts.db
      .execute(
        sql`insert into admin_actions (admin_id, acting_as, method, path)
            values (${admin}, ${request.sessionIssuedBy ? request.userId : null},
                    ${request.method}, ${request.url.slice(0, 200)})`,
      )
      // A log that can fail the request it logs is worse than no log.
      .catch((err) => request.log.warn({ err }, 'could not write admin_actions'))
  })

  app.decorate('requireUser', (request: FastifyRequest) => {
    if (!request.userId) throw unauthorized()
    return request.userId
  })

  app.decorate('requireAdmin', (request: FastifyRequest) => {
    if (!request.userId) throw unauthorized()
    if (!request.userIsAdmin || request.sessionIssuedBy) {
      throw new ApiError(404, 'not_found', 'Fant ikke det du ba om.')
    }
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
