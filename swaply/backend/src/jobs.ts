import type { FastifyBaseLogger } from 'fastify'

import type { Database } from './db/index.js'
import { sweepOrphanedMedia } from './lib/media-sweep.js'
import { expireWithdrawals } from './trades/actions.js'
import { sweepForCycles } from './trades/sweep.js'

/**
 * The three things that have to happen without anyone pressing a button: a
 * withdrawal deadline running out, the sweep that catches cycles the
 * incremental search could not see, and the photographs nobody finished
 * listing.
 *
 * In-process on purpose. A second API container would run them twice, which is
 * harmless for the sweep — it refuses to open a trade on listings another one
 * already holds — but would race on the deadline. One instance for now.
 */
export function startJobs(db: Database, log: FastifyBaseLogger) {
  const every = (ms: number, name: string, run: () => Promise<number>) => {
    const timer = setInterval(() => {
      run()
        .then((n) => {
          if (n > 0) log.info({ job: name, count: n }, 'job did something')
        })
        .catch((err) => log.error({ job: name, err }, 'job failed'))
    }, ms)
    // Never hold the process open on our own account.
    timer.unref()
    return timer
  }

  return [
    every(5 * 60_000, 'expire-withdrawals', () => expireWithdrawals(db)),
    every(60 * 60_000, 'sweep-cycles', async () => (await sweepForCycles(db)).length),
    every(6 * 60 * 60_000, 'sweep-media', () => sweepOrphanedMedia(db)),
  ]
}
