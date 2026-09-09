import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { env } from '../env.js'
import { badRequest, notFound } from '../lib/errors.js'
import { contentTypeFor, mediaPath, mediaUrl, storeImage } from '../lib/media.js'

export default async function mediaRoutes(app: FastifyInstance) {
  /**
   * 10b — one photograph, straight from the phone.
   *
   * The client shrinks the picture before it gets here, so what arrives is a
   * few hundred kilobytes rather than the five megabytes the camera made. The
   * ceiling below is for the client that does not.
   */
  app.post('/media', async (request, reply) => {
    const userId = app.requireClaimedUser(request)

    const part = await request.file().catch(() => null)
    if (!part) throw badRequest('no_file', 'Ingen fil kom fram.')

    let bytes: Buffer
    try {
      bytes = await part.toBuffer()
    } catch {
      // The stream is cut off at the limit, so this is the only place the size
      // is known to have been exceeded.
      throw badRequest(
        'file_too_large',
        `Bildet er for stort. Grensen er ${Math.round(env.MEDIA_MAX_BYTES / 1024 / 1024)} MB.`,
      )
    }

    const stored = await storeImage(bytes)
    request.log.info({ userId, bytes: stored.bytes }, 'stored an image')

    reply.code(201)
    // The row will hold the path; the client is given somewhere to fetch it.
    return { path: stored.path, url: mediaUrl(stored.path), bytes: stored.bytes }
  })

  /**
   * The bytes, to anyone who has the name.
   *
   * No session: a photograph has to render on the public page behind a shared
   * link, and in a chat client's preview, neither of which has one. The name is
   * sixteen random bytes, so holding the link is the whole of the permission —
   * the same posture as the invitation it usually arrives with.
   */
  app.get('/media/:name', async (request, reply) => {
    const { name } = z.object({ name: z.string().max(80) }).parse(request.params)

    const path = mediaPath(name)
    const type = contentTypeFor(name)
    if (!path || !type) throw notFound('Fant ikke bildet.')

    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) throw notFound('Fant ikke bildet.')

    return reply
      .type(type)
      .header('content-length', info.size)
      // The name is random and the bytes never change under it, so a cache may
      // keep it for as long as it likes.
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      // Uploaded bytes served from our own origin: even though nothing but
      // JPEG, PNG and WebP gets stored, this says plainly that the file may not
      // reach for anything.
      .header('content-security-policy', "default-src 'none'; sandbox")
      .header('content-disposition', 'inline')
      .send(createReadStream(path))
  })
}
