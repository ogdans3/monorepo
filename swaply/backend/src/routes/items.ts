import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import type { Database } from '../db/index.js'
import { blockedBetween } from '../lib/blocks.js'
import { CATEGORIES, CONDITIONS, LISTING_KEY_HOURS, MAX_VALUE_NOK } from '../lib/constants.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { storedExists, toStoredPath } from '../lib/media.js'
import { townFor, townOf } from '../lib/postcodes.js'
import { coverSql, many, one, type Executor, type Row } from '../lib/rows.js'
import { conversationAbout, lastMessageIn } from '../trades/conversation.js'
import { publicItem, publicUser } from './serialize.js'

/**
 * Words a person may leave out. A box they emptied is the same as one they
 * never filled: the app sends `''` for it, and kept as `''` it was a
 * description of nothing, which every reader had to know to hide.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === '' ? null : v))

const itemBody = z.object({
  kind: z.enum(['item', 'service']).default('item'),
  // Trimmed first, everywhere a person types: `min(1)` accepts a space, and
  // the collage would draw a card with nothing written on it.
  title: z.string().trim().min(1).max(80),
  description: optionalText(2000),
  category: z.enum(CATEGORIES),
  subcategory: optionalText(60),
  condition: z.enum(CONDITIONS).nullish(),
  estimatedValueNok: z.number().int().min(0).max(MAX_VALUE_NOK).nullish(),
  // Looked up, never stored: see `townOf` in lib/postcodes.ts.
  postalCode: z.string().regex(/^\d{4}$/, 'Et postnummer har fire sifre.').nullish(),
  town: optionalText(60),
  // Up to ten, first is the cover. A listing with none is allowed: services
  // usually have none, and discovery draws a generated card instead.
  //
  // A photograph is uploaded first and named here by the path `POST /media`
  // gave back, or by the URL a listing was read with. The shape is all this
  // checks; which of them may go on the listing is `assertMedia`'s to say.
  media: z
    .array(
      z
        .string()
        .refine(
          (v) => /^\/media\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(v) || /^https?:\/\//.test(v),
          'Ukjent bilde.',
        ),
    )
    .max(10)
    .default([]),
})

const unknownImage = () => badRequest('image_unknown', 'Ukjent bilde. Legg det til på nytt.')

/**
 * Refuses a photograph that may not go on this listing, before anything is
 * written. `media` are stored paths (see `toStoredPath`), and `kept` the ones
 * the listing already has, which stay whatever is true of them now: a picture
 * that went missing under a live listing is not the reason an edit of it
 * should fail.
 *
 * Anything new has to be ours, still on disk, and on no other owner's listing.
 * An absolute URL is somebody else's server: every phone that opens the
 * listing, and the page behind a shared link, would fetch the picture from
 * there and hand it the visitor's address. The seed's made-up ones are on
 * their listings already, which is the one way such a URL still goes through.
 * An upload nobody listed within a day is swept, and a phone that kept a
 * half-written 10b across that day still holds its path, which would go on
 * the market as a broken picture. And a name is random, but every listing
 * hands its own out to whoever looks at it: copied onto somebody else's
 * listing, erasing that somebody took the photograph with them, from under
 * the person it belongs to.
 */
async function assertMedia(db: Executor, ownerId: string, media: string[], kept: string[] = []) {
  for (const path of media) {
    if (kept.includes(path)) continue
    if (!path.startsWith('/media/')) throw unknownImage()
    if (!(await storedExists(path))) {
      throw badRequest('image_gone', 'Et av bildene er ikke lagret lenger. Legg det til på nytt.')
    }
    const elsewhere = await one(
      db,
      sql`select 1 from item_media m join items i on i.id = m.item_id
          where m.url = ${path} and i.owner_id <> ${ownerId} limit 1`,
    )
    // The same words as a picture that was never ours: whose it is is not
    // this person's to learn.
    if (elsewhere) throw unknownImage()
  }
}

/**
 * The `Idempotency-Key` header, or null when none was sent.
 *
 * A uuid the app makes once per draft. Anything else is refused rather than
 * ignored: ignoring it would quietly take away the one thing that stops a
 * second press from listing the thing twice.
 */
function listingKey(header: string | string[] | undefined): string | null {
  if (header === undefined || header === '') return null
  if (typeof header !== 'string' || !z.string().uuid().safeParse(header).success) {
    throw badRequest(
      'invalid_idempotency_key',
      'Utkastet har en ugyldig nøkkel. Start annonsen på nytt.',
    )
  }
  return header
}

const listingBody = (item: Row, media: string[]) =>
  publicItem({ ...item, cover: media[0] ?? null, media })

/**
 * The listing an earlier press with this key made, answered the way that
 * press was, or null. Only while the key still answers: for
 * `LISTING_KEY_HOURS`, and only while the listing stands — a listing deleted
 * since is not handed back as if it had been made just now.
 */
async function listedWith(db: Database, ownerId: string, key: string) {
  const item = await one(
    db,
    sql`select * from items
        where owner_id = ${ownerId} and idempotency_key = ${key} and deleted_at is null
          and created_at >= now() - ${`${LISTING_KEY_HOURS} hours`}::interval`,
  )
  if (!item) return null
  const media = await many(
    db,
    sql`select url from item_media where item_id = ${item['id']} order by position`,
  )
  return listingBody(item, media.map((m) => m['url']))
}

export default async function itemRoutes(app: FastifyInstance) {
  app.post('/items', async (request, reply) => {
    // 10c stands between looking around and listing something: a thing on the
    // market has to belong to somebody with a name.
    const userId = app.requireClaimedUser(request)
    const key = listingKey(request.headers['idempotency-key'])
    const body = itemBody.parse(request.body)

    // «Legg ut» pressed again after the answer to the first press was lost on
    // the way back. The listing exists, the draft is still on the phone, and
    // without this the second press listed the thing twice. The answer is the
    // first listing as it stands, with 200 rather than 201: nothing new was
    // made. Asked before the checks below, which the first press has passed.
    if (key) {
      const first = await listedWith(app.db, userId, key)
      if (first) return first
    }

    if (body.kind === 'item' && !body.condition) {
      throw badRequest('condition_required', 'Velg tilstand for gjenstanden.')
    }
    const media = body.media.map(toStoredPath)
    await assertMedia(app.db, userId, media)

    // Where the thing is: the postcode typed on 10b, and only then wherever
    // the owner is (a town sent as words wins over both, and no screen sends
    // one). A profile made on 10c has no town, and 10c is where most listings
    // come from, so without the postcode a listing usually had none; and a
    // thing kept at the cabin is at the cabin, whatever the profile says.
    const typed = townOf(body.postalCode)
    const owner = await one(app.db, sql`select town, postal_code from users where id = ${userId}`)
    const town = body.town ?? typed ?? owner?.['town'] ?? townFor(owner?.['postal_code'])

    // One transaction, so a listing is never seen without its photos — and so
    // a second press arriving while the first is still being written waits on
    // the key's index for it, and then finds it.
    const item = await app.db.transaction(async (tx) => {
      if (key) {
        // A key that no longer answers is let go of, so the same draft can
        // list again: older than the window, or on a listing deleted since.
        // The index is per owner and has no clock in it.
        await tx.execute(
          sql`update items set idempotency_key = null
              where owner_id = ${userId} and idempotency_key = ${key}
                and (deleted_at is not null
                     or created_at < now() - ${`${LISTING_KEY_HOURS} hours`}::interval)`,
        )
      }

      const [row] = await tx.execute<Row>(
        sql`insert into items (owner_id, kind, title, description, category, subcategory,
                              condition, estimated_value_nok, town, idempotency_key)
            values (${userId}, ${body.kind}, ${body.title}, ${body.description ?? null},
                    ${body.category}, ${body.subcategory ?? null},
                    ${body.kind === 'service' ? null : body.condition!},
                    ${body.estimatedValueNok ?? null},
                    ${town}, ${key})
            on conflict (owner_id, idempotency_key) where idempotency_key is not null
            do nothing
            returning *`,
      )
      if (!row) return null

      for (const [position, url] of media.entries()) {
        await tx.execute(
          sql`insert into item_media (item_id, url, position)
              values (${row['id']}, ${url}, ${position})`,
        )
      }
      return row
    })

    if (!item) {
      // Both presses at once: the other one wrote the listing while this one
      // waited on the index, and it is the answer to both.
      const first = await listedWith(app.db, userId, key!)
      if (first) return first
      // Deleted, or out of the window, in the moment between the two. Said
      // rather than guessed at: listing it again now would be the duplicate.
      throw conflict('already_listed', 'Denne annonsen er allerede lagt ut.')
    }

    reply.code(201)
    return listingBody(item, media)
  })

  app.get('/items/:id', async (request) => {
    const viewer = request.userId
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(
      app.db,
      sql`select i.*, ${coverSql('i')} as cover,
                 exists (select 1 from likes l
                         where l.target_item = i.id and l.from_user = ${viewer ?? null}) as liked_by_me,
                 (select count(*) from likes l where l.target_item = i.id) as like_count
          from items i where i.id = ${id} and i.deleted_at is null`,
    )
    if (!item) throw notFound('Fant ikke gjenstanden.')
    // Hidden on Oppdag and openable by id is not hidden. 04 is one tap from a
    // notification, a chat row or a link somebody kept.
    if (await blockedBetween(app.db, viewer ?? null, item['owner_id'])) {
      throw notFound('Fant ikke gjenstanden.')
    }

    const media = await many(
      app.db,
      sql`select url from item_media where item_id = ${id} order by position`,
    )
    const owner = await one(
      app.db,
      sql`select u.*, (select count(*) from items i2
                       where i2.owner_id = u.id and i2.deleted_at is null) as item_count,
                 (select count(*) from trade_participants p
                  join trades t on t.id = p.trade_id
                  where p.user_id = u.id and t.state = 'completed') as trade_count
          from users u where u.id = ${item['owner_id']}`,
    )

    // The box on 04 is the conversation about this listing, so it opens on
    // what was last said there, and on «Åpne ›» to the rest. Somebody else's
    // listing only: the owner has one conversation per person who wrote, and
    // they live in Chats.
    const talk =
      viewer && viewer !== item['owner_id']
        ? await conversationAbout(app.db, viewer, item['owner_id'], id)
        : null

    return {
      ...publicItem({ ...item, media: media.map((m) => m['url']) }),
      owner: publicUser(owner!),
      conversation: talk
        ? { ...talk, lastMessage: await lastMessageIn(app.db, talk.threadId, viewer!) }
        : null,
    }
  })

  // «Rediger annonsen». A field in the body is a change and a field left out
  // is left alone; `null` empties what may be empty, and so does `''`, which
  // is what the app sends for a box somebody cleared. Every field used to be
  // `coalesce(new, old)`, so nothing could ever be emptied and `kind` was not
  // written at all.
  app.patch('/items/:id', async (request) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = itemBody.partial().parse(request.body)
    // Before anything is held: a postcode that is no postcode changes nothing.
    const typed = townOf(body.postalCode)
    const media = body.media?.map(toStoredPath)

    // One transaction, so the listing is never seen with its new words and
    // its old photos, or half of either — and with its row held to the end,
    // so an acceptance reserving it in the same moment either lands first and
    // is answered below, or waits for this and reserves what it says.
    const { item, photos } = await app.db.transaction(async (tx) => {
      const [existing] = await tx.execute<Row>(
        sql`select * from items where id = ${id} for no key update`,
      )
      // Taken down is gone, for an edit as for everything else that reads it.
      if (!existing || existing['deleted_at']) throw notFound('Fant ikke gjenstanden.')
      if (existing['owner_id'] !== userId) throw forbidden('Dette er ikke din gjenstand.')
      if (existing['active_trade_id']) {
        throw badRequest('item_reserved', 'Gjenstanden er reservert i et bytte og kan ikke endres.')
      }

      // The rule 10b has: a service has no condition, and an item needs one.
      const kind = body.kind ?? (existing['kind'] as string)
      const condition =
        kind === 'service'
          ? null
          : body.condition !== undefined
            ? body.condition
            : (existing['condition'] as string | null)
      if (kind === 'item' && !condition) {
        throw badRequest('condition_required', 'Velg tilstand for gjenstanden.')
      }
      // A service is never reserved, so one in a trade everybody has agreed
      // to holds nothing. Made an item there, it would be one that the trade
      // gives away and that another trade could reserve as well.
      if (kind !== existing['kind']) {
        const [agreed] = await tx.execute<Row>(
          sql`select 1 from trade_offer_items oi
              join trade_offers o on o.id = oi.offer_id
              join trades t on t.id = o.trade_id
              where oi.item_id = ${id} and t.state in ('accepted', 'paused')
                and o.seq = (select max(seq) from trade_offers where trade_id = t.id)
              limit 1`,
        )
        if (agreed) {
          throw conflict(
            'agreed_trade',
            'Tjenesten er med i et avtalt bytte og kan ikke gjøres om til en gjenstand.',
          )
        }
      }

      if (media) {
        const kept = await many(tx, sql`select url from item_media where item_id = ${id}`)
        await assertMedia(tx, userId, media, kept.map((row) => row['url']))
      }

      const set = [sql`kind = ${kind}`, sql`condition = ${condition}`]
      if (body.title !== undefined) set.push(sql`title = ${body.title}`)
      if (body.description !== undefined) set.push(sql`description = ${body.description}`)
      if (body.category !== undefined) set.push(sql`category = ${body.category}`)
      if (body.subcategory !== undefined) set.push(sql`subcategory = ${body.subcategory}`)
      if (body.estimatedValueNok !== undefined) {
        set.push(sql`estimated_value_nok = ${body.estimatedValueNok}`)
      }
      // Words win, then a postcode, as on 10b. An empty postcode box is not
      // sent and leaves the listing where it is; emptied words with no
      // postcode beside them take the town away.
      const town = body.town ?? typed
      if (town !== null || body.town === null) set.push(sql`town = ${town}`)

      const [updated] = await tx.execute<Row>(
        sql`update items set ${sql.join(set, sql`, `)} where id = ${id} returning *`,
      )

      if (media) {
        await tx.execute(sql`delete from item_media where item_id = ${id}`)
        for (const [position, url] of media.entries()) {
          await tx.execute(
            sql`insert into item_media (item_id, url, position)
                values (${id}, ${url}, ${position})`,
          )
        }
      }

      // Read the photos back rather than echoing the body: a client that has
      // just added one should be told what is stored, which is a path.
      const photos = await many(
        tx,
        sql`select url from item_media where item_id = ${id} order by position`,
      )
      return { item: updated!, photos }
    })

    return publicItem({
      ...item,
      cover: photos[0]?.['url'] ?? null,
      media: photos.map((m) => m['url']),
    })
  })

  // Retired, never removed: a listing that has been in an offer is part of a
  // record somebody else may need.
  app.delete('/items/:id', async (request, reply) => {
    const userId = app.requireUser(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const item = await one(app.db, sql`select owner_id, active_trade_id from items where id = ${id}`)
    if (!item) throw notFound('Fant ikke gjenstanden.')
    if (item['owner_id'] !== userId) throw forbidden('Dette er ikke din gjenstand.')
    if (item['active_trade_id']) {
      throw badRequest('item_reserved', 'Gjenstanden er reservert i et bytte.')
    }

    await app.db.execute(
      sql`update items set deleted_at = now(), status = 'withdrawn' where id = ${id}`,
    )
    reply.code(204)
  })
}
