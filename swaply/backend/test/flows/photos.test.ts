// FLOW — A photograph, from the phone to the page behind a shared link
//
// The rule this exists to pin down: **a row holds a path, never a URL.** The
// database says where the bytes are and nothing about which hostname is in
// front of them, so moving the API — or the files to the bucket they are
// supposed to live in — is a migration and not a rewrite.
//
// And the one that follows from data protection: a photograph of somebody's
// living room is personal data, so erasing them takes the bytes with it —
// except the one a completed trade snapshotted, which is the counterparty's
// record and lives until the claim window closes.
//
// Which is why a picture goes on its own owner's listings and nobody else's,
// and a new one is always ours: a URL on somebody else's server hands every
// visitor's address to that server, and a copy of Kari's path on Per's
// listing let erasing Per take Kari's photograph.
import { readFile, rm, stat, utimes } from 'node:fs/promises'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { env } from '../../src/env.js'
import { sweepOrphanedMedia } from '../../src/lib/media-sweep.js'
import { anonymiseUser } from '../../src/trades/erasure.js'
import { close, db, reset } from '../helpers.js'

let app: FastifyInstance

type Json = Record<string, any>

// The smallest valid PNG there is: one transparent pixel, header and all, so
// the sniffing in `storeImage` has something real to recognise.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** A multipart body, written by hand: one dependency fewer in the test suite. */
function multipart(field: string, filename: string, type: string, bytes: Buffer) {
  const boundary = '----swaplytest' + Math.random().toString(36).slice(2)
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
      `Content-Type: ${type}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { boundary, payload: Buffer.concat([head, bytes, tail]) }
}

async function upload(token: string, bytes: Buffer, type = 'image/png', name = 'drill.png') {
  const { boundary, payload } = multipart('file', name, type, bytes)
  const res = await app.inject({
    method: 'POST',
    url: '/media',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

describe('a photograph on a listing', () => {
  let ola = '', kari = ''
  let olaId = ''
  let path = ''

  beforeAll(async () => {
    await reset()
    await rm(env.MEDIA_DIR, { recursive: true, force: true })
    app = await buildApp(db)

    const a = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123' },
    })
    ola = a.json()['token']
    olaId = a.json()['user']['id']

    const b = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Kari N.', email: 'kari@epost.no', password: 'fiskestang1' },
    })
    kari = b.json()['token']
  })

  afterAll(async () => {
    await app.close()
    await close()
    await rm(env.MEDIA_DIR, { recursive: true, force: true })
  })

  test('1. an upload comes back as a path and the URL to fetch it from', async () => {
    const res = await upload(ola, PNG)

    expect(res.status).toBe(201)
    path = res.body!['path']
    expect(path).toMatch(/^\/media\/[0-9a-f]{32}\.png$/)
    // The origin is configuration, not something the database ever holds.
    expect(res.body!['url']).toBe(`http://test.local${path}`)
    expect(res.body!['bytes']).toBe(PNG.length)

    // The bytes are on disk, unchanged.
    const onDisk = await readFile(join(env.MEDIA_DIR, path.split('/').pop()!))
    expect(onDisk.equals(PNG)).toBe(true)
  })

  test('2. it is served to anyone with the name, and nobody can guess one', async () => {
    const served = await app.inject({ method: 'GET', url: path })

    expect(served.statusCode).toBe(200)
    expect(served.headers['content-type']).toBe('image/png')
    expect(served.headers['cache-control']).toContain('immutable')
    expect(served.rawPayload.equals(PNG)).toBe(true)

    // No session was needed: the page behind a shared link has none.
    expect((await app.inject({ method: 'GET', url: '/media/nothing.png' })).statusCode).toBe(404)
    // A name that is not one of ours is not a path we go looking down.
    expect(
      (await app.inject({ method: 'GET', url: '/media/..%2F..%2Fetc%2Fpasswd' })).statusCode,
    ).toBe(404)
  })

  test('3. what is not a picture does not become one', async () => {
    // An HTML file wearing an image content-type: the type is what the client
    // said, the bytes are what it sent, and only the bytes are believed.
    const res = await upload(ola, Buffer.from('<html><script>alert(1)</script>'), 'image/png')

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('unsupported_image')
  })

  test('4. looking around is not enough to upload', async () => {
    const anon = await app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { deviceId: 'device-photo-0123456789' },
    })
    const res = await upload(anon.json()['token'], PNG)

    expect(res.status).toBe(403)
    expect(res.body!['code']).toBe('account_required')
  })

  test('5. the listing holds the path, and every client is handed the URL', async () => {
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${ola}` },
      payload: {
        title: 'Bosch drill 18V',
        category: 'verktoy',
        condition: 'good',
        estimatedValueNok: 600,
        media: [path],
      },
    })
    expect(listed.statusCode).toBe(201)
    const itemId = listed.json()['id']

    const stored = await db.execute<{ url: string }>(
      sql`select url from item_media where item_id = ${itemId}`,
    )
    expect(stored[0]!.url).toBe(path)

    const seen = await app.inject({ method: 'GET', url: `/items/${itemId}` })
    expect(seen.json()['media']).toEqual([`http://test.local${path}`])
    expect(seen.json()['cover']).toBe(`http://test.local${path}`)

    // And on the page behind a shared link, which is where it has to be
    // absolute: a chat client building a preview has nothing to resolve against.
    const share = await app.inject({
      method: 'POST',
      url: `/items/${itemId}/share`,
      headers: { authorization: `Bearer ${kari}` },
    })
    const page = await app.inject({ method: 'GET', url: `/invites/${share.json()['token']}` })
    expect(page.json()['item']['media']).toEqual([`http://test.local${path}`])
  })

  test('5b. and a URL handed back to us is stored as the path it came from', async () => {
    // «A photo row holds a path, never a URL» — CLAUDE.md, and it is what makes
    // the move to the OVH bucket a migration rather than a rewrite. A client
    // that reads a listing and writes it back sends what it was given, which is
    // the absolute URL; the row must not learn a hostname from that.
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${ola}` },
      payload: { title: 'Sykkelhjelm', category: 'sykling', condition: 'good' },
    })
    const itemId = listed.json()['id']

    const edited = await app.inject({
      method: 'PATCH',
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${ola}` },
      payload: { media: [`http://test.local${path}`] },
    })
    expect(edited.statusCode).toBe(200)

    const stored = await db.execute<{ url: string }>(
      sql`select url from item_media where item_id = ${itemId}`,
    )
    expect(stored[0]!.url).toBe(path)
    // A picture that genuinely lives somewhere else is still left alone where
    // it already is: the seed's made-up URLs are not ours to rewrite, and an
    // edit that sends one back keeps it.
    await db.execute(
      sql`insert into item_media (item_id, url, position)
          values (${itemId}, 'https://img.example/annet.webp', 1)`,
    )
    const kept = await app.inject({
      method: 'PATCH',
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${ola}` },
      payload: { media: ['https://img.example/annet.webp'] },
    })
    expect(kept.statusCode).toBe(200)
    const other = await db.execute<{ url: string }>(
      sql`select url from item_media where item_id = ${itemId}`,
    )
    expect(other.map((row) => row.url)).toEqual(['https://img.example/annet.webp'])
  })

  test('5c. but no new picture from somebody else\'s server goes on a listing', async () => {
    // Every phone that opens the listing, and the page behind a shared link,
    // would fetch it from that server and hand it the visitor's address.
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${ola}` },
      payload: {
        title: 'Vinterjakke', category: 'klaer', condition: 'good',
        media: ['https://img.example/jakke.webp'],
      },
    })
    expect(listed.statusCode).toBe(400)
    expect(listed.json()).toEqual({
      code: 'image_unknown',
      message: 'Ukjent bilde. Legg det til på nytt.',
    })
    expect(await db.execute(sql`select 1 from items where title = 'Vinterjakke'`)).toHaveLength(0)

    // Nor added beside one the listing already has.
    const [helmet] = await db.execute<{ id: string }>(
      sql`select id from items where title = 'Sykkelhjelm'`,
    )
    const added = await app.inject({
      method: 'PATCH',
      url: `/items/${helmet!.id}`,
      headers: { authorization: `Bearer ${ola}` },
      payload: { media: ['https://img.example/annet.webp', 'https://img.example/ny.webp'] },
    })
    expect(added.statusCode).toBe(400)
    expect(added.json()['code']).toBe('image_unknown')
  })

  test('5d. and a picture on somebody else\'s listing is not yours to put on one', async () => {
    // Ola's drill hands its picture's name to anybody who looks at it. Copied
    // onto Kari's listing, erasing Kari would take Ola's photograph with her.
    for (const media of [[path], [`http://test.local${path}`]]) {
      const listed = await app.inject({
        method: 'POST',
        url: '/items',
        headers: { authorization: `Bearer ${kari}` },
        payload: { title: 'Drill, lånt bilde', category: 'verktoy', condition: 'good', media },
      })
      expect(listed.statusCode, media[0]).toBe(400)
      expect(listed.json()['code']).toBe('image_unknown')
    }
    expect(
      await db.execute(sql`select 1 from items where title = 'Drill, lånt bilde'`),
    ).toHaveLength(0)

    const own = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Drill', category: 'verktoy', condition: 'good' },
    })
    const edited = await app.inject({
      method: 'PATCH',
      url: `/items/${own.json()['id']}`,
      headers: { authorization: `Bearer ${kari}` },
      payload: { media: [path] },
    })
    expect(edited.statusCode).toBe(400)
    expect(edited.json()['code']).toBe('image_unknown')

    // Ola himself may put it on a second listing of his.
    const second = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${ola}` },
      payload: { title: 'Bosch batteri', category: 'verktoy', condition: 'good', media: [path] },
    })
    expect(second.statusCode).toBe(201)
  })

  test('6. the share button sends a content type and no body, and is answered', async () => {
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Kajakk', category: 'bat', condition: 'good' },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/items/${listed.json()['id']}/share`,
      // Exactly what the Flutter client used to send, and what Fastify refused.
      headers: { authorization: `Bearer ${ola}`, 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()['url']).toContain('/i/')
  })

  test('7. erasing the person takes the photograph with them', async () => {
    const file = join(env.MEDIA_DIR, path.split('/').pop()!)
    expect((await stat(file)).isFile()).toBe(true)

    await anonymiseUser(db, olaId)

    await expect(stat(file)).rejects.toThrow()
    expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(404)
  })

  test('7b. but not one that somebody else\'s listing still shows', async () => {
    // Kari's picture, on Kari's listing.
    const hers = (await upload(kari, PNG)).body!['path']
    const file = join(env.MEDIA_DIR, hers.split('/').pop()!)
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Kano', category: 'bat', condition: 'good', media: [hers] },
    })
    expect(listed.statusCode).toBe(201)

    // Per copied its path onto a listing of his before that was refused, so
    // the row is written the way the API once let it be.
    const per = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Per H.', email: 'per@epost.no', password: 'padleaare1' },
    })
    const perId = per.json()['user']['id']
    const copy = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${per.json()['token']}` },
      payload: { title: 'Kano, som ny', category: 'bat', condition: 'good' },
    })
    await db.execute(
      sql`insert into item_media (item_id, url, position) values (${copy.json()['id']}, ${hers}, 0)`,
    )

    await anonymiseUser(db, perId)

    expect((await stat(file)).isFile()).toBe(true)
    const seen = await app.inject({ method: 'GET', url: `/items/${listed.json()['id']}` })
    expect(seen.json()['media']).toEqual([`http://test.local${hers}`])
    expect((await app.inject({ method: 'GET', url: hers })).statusCode).toBe(200)
  })

  test('8. an upload nobody finished listing is swept, once it is old enough', async () => {
    const abandoned = (await upload(kari, PNG)).body!['path']
    const file = join(env.MEDIA_DIR, abandoned.split('/').pop()!)

    // Fresh, so it is left alone: the picture is uploaded before the listing
    // exists, and somebody is probably still filling in the form.
    expect(await sweepOrphanedMedia(db)).toBe(0)
    expect((await stat(file)).isFile()).toBe(true)

    // A day older, and nothing points at it.
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await utimes(file, old, old)

    expect(await sweepOrphanedMedia(db)).toBe(1)
    await expect(stat(file)).rejects.toThrow()
  })

  test('8b. a listing made with a swept picture is refused, and nothing is listed', async () => {
    // A phone keeps a half-written 10b for as long as it likes, with the
    // paths of what it had uploaded. A day later the sweep has had them, and
    // the path still matches the pattern — so the file is looked for.
    const swept = (await upload(kari, PNG)).body!['path']
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await utimes(join(env.MEDIA_DIR, swept.split('/').pop()!), old, old)
    expect(await sweepOrphanedMedia(db)).toBe(1)
    const fresh = (await upload(kari, PNG)).body!['path']
    const before = await db.execute(sql`select 1 from items where title = 'Pulk'`)

    const res = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Pulk', category: 'friluft', condition: 'good', media: [fresh, swept] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      code: 'image_gone',
      message: 'Et av bildene er ikke lagret lenger. Legg det til på nytt.',
    })
    expect(await db.execute(sql`select 1 from items where title = 'Pulk'`)).toHaveLength(
      before.length,
    )
    // With the picture sent again, it goes.
    const again = (await upload(kari, PNG)).body!['path']
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Pulk', category: 'friluft', condition: 'good', media: [fresh, again] },
    })
    expect(listed.statusCode).toBe(201)
  })

  test('8c. an edit is refused a swept picture too, but not one the listing already had', async () => {
    const kept = (await upload(kari, PNG)).body!['path']
    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Snøsko', category: 'friluft', condition: 'good', media: [kept] },
    })
    const itemId = listed.json()['id']
    const gone = (await upload(kari, PNG)).body!['path']
    await rm(join(env.MEDIA_DIR, gone.split('/').pop()!))

    const added = await app.inject({
      method: 'PATCH',
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${kari}` },
      payload: { media: [kept, gone] },
    })
    expect(added.statusCode).toBe(400)
    expect(added.json()['code']).toBe('image_gone')

    // The listing's own picture lost under it is not a reason the owner
    // cannot correct the title.
    await rm(join(env.MEDIA_DIR, kept.split('/').pop()!))
    const corrected = await app.inject({
      method: 'PATCH',
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Truger', media: [`http://test.local${kept}`] },
    })
    expect(corrected.statusCode).toBe(200)
  })

  test('9. except the one a completed trade remembers', async () => {
    const kept = (await upload(kari, PNG)).body!['path']
    const file = join(env.MEDIA_DIR, kept.split('/').pop()!)

    const listed = await app.inject({
      method: 'POST',
      url: '/items',
      headers: { authorization: `Bearer ${kari}` },
      payload: { title: 'Fiskestang', category: 'friluft', condition: 'good', media: [kept] },
    })
    const itemId = listed.json()['id']

    // The snapshot a completed trade writes, standing in for the trade itself:
    // what matters here is that something outside the listing points at the
    // file, and that erasure leaves it alone.
    const [trade] = await db.execute<{ id: string }>(
      sql`insert into trades (state) values ('completed') returning id`,
    )
    await db.execute(sql`
      insert into trade_item_snapshots
        (trade_id, item_id, giver_position, title, kind, category, cover_url)
      values (${trade!.id}, ${itemId}, 0, 'Fiskestang', 'item', 'friluft', ${kept})
    `)

    const kariId = (
      await db.execute<{ id: string }>(sql`select id from users where email = 'kari@epost.no'`)
    )[0]!.id
    await anonymiseUser(db, kariId)

    expect((await stat(file)).isFile()).toBe(true)
    expect((await app.inject({ method: 'GET', url: kept })).statusCode).toBe(200)
  })
})
