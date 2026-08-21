import type { FastifyBaseLogger } from 'fastify';
import type { ListService } from './services/list-service.js';

const HOUR = 60 * 60 * 1000;

export interface ReaperOptions {
  listTtlDays: number;
  eventRetentionDays: number;
  intervalMs?: number;
}

/**
 * Nothing in Checkpost has an owner, so nothing ever gets deleted by a person
 * cleaning up their account. This is the only thing that bounds the database:
 * change-log rows past retention, and lists nobody has opened in a year.
 *
 * Returns a function that stops it.
 */
export function startReaper(
  service: ListService,
  log: FastifyBaseLogger,
  options: ReaperOptions,
): () => void {
  const interval = options.intervalMs ?? 6 * HOUR;

  const run = async () => {
    try {
      const events = await service.pruneEvents();
      const abandoned = await service.pruneAbandonedLists(options.listTtlDays);
      const links = await service.pruneOrphanLinks();
      // Expired cache entries hold a slot until something asks for them. The
      // reaper is already the place where nothing-in-particular gets tidied up.
      const cached = service.sweepCache();
      if (events > 0 || abandoned > 0 || links > 0) {
        log.info({ events, abandoned, links, cached }, 'reaper swept');
      }
    } catch (error) {
      log.error({ error }, 'reaper failed');
    }
  };

  // First sweep after a minute, so a restart loop never hammers the database.
  const kickoff = setTimeout(() => void run(), 60_000);
  const timer = setInterval(() => void run(), interval);
  kickoff.unref?.();
  timer.unref?.();

  return () => {
    clearTimeout(kickoff);
    clearInterval(timer);
  };
}
