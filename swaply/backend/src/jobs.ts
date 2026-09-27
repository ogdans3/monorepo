import type { FastifyBaseLogger } from 'fastify'

import type { Database } from './db/index.js'
import { sweepOrphanedMedia } from './lib/media-sweep.js'
import { expireWithdrawals } from './trades/actions.js'
import { eraseInactiveDevices, purgeRetained } from './trades/erasure.js'
import { sweepForCycles } from './trades/sweep.js'

const DAY = 24 * 60 * 60_000

/**
 * The things that have to happen without anyone pressing a button: a
 * withdrawal deadline running out, the sweep that catches cycles the
 * incremental search could not see, the photographs nobody finished listing,
 * and once a day, what the retention rules say may no longer be kept.
 *
 * In-process on purpose. A second API container would run them twice, which is
 * harmless for the sweep — it refuses to open a trade on listings another one
 * already holds — but would race on the deadline. One instance for now.
 */
export function startJobs(db: Database, log: FastifyBaseLogger) {
  const every = (
    ms: number,
    name: string,
    run: () => Promise<number | void>,
    opts: { soon?: boolean } = {},
  ) => {
    const tick = () =>
      run()
        .then((n) => {
          if (typeof n === 'number' && n > 0) log.info({ job: name, count: n }, 'job did something')
        })
        .catch((err) => log.error({ job: name, err }, 'job failed'))
    const timer = setInterval(tick, ms)
    // Never hold the process open on our own account.
    timer.unref()
    // An interval starts again from nothing on every restart, and a deploy is
    // a restart. A job a day away is one that a deploy a day never lets run,
    // so a daily job also runs a minute after the process comes up.
    if (opts.soon) setTimeout(tick, 60_000).unref()
    return timer
  }

  return [
    every(5 * 60_000, 'expire-withdrawals', () => expireWithdrawals(db)),
    every(60 * 60_000, 'sweep-cycles', async () => (await sweepForCycles(db)).length),
    every(6 * 60 * 60_000, 'sweep-media', () => sweepOrphanedMedia(db)),
    every(DAY, 'retention', () => retention(db, log), { soon: true }),
  ]
}

/**
 * What may no longer be kept: device accounts nobody has used for twelve
 * months, and sealed records whose claim window has closed.
 *
 * Logged every time, zeros included. Most days both are nothing, and a line
 * that says so is how anybody can tell a job that ran and found nothing from
 * one that stopped running.
 */
async function retention(db: Database, log: FastifyBaseLogger) {
  const erasedDevices = await eraseInactiveDevices(db, {
    failed: (userId, err) => log.error({ job: 'retention', userId, err }, 'could not erase a device'),
  }).catch((err) => {
    log.error({ job: 'retention', err }, 'erasing idle devices failed')
    return null
  })
  // Apart from the erasure, so one failing does not keep the other from running.
  const purgedRecords = await purgeRetained(db).catch((err) => {
    log.error({ job: 'retention', err }, 'purging sealed records failed')
    return null
  })
  log.info({ job: 'retention', erasedDevices, purgedRecords }, 'retention ran')
}
