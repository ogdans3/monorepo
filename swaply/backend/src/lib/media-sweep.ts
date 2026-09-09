import { stat } from 'node:fs/promises'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'
import { env } from '../env.js'
import { removeStored, storedNames } from './media.js'
import { many } from './rows.js'

/** A picture is uploaded before the listing exists, so it gets a day of grace. */
const GRACE_HOURS = 24

/**
 * Delete the photographs nobody finished listing.
 *
 * An upload happens on 10b before the listing is created, and somebody who
 * changes their mind leaves the bytes behind. Without this the volume only ever
 * grows, and it grows with pictures of the inside of people's homes — which is
 * the part that makes it a data protection problem and not a disk one.
 *
 * A file counts as referenced by a live listing or by a completed trade's
 * snapshot. Anything else, older than the grace period, goes.
 */
export async function sweepOrphanedMedia(db: Database): Promise<number> {
  const names = await storedNames()
  if (names.length === 0) return 0

  const referenced = new Set(
    (
      await many<{ url: string }>(
        db,
        sql`select url from item_media
            union
            select cover_url as url from trade_item_snapshots where cover_url is not null`,
      )
    ).map((row) => row.url),
  )

  const cutoff = Date.now() - GRACE_HOURS * 60 * 60 * 1000
  let removed = 0
  for (const name of names) {
    if (referenced.has(`/media/${name}`)) continue
    const info = await stat(join(env.MEDIA_DIR, name)).catch(() => null)
    if (!info || info.mtimeMs > cutoff) continue
    await removeStored(`/media/${name}`)
    removed++
  }
  return removed
}
