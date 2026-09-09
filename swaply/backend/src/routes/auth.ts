import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { issueSession, revokeSession } from '../auth/sessions.js'
import { badRequest, conflict, unauthorized } from '../lib/errors.js'
import { one } from '../lib/rows.js'
import { publicMe } from './serialize.js'

// Screen 10c asks for name, e-mail, phone and a password in one go, because it
// only appears when you are already trying to list something.
const registerBody = z.object({
  displayName: z.string().min(1).max(60),
  email: z.string().email(),
  phone: z.string().min(6).max(20).optional(),
  password: z.string().min(8, 'Passordet må ha minst 8 tegn.'),
  postalCode: z.string().regex(/^\d{4}$/).optional(),
  town: z.string().optional(),
})

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const body = registerBody.parse(request.body)

    const taken = await one(app.db, sql`select 1 from users where email = ${body.email}`)
    if (taken) throw conflict('email_taken', 'Det finnes allerede en konto med denne e-posten.')

    const user = await one(
      app.db,
      sql`insert into users (display_name, email, phone, password_hash, postal_code, town)
          values (${body.displayName}, ${body.email}, ${body.phone ?? null},
                  ${await hashPassword(body.password)}, ${body.postalCode ?? null},
                  ${body.town ?? null})
          returning *`,
    )

    reply.code(201)
    return { token: await issueSession(app.db, user!['id']), user: publicMe(user!) }
  })

  app.post('/auth/login', async (request) => {
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(request.body)

    const user = await one(app.db, sql`select * from users where email = ${body.email}`)
    // Same answer either way: telling someone the address exists is telling them
    // half of a credential.
    if (!user?.['password_hash'] || !(await verifyPassword(body.password, user['password_hash']))) {
      throw unauthorized()
    }

    return { token: await issueSession(app.db, user['id']), user: publicMe(user) }
  })

  app.post('/auth/logout', async (request, reply) => {
    const header = request.headers.authorization
    if (header?.startsWith('Bearer ')) await revokeSession(app.db, header.slice(7))
    reply.code(204)
  })

  // BankID is confirmed at the first trade, and the app only ever learns yes or
  // no. The provider keeps the person; we keep a pseudonym. Until there is a
  // provider contract this accepts the subject it is handed.
  app.post('/me/bankid', async (request) => {
    const userId = app.requireUser(request)
    const body = z.object({ subject: z.string().min(4) }).parse(request.body)

    const clash = await one(
      app.db,
      sql`select 1 from users where bankid_subject = ${body.subject} and id <> ${userId}`,
    )
    if (clash) throw badRequest('bankid_taken', 'Denne BankID-en er allerede i bruk.')

    const user = await one(
      app.db,
      sql`update users set bankid_subject = ${body.subject}, bankid_verified_at = now()
          where id = ${userId} returning *`,
    )
    return publicMe(user!)
  })
}
