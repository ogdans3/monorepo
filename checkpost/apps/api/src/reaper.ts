import type { FastifyBaseLogger } from 'fastify';
import type { DemoService } from './services/demo-service.js';
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

/**
 * Puts the landing page's list back the way it was found, once nobody has
 * touched it for a while.
 *
 * Its own timer rather than a job inside the reaper above: that one sweeps
 * every six hours, which is the right beat for a year-old list and the wrong
 * one for a front page that should have something left to do on it. This does
 * nothing at all until somebody has actually opened the landing page.
 */
export function startDemoKeeper(
  demo: DemoService,
  log: FastifyBaseLogger,
  options: { quietMs: number; intervalMs?: number },
): () => void {
  const interval = options.intervalMs ?? 60_000;

  const run = async () => {
    try {
      const restored = await demo.resetIfQuiet(options.quietMs);
      if (restored > 0) log.info({ restored }, 'demo list tidied');
    } catch (error) {
      log.error({ error }, 'demo keeper failed');
    }
  };

  const timer = setInterval(() => void run(), interval);
  timer.unref?.();
  return () => clearInterval(timer);
}
