import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import {
  createTestAccount,
  deleteTestAccount,
  ownedTestAccount,
  resetAccount,
  ring,
} from '../admin/accounts.js'
import { SCENARIO_STATES, buildScenario } from '../admin/scenarios.js'
import { issueSession } from '../auth/sessions.js'
import { env } from '../env.js'
import { CATEGORIES } from '../lib/constants.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { iso, many, one, type Row } from '../lib/rows.js'
import {
  declineTrade,
  markHandover,
  participantOf,
  requestWithdrawal,
} from '../trades/actions.js'
import { expireWithdrawals } from '../trades/actions.js'
import { validateOffer } from '../trades/offer.js'
import { sweepForCycles } from '../trades/sweep.js'
import { acceptOffer, proposeCounterOffer } from '../trades/trades.js'
import { expressWish } from '../trades/wish.js'
import { publicItem } from './serialize.js'

const idParam = z.object({ id: z.string().uuid() })

/**
 * The test tooling.
 *
 * Every route here is `requireAdmin`, which answers **404** for an ordinary
 * account — whether this deployment has an admin section is not something the
 * API volunteers — and refuses a session the switcher minted, so acting as
 * somebody never carries the key along.
 *
 * Every route that touches an account goes through `ownedTestAccount`: yourself
 * or an account you made, and nothing else. That is the whole safety model, and
 * it holds because `test_account_of` can only be set when a row is born (the
 * trigger in drizzle/0004_admin.sql), so the set cannot grow sideways.
 */
export default async function adminRoutes(app: FastifyInstance) {
  /** Everything the tool screen draws, in one call. */
  app.get('/admin/overview', async (request) => {
    const adminId = app.requireAdmin(request)
    const me = await one(app.db, sql`select * from users where id = ${adminId}`)

    const recent = await many(
      app.db,
      sql`select method, path, created_at, acting_as from admin_actions
          where admin_id = ${adminId} order by created_at desc limit 20`,
    )

    return {
      you: { id: me!['id'], displayName: me!['display_name'], email: me!['email'] },
      accounts: (await ring(app.db, adminId)).map((r) => ({
        id: r['id'],
        displayName: r['display_name'],
        email: r['email'],
        town: r['town'],
        claimed: Boolean(r['claimed']),
        bankid: Boolean(r['bankid']),
        itemCount: Number(r['item_count']),
        likeCount: Number(r['like_count']),
        openTrades: Number(r['open_trades']),
      })),
      // What the bundle was built against and what the server thinks it is —
      // the two facts that explain most «why is nothing happening».
      diagnostics: {
        nodeEnv: env.NODE_ENV,
        inviteOnly: env.INVITE_ONLY,
        webOrigin: env.WEB_ORIGIN,
        mediaOrigin: env.MEDIA_ORIGIN,
        yourId: adminId,
      },
      recent: recent.map((r) => ({
        method: r['method'],
        path: r['path'],
        actingAs: r['acting_as'],
        at: iso(r['created_at']),
      })),
    }
  })

  /** Lag testkonto — born claimed, born furnished, immediately switchable. */
  app.post('/admin/accounts', async (request, reply) => {
    const adminId = app.requireAdmin(request)
    const body = z
      .object({
        displayName: z.string().trim().max(60).optional(),
        town: z.string().trim().max(60).optional(),
        withItems: z.number().int().min(0).max(5).optional(),
        bankid: z.boolean().optional(),
        claimed: z.boolean().optional(),
        interests: z.array(z.enum(CATEGORIES)).min(3).max(5).optional(),
      })
      .parse(request.body ?? {})

    const user = await createTestAccount(app.db, adminId, body)
    reply.code(201)
    return { id: user['id'], displayName: user['display_name'], email: user['email'] }
  })

  /**
   * The switch.
   *
   * An ordinary session for the target, with `issued_by` on the row: every
   * other route behaves identically, and there is nothing for a future route to
   * remember. The provenance is what `GET /me` draws the floor from.
   */
  app.post('/admin/accounts/:id/session', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    const target = await ownedTestAccount(app.db, adminId, id)

    const token = await issueSession(app.db, id, {
      issuedBy: id === adminId ? undefined : adminId,
    })
    request.log.info({ adminId, actingAs: id }, 'admin switched account')
    return { token, displayName: target['display_name'], id }
  })

  /** Nullstill — empty part of an account so the screen in front of it returns. */
  app.post('/admin/accounts/:id/reset', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    const { parts } = z
      .object({
        parts: z
          .array(z.enum(['likes', 'items', 'trades', 'interests', 'bankid', 'notifications']))
          .min(1),
      })
      .parse(request.body)
    await ownedTestAccount(app.db, adminId, id)

    const result = await resetAccount(app.db, id, parts)
    // Listings back on the market are the second matching trigger.
    await sweepForCycles(app.db, result.freed)
    return result
  })

  app.delete('/admin/accounts/:id', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    return deleteTestAccount(app.db, adminId, id)
  })

  /** Bygg et bytte — a trade in a named state, built through the product's own buttons. */
  app.post('/admin/scenarios', async (request) => {
    const adminId = app.requireAdmin(request)
    const body = z
      .object({
        shape: z.enum(['two-way', 'three-way']).default('two-way'),
        state: z.enum(SCENARIO_STATES),
        with: z.array(z.string().uuid()).max(3).optional(),
      })
      .parse(request.body)

    const me = await one(app.db, sql`select * from users where id = ${adminId}`)
    const chosen: Row[] = []
    for (const id of body.with ?? []) chosen.push(await ownedTestAccount(app.db, adminId, id))

    // You are always in it, and first: the point is that it lands on your own
    // screens. The rest comes off the ring, in the order it was made.
    const mine = (await ring(app.db, adminId)).filter(
      (r) => !chosen.some((c) => c['id'] === r['id']) && r['id'] !== adminId && r['claimed'],
    )
    const people = [me!, ...chosen.filter((c) => c['id'] !== adminId), ...mine]

    const built = await buildScenario(app.db, people, {
      shape: body.shape,
      state: body.state,
      with: body.with,
    })
    return built
  })

  /**
   * Som motparten — the other side's move, without leaving the trade screen.
   *
   * Even with a switcher, walking a negotiation is switch, act, switch back,
   * look. Every action goes through the same function the product's own route
   * calls, so none of the refusals are bypassed.
   */
  app.post('/admin/trades/:id/act', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    const body = z
      .object({
        as: z.string().uuid(),
        action: z.enum(['accept', 'counter', 'decline', 'message', 'mark-sent', 'mark-received', 'request-withdrawal']),
      })
      .parse(request.body)

    await ownedTestAccount(app.db, adminId, body.as)
    // Whose trade it is comes before who is sitting in it: «En Fremmed er med i
    // dette byttet» is the answer a person needs, and «du er ikke med» is not.
    await refuseRealPeople(app, adminId, id)
    await participantOf(app.db, id, body.as)

    const offer = await one(
      app.db,
      sql`select * from trade_offers where trade_id = ${id} order by seq desc limit 1`,
    )

    switch (body.action) {
      case 'accept': {
        if (!offer) throw conflict('no_offer', 'Det finnes ikke noe forslag å godta.')
        await acceptOffer(app.db, offer['id'], body.as, '2026-09-06')
        break
      }
      case 'counter': {
        if (!offer) throw conflict('no_offer', 'Det finnes ikke noe forslag å endre.')
        const items = await many(
          app.db,
          sql`select item_id, giver_position from trade_offer_items where offer_id = ${offer['id']}`,
        )
        const composition = items.map((i) => ({
          itemId: i['item_id'] as string,
          giverPosition: Number(i['giver_position']),
        }))
        const seat = await participantOf(app.db, id, body.as)
        const other = await one(
          app.db,
          sql`select position from trade_participants
              where trade_id = ${id} and user_id <> ${body.as} order by position limit 1`,
        )
        const cash = {
          payerPosition: Number(other!['position']),
          payeePosition: Number(seat['position']),
          amountNok: 200,
        }
        await validateOffer(app.db, id, composition, cash)
        await proposeCounterOffer(app.db, id, body.as, composition, cash)
        break
      }
      case 'decline':
        await declineTrade(app.db, id, body.as)
        break
      case 'message': {
        const thread = await one(app.db, sql`select id from threads where trade_id = ${id}`)
        if (!thread) throw notFound('Fant ikke samtalen.')
        await app.db.execute(
          sql`insert into messages (thread_id, sender_id, body)
              values (${thread['id']}, ${body.as}, 'Hei! Dette er en testmelding.')`,
        )
        break
      }
      case 'mark-sent':
        await markHandover(app.db, id, body.as, 'sent')
        break
      case 'mark-received':
        await markHandover(app.db, id, body.as, 'received')
        break
      case 'request-withdrawal':
        await requestWithdrawal(app.db, id, body.as)
        break
    }

    await app.db.execute(sql`
      insert into notifications (user_id, type, payload)
      select p.user_id, 'trade_partly_accepted', jsonb_build_object('tradeId', ${id}::text)
      from trade_participants p where p.trade_id = ${id} and p.user_id <> ${body.as}
        and ${body.action === 'accept'}
    `)
    return { ok: true }
  })

  /** «Få noen til å ville ha denne» — one directed edge, through the real heart. */
  app.post('/admin/items/:id/want', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    const { as } = z.object({ as: z.string().uuid() }).parse(request.body)
    await ownedTestAccount(app.db, adminId, as)

    const wish = await expressWish(app.db, as, id)
    return wish
  })

  /**
   * Forfall fristen nå.
   *
   * `WITHDRAWAL_RESPONSE_HOURS` is 72, so the expired branch of 08b — nobody
   * answered and the trade carries on — is otherwise three days away. Scoped to
   * one trade: moving `now()` would move every other deadline in the process,
   * including a real stranger's.
   */
  app.post('/admin/trades/:id/expire-withdrawal', async (request) => {
    const adminId = app.requireAdmin(request)
    const { id } = idParam.parse(request.params)
    await refuseRealPeople(app, adminId, id)

    const open = await one(
      app.db,
      sql`update trade_withdrawals set responds_by = now() - interval '1 minute'
          where trade_id = ${id} and state = 'waiting' returning id`,
    )
    if (!open) throw badRequest('no_withdrawal', 'Ingen forespørsel venter på svar her.')

    const expired = await expireWithdrawals(app.db)
    return { expired }
  })

  /** Kjør sweepen nå — the second matching trigger, without waiting an hour. */
  app.post('/admin/jobs/sweep-cycles/run', async (request) => {
    app.requireAdmin(request)
    const opened = await sweepForCycles(app.db)
    return { opened: opened.length, tradeIds: opened }
  })

  /**
   * Tilstand — the read-only inspector.
   *
   * What the product screens deliberately hide: each listing's status and the
   * trade holding it, each trade's state, the current offer's sequence, and who
   * accepted which version. It exists so that «something looks wrong» stops
   * being a reason to open psql against the production box.
   */
  app.get('/admin/state', async (request) => {
    const adminId = app.requireAdmin(request)
    const ids = [adminId, ...(await ring(app.db, adminId)).map((r) => r['id'] as string)]
    const list = sql.raw(`array['${ids.join("','")}']::uuid[]`)

    const items = await many(
      app.db,
      sql`select i.*, u.display_name as owner_name, t.state as trade_state
          from items i join users u on u.id = i.owner_id
          left join trades t on t.id = i.active_trade_id
          where i.owner_id = any(${list}) and i.deleted_at is null
          order by u.display_name, i.created_at`,
    )

    const trades = await many(
      app.db,
      sql`select distinct t.id, t.state, t.close_reason, t.created_at,
                 (select max(seq) from trade_offers o where o.trade_id = t.id) as offer_seq,
                 (select count(*) from trade_participants p2 where p2.trade_id = t.id) as parties
          from trades t
          join trade_participants p on p.trade_id = t.id
          where p.user_id = any(${list})
          order by t.created_at desc limit 40`,
    )

    const detailed = []
    for (const trade of trades) {
      const parties = await many(
        app.db,
        sql`select p.position, u.display_name, p.sent_at, p.received_at, p.paid_at,
                   exists (select 1 from trade_acceptances a
                           join trade_offers o on o.id = a.offer_id
                           where o.trade_id = t.id and a.user_id = p.user_id
                             and a.revoked_at is null
                             and o.seq = (select max(seq) from trade_offers where trade_id = t.id))
                     as accepted_current
            from trade_participants p
            join users u on u.id = p.user_id
            join trades t on t.id = p.trade_id
            where p.trade_id = ${trade['id']} order by p.position`,
      )
      detailed.push({
        id: trade['id'],
        state: trade['state'],
        kind: Number(trade['parties']) > 2 ? 'chain' : 'direct',
        offerSeq: trade['offer_seq'] === null ? null : Number(trade['offer_seq']),
        closeReason: trade['close_reason'],
        participants: parties.map((p) => ({
          position: Number(p['position']),
          displayName: p['display_name'],
          acceptedCurrentOffer: Boolean(p['accepted_current']),
          sent: Boolean(p['sent_at']),
          received: Boolean(p['received_at']),
          paid: Boolean(p['paid_at']),
        })),
      })
    }

    return {
      items: items.map((i) => ({
        ...publicItem(i),
        ownerName: i['owner_name'],
        activeTradeId: i['active_trade_id'],
        activeTradeState: i['trade_state'],
      })),
      trades: detailed,
    }
  })
}

/**
 * Refuse, by name and in words, any trade a real person is standing in.
 *
 * The tool may move a negotiation forward without asking, and the one thing
 * that must never be moved without asking is somebody else's.
 */
async function refuseRealPeople(app: FastifyInstance, adminId: string, tradeId: string) {
  const stranger = await one(
    app.db,
    sql`select u.display_name from trade_participants p
        join users u on u.id = p.user_id
        where p.trade_id = ${tradeId}
          and u.id <> ${adminId}
          and u.test_account_of is distinct from ${adminId}
        limit 1`,
  )
  if (stranger) {
    throw conflict(
      'real_person',
      `${stranger['display_name'] ?? 'En ekte bruker'} er med i dette byttet. Testverktøyet rører ikke andres bytter.`,
    )
  }
}
