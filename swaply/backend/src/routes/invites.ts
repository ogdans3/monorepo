import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { createInvite, findInvite, inviteUrl } from '../lib/invites.js'
import { notFound } from '../lib/errors.js'
import { many, one } from '../lib/rows.js'
import { inviteText, shareText } from '../lib/text.js'
import { sharedItem } from './serialize.js'

// base64url, sixteen bytes. Checked here so a typo comes back as a 400 with a
// sentence in it rather than a 404 that looks like the invitation is gone.
const tokenParam = z.object({ token: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/) })

export default async function inviteRoutes(app: FastifyInstance) {
  /**
   * 16b — the invitation you hand to someone directly. No listing on it, so the
   * page it opens is the plain «you have been invited» one.
   */
  app.post('/invites', async (request, reply) => {
    const userId = app.requireClaimedUser(request)
    const me = await one(app.db, sql`select display_name from users where id = ${userId}`)
    const { token, url } = await createInvite(app.db, { inviterId: userId })

    reply.code(201)
    return { token, url, text: `${inviteText(me?.['display_name'] ?? null)} ${url}` }
  })

  /**
   * 04 — the share button. It is an invitation as much as a link: the app is
   * invite-only, so a listing sent to someone without it would otherwise be a
   * wall, and the share button would be worth nothing.
   *
   * Anyone who can see the listing can share it. You are not vouching for the
   * item, you are vouching for the person you send it to.
   */
  app.post('/items/:id/share', async (request, reply) => {
    const userId = app.requireClaimedUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(
      app.db,
      sql`select id, title, estimated_value_nok from items
          where id = ${id} and deleted_at is null`,
    )
    if (!item) throw notFound('Fant ikke gjenstanden.')

    const { token, url } = await createInvite(app.db, { inviterId: userId, itemId: id })

    reply.code(201)
    return {
      token,
      url,
      text: `${shareText(item['title'], item['estimated_value_nok'] === null ? null : Number(item['estimated_value_nok']))} ${url}`,
    }
  })

  /**
   * What the web page behind a link renders, and the one endpoint here that
   * takes no session: the whole point is that it is read by someone who does not
   * have an account yet.
   *
   * Reading does not spend the invitation. Looking is not joining, so a link
   * that has been used still shows its listing — it just says so.
   */
  app.get('/invites/:token', async (request) => {
    const { token } = tokenParam.parse(request.params)

    const invite = await findInvite(app.db, token)
    if (!invite) throw notFound('Vi kjenner ikke igjen denne invitasjonen.')

    // An anonymised inviter is nobody, not «Slettet bruker». There is no person
    // left to name, and naming a tombstone on a public page would be worse than
    // saying nothing.
    const inviter = invite['inviter_id']
      ? await one(
          app.db,
          sql`select display_name, town from users
              where id = ${invite['inviter_id']} and anonymised_at is null`,
        )
      : null

    const item = invite['item_id']
      ? await one(
          app.db,
          sql`select i.*, u.display_name as owner_name
              from items i join users u on u.id = i.owner_id
              where i.id = ${invite['item_id']} and i.deleted_at is null`,
        )
      : null

    const media = item
      ? await many(
          app.db,
          sql`select url from item_media where item_id = ${item['id']} order by position`,
        )
      : []

    return {
      token,
      url: inviteUrl(token),
      used: Boolean(invite['used_at']),
      inviter: inviter?.['display_name']
        ? { displayName: inviter['display_name'], town: inviter['town'] }
        : null,
      // A listing can be retired after the link went out. The page still works;
      // it just has nothing to show, which is the truth and not an error.
      item: item ? sharedItem({ ...item, media: media.map((m) => m['url']) }) : null,
      shareText: item
        ? shareText(
            item['title'],
            item['estimated_value_nok'] === null ? null : Number(item['estimated_value_nok']),
          )
        : inviteText(inviter?.['display_name'] ?? null),
    }
  })
}
