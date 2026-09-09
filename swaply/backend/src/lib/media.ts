import { randomBytes } from 'node:crypto'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'

import { env } from '../env.js'
import { badRequest } from './errors.js'

/**
 * Item photos, on our own disk.
 *
 * `docs/ARCHITECTURE.md` puts them in OVH Object Storage, and that is still
 * where they belong: a bucket survives the machine, and this does not. Until
 * the bucket exists they live in a Docker volume next to the database, which is
 * the same box, the same jurisdiction and the same backup problem — and it is
 * the difference between a product with photographs and one without.
 *
 * What moving to OVH will need: this file, a bucket name, and a migration that
 * rewrites the stored paths. Nothing else knows where the bytes are, because
 * every row holds a path and not a URL.
 */

/**
 * The three formats a phone produces. Sniffed from the bytes rather than taken
 * from the upload's content-type, which is whatever the client felt like
 * saying. No SVG: it is a document with scripts in it, not a picture.
 */
const SIGNATURES: { ext: string; type: string; match: (b: Buffer) => boolean }[] = [
  {
    ext: 'jpg',
    type: 'image/jpeg',
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'png',
    type: 'image/png',
    match: (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  },
  {
    ext: 'webp',
    type: 'image/webp',
    match: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
]

/** The content type a stored file is served with, by its own extension. */
export const contentTypeFor = (name: string): string | null =>
  SIGNATURES.find((s) => name.endsWith(`.${s.ext}`))?.type ?? null

/**
 * A stored name is random, never the one the client sent: an upload called
 * `../../etc/passwd` is a filename, and a name a stranger can guess is an
 * enumerable catalogue of other people's things.
 */
const STORED = /^[0-9a-f]{32}\.(jpg|png|webp)$/

/** Resolve a stored name to a path, or null if it is not one of ours. */
export function mediaPath(name: string): string | null {
  if (!STORED.test(name)) return null
  const path = normalize(join(env.MEDIA_DIR, name))
  return path.startsWith(normalize(env.MEDIA_DIR)) ? path : null
}

/**
 * Write an uploaded image and return the path to store on the row.
 *
 * The path is relative — `/media/<name>` — so the database says where the file
 * is and never which hostname is in front of it. Moving the API to another
 * origin then costs nothing, and a dump of the development database does not
 * carry production URLs around.
 */
export async function storeImage(bytes: Buffer): Promise<{ path: string; bytes: number }> {
  if (bytes.length === 0) throw badRequest('empty_file', 'Filen var tom.')
  if (bytes.length > env.MEDIA_MAX_BYTES) {
    throw badRequest(
      'file_too_large',
      `Bildet er for stort. Grensen er ${Math.round(env.MEDIA_MAX_BYTES / 1024 / 1024)} MB.`,
    )
  }

  const signature = SIGNATURES.find((s) => s.match(bytes))
  if (!signature) {
    throw badRequest('unsupported_image', 'Vi tar imot JPEG, PNG og WebP.')
  }

  const name = `${randomBytes(16).toString('hex')}.${signature.ext}`
  await mkdir(env.MEDIA_DIR, { recursive: true })
  await writeFile(join(env.MEDIA_DIR, name), bytes)

  return { path: `/media/${name}`, bytes: bytes.length }
}

/**
 * Remove the bytes behind a stored path. Quiet when the file is already gone:
 * the row is the record, and a missing file is not a reason to fail whatever
 * was deleting it.
 */
export async function removeStored(path: string): Promise<void> {
  const name = path.startsWith('/media/') ? path.slice('/media/'.length) : ''
  const file = mediaPath(name)
  if (!file) return
  await unlink(file).catch(() => {})
}

/**
 * What a client is given. A row holds `/media/<name>`; a client needs somewhere
 * to fetch it from, and only the deployment knows what that is — the API's own
 * public origin, which is not the one the web server talks to it on.
 *
 * Anything already absolute is left alone, which is what keeps the seed's
 * made-up URLs working.
 */
export const mediaUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value === '') return null
  return value.startsWith('/media/') ? `${env.MEDIA_ORIGIN}${value}` : value
}

/**
 * The names on disk. Anything that is not one of ours is ignored rather than
 * reported: the folder is a volume, and a volume collects `.DS_Store`.
 */
export async function storedNames(): Promise<string[]> {
  const names = await readdir(env.MEDIA_DIR).catch(() => [] as string[])
  return names.filter((name) => STORED.test(name))
}
