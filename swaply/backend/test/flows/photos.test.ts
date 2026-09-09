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
