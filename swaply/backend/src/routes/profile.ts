import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { deleteTestAccount } from '../admin/accounts.js'
import { verifyPassword } from '../auth/passwords.js'
import { blockedBetween } from '../lib/blocks.js'
import { CATEGORIES } from '../lib/constants.js'
import { hiddenCountColumn, hiddenCountOf } from '../lib/hidden.js'
import { ApiError, badRequest, conflict, notFound } from '../lib/errors.js'
import { townOf } from '../lib/postcodes.js'
import { coverSql, many, one } from '../lib/rows.js'
import { emailAddress } from '../lib/validation.js'
import { anonymiseUser } from '../trades/erasure.js'
import { sweepForCycles } from '../trades/sweep.js'
import { publicItem, publicMe, publicUser } from './serialize.js'

export default async function profileRoutes(app: FastifyInstance) {
  // Screen 13, and 17c when it is empty.
  app.get('/me', async (request) => {
    const userId = app.requireUser(request)
    const user = await one(app.db, sql`select *, ${hiddenCountColumn} from users where id = ${userId}`)
    const items = await many(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover from items i
          where i.owner_id = ${userId} and i.deleted_at is null
          order by i.created_at desc`,
    )
    const likedBy = await one(
      app.db,
      sql`select count(*) as n from likes l join items i on i.id = l.target_item
          where i.owner_id = ${userId}`,
    )
    const unread = await one(
      app.db,
      sql`select count(*) as n from messages m
          join thread_participants tp on tp.thread_id = m.thread_id and tp.user_id = ${userId}
          where m.sender_id <> ${userId}
            and (tp.last_read_message_id is null
                 or m.created_at > (select created_at from messages where id = tp.last_read_message_id))`,
    )
    // The badge on Bytter. The same rule as «Din tur» on screen 11, and it has
    // to be the same number: a trade you have not answered, on an offer that
    // has something from everybody. See `tradeList` in trades/view.ts.
    const yourTurn = await one(
      app.db,
      sql`select count(*) as n from trades t
          join trade_participants p on p.trade_id = t.id and p.user_id = ${userId}
          where t.state in ('pending', 'countered')
            and not exists (
              select 1 from trade_acceptances a
              join trade_offers o on o.id = a.offer_id
              where o.trade_id = t.id and a.user_id = ${userId} and a.revoked_at is null
                and o.seq = (select max(seq) from trade_offers where trade_id = t.id))
            and not exists (
              select 1 from trade_participants empty
              where empty.trade_id = t.id
                and not exists (
                  select 1 from trade_offer_items oi
                  join trade_offers o on o.id = oi.offer_id
                  where o.trade_id = t.id
                    and o.seq = (select max(seq) from trade_offers where trade_id = t.id)
                    and oi.giver_position = empty.position))`,
    )

    // Who minted this session, when the account switcher did. A fact about the
    // session and not about the row, which is why it is assembled here and not
    // in `publicMe`: a fresh sign-in is never an impersonation.
    const actingAs = request.sessionIssuedBy
      ? await one(
          app.db,
          sql`select id, display_name from users where id = ${request.sessionIssuedBy}`,
        )
      : null

    return {
      ...publicMe(user!),
      actingAs: actingAs
        ? { adminId: actingAs['id'], adminName: actingAs['display_name'] }
        : null,
      items: items.map(publicItem),
      likedByCount: Number(likedBy!['n']),
      unreadMessages: Number(unread!['n']),
      tradesNeedingYou: Number(yourTurn!['n']),
    }
  })

  /**
   * «Ikke vis meg slike», from the long-press menu on a discovery card.
   *
   * Hides every listing of the same kind — the category and the subcategory
   * under it — from this account's Oppdag, its rows and its search. A listing
   * with no subcategory says no more than its category, and hiding a whole
   * category for one card would hide far more than was asked, so only that
   * listing goes. An item page opened directly still opens: this is about what
   * is put in front of you, not about what you may look at.
   *
   * Open to a device that has not made a profile, because it is about looking.
   */
  app.post('/me/hidden', async (request) => {
    const userId = app.requireUser(request)
    const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.body)

    const item = await one(
      app.db,
      sql`select id, owner_id, category, subcategory from items
          where id = ${itemId} and deleted_at is null`,
    )
    // Across a block the listing does not exist for you, here as on its page.
    if (!item || (await blockedBetween(app.db, userId, item['owner_id']))) {
      throw notFound('Fant ikke gjenstanden.')
    }

    const kind = item['subcategory'] ? (item['subcategory'] as string) : null
    // `on conflict do nothing`: pressed twice, or on a second card of a kind
    // already hidden, is hidden once. Either partial index may be the one.
    await app.db.execute(
      sql`insert into hidden_listings (user_id, category, subcategory, item_id)
          values (${userId}, ${item['category']}::category, ${kind},
                  ${kind ? null : item['id']})
          on conflict do nothing`,
    )

    // With the count after it, which is what says whether «Angre» — showing
    // everything again — would bring back this and nothing more. The phone's
    // own copy of the count can be from before a sign-in or a claim.
    const counted = await one(app.db, sql`select ${hiddenCountOf(sql`${userId}::uuid`)} as n`)
    return {
      hidden: { category: item['category'], subcategory: kind, itemId: kind ? null : item['id'] },
      hiddenCount: Number(counted!['n']),
    }
  })

  // Show me everything again. All of it at once: nobody remembers which card
  // it was, and a list of hidden kinds is a screen round 5 did not draw.
  app.delete('/me/hidden', async (request, reply) => {
    const userId = app.requireUser(request)
    await app.db.execute(sql`delete from hidden_listings where user_id = ${userId}`)
    reply.code(204)
  })

  app.patch('/me', async (request) => {
    const userId = app.requireUser(request)
    const body = z
      .object({
        displayName: z.string().trim().min(1).max(60).optional(),
        email: emailAddress.optional(),
        phone: z.string().min(6).max(20).nullish(),
        town: z.string().max(60).optional(),
        postalCode: z.string().regex(/^\d{4}$/, 'Et postnummer har fire sifre.').optional(),
      })
      .parse(request.body)

    // A name, an address and a number are what 10c asks for, and only 10c may
    // set them on a device that has not made a profile. An e-mail is what makes
    // an account count as claimed: written here it claimed the device with no
    // password, so the person could list and write but never sign in again, and
    // could never be merged into an account they have elsewhere. And both e-mail
    // and phone are unique, so a device could hold somebody else's address or
    // number and turn them away when they register. Where you are is about
    // looking, and stays open.
    if (
      body.displayName !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined
    ) {
      app.requireClaimedUser(request)
    }

    // Only the town a postcode belongs to is shown to anybody, so a postcode
    // decides it, over a town sent alongside; one that belongs to no town is
    // refused in words rather than kept as a place nobody can find.
    const town = townOf(body.postalCode) ?? body.town ?? null

    const user = await one(
      app.db,
      sql`update users set
            display_name = coalesce(${body.displayName ?? null}, display_name),
            email = coalesce(${body.email ?? null}, email),
            phone = ${body.phone === undefined ? sql`phone` : (body.phone ?? null)},
            town = coalesce(${town}, town),
            postal_code = coalesce(${body.postalCode ?? null}, postal_code)
          where id = ${userId} returning *, ${hiddenCountColumn}`,
    )
    return publicMe(user!)
  })

  /**
   * «Slett kontoen» — the right to erasure, from the person's own hands.
   *
   * Through the engine in trades/erasure.ts and nothing else, so what happens
   * is what `docs/DESIGN.md` says under *Erasure and retention*: the trades
   * still going on end first with a reason to the other side, the profile is
   * emptied, a sealed record keeps what a claim would need, and the account
   * becomes a tombstone in other people's histories. Every session it had dies
   * with it, and its e-mail and phone are free to make a new account with.
   *
   * An account with a password is deleted with the password, because a phone
   * left unlocked on a table is not the person. A device that never made a
   * profile has no password to give, and its token is all it ever had.
   */
  app.delete('/me', async (request, reply) => {
    const userId = app.requireUser(request)
    const body = z.object({ password: z.string().nullish() }).parse(request.body ?? {})

    const user = await one(
      app.db,
      sql`select email, password_hash, test_account_of from users where id = ${userId}`,
    )
    if (!user) throw notFound('Fant ikke kontoen.')

    // The key to the test tooling is cut outside the building and taken away
    // there too (`pnpm admin revoke`). Erased with it still on, it would leave
    // a tombstone holding the key and a ring of test accounts nobody can reach.
    if (request.userIsAdmin) {
      throw conflict(
        'admin_account',
        'Denne kontoen har nøkkelen til testverktøyet. Nøkkelen må tas fra den før kontoen kan slettes.',
      )
    }

    // A session the switcher minted has the admin's key behind it rather than
    // the account's password, the way every other move made as somebody does.
    if (!request.sessionIssuedBy && user['email']) {
      const ok =
        body.password && user['password_hash']
          ? await verifyPassword(body.password, user['password_hash'])
          : false
      // 403, not 401: the session is fine, and a client that signs out on 401
      // would throw the person out for a typo.
      if (!ok) throw new ApiError(403, 'wrong_password', 'Feil passord.')
    }

    // A test account is retired by the tool that made it, which refuses to
    // end a trade a real person is standing in — the one thing the tool must
    // never do, and «Slett kontoen» pressed while acting as somebody is still
    // the tool.
    const ring = request.sessionIssuedBy ?? (user['test_account_of'] as string | null)
    const { freed } = ring
      ? await deleteTestAccount(app.db, ring, userId)
      : await anonymiseUser(app.db, userId, { reason: 'user_request' })

    // The other side's things that the ended trades were holding are back on
    // the market: the second of the three search triggers. After the erasure
    // has committed, so a search that fails costs a trade the hourly sweep
    // opens anyway, and never a «Noe gikk galt» over an account that is
    // already gone.
    await sweepForCycles(app.db, freed).catch((err) =>
      request.log.warn({ err, freed }, 'loop search after an erasure failed'),
    )

    reply.code(204)
  })

  // Screen 02. Any number of the twelve, none included, and each once. Round 5
  // said three to five; the product owner took the limit away on 30.09.2026.
  app.put('/me/interests', async (request) => {
    const userId = app.requireUser(request)
    const { interests } = z
      .object({ interests: z.array(z.enum(CATEGORIES)) })
      .parse(request.body)

    if (new Set(interests).size !== interests.length) {
      throw badRequest('duplicate_interests', 'Du kan ikke velge samme kategori to ganger.')
    }

    const user = await one(
      app.db,
      sql`update users set interests = ${sql.raw(`'{${interests.join(',')}}'::category[]`)}
          where id = ${userId} returning *, ${hiddenCountColumn}`,
    )
    return publicMe(user!)
  })

  // Screen 13b: somebody else, with their things, which is the point of it.
  app.get('/users/:id', async (request) => {
    const viewer = request.userId
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const user = await one(
      app.db,
      sql`select u.*,
                 (select count(*) from items i where i.owner_id = u.id and i.deleted_at is null) as item_count,
                 (select count(*) from trade_participants p join trades t on t.id = p.trade_id
                  where p.user_id = u.id and t.state = 'completed') as trade_count
          from users u where u.id = ${id}`,
    )
    if (!user) throw notFound('Fant ikke brukeren.')

    // The profile itself stays readable — you have to be able to find the
    // person in order to unblock them — but their things do not come with it.
    const hidden = await blockedBetween(app.db, viewer ?? null, id)
    const items = hidden
      ? []
      : await many(
          app.db,
          sql`select i.*, ${coverSql('i')} as cover,
                     exists (select 1 from likes l where l.target_item = i.id
                             and l.from_user = ${viewer ?? null}) as liked_by_me
              from items i
              where i.owner_id = ${id} and i.deleted_at is null and i.status <> 'traded'
              order by i.created_at desc`,
        )
    const byYou = viewer
      ? await one(app.db, sql`select 1 from blocks where blocker = ${viewer} and blocked = ${id}`)
      : null

    return {
      ...publicUser(user),
      interests: user['interests'] ?? [],
      items: items.map(publicItem),
      blockedByYou: Boolean(byYou),
    }
  })
}
