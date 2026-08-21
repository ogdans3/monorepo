import type { Access, Item, List } from '@checkpost/contract';
import { TtlCache } from '../lib/ttl-cache.js';

/**
 * What a token resolved to last time we asked the database.
 *
 * `gone` is terminal: a share-link row never comes back to life and a deleted
 * list is never undeleted, so that answer is as cacheable as a successful one.
 * It carries its ids so it stays indexed, which is what lets the reaper forget
 * it when the row is finally deleted for real. `listId` is null when the list
 * has gone and the link row is all that is left of it.
 *
 * `unknown` is the only outcome that can legitimately change, and the only one
 * with a lifetime.
 */
export type LinkOutcome =
  | { kind: 'link'; listId: string; linkId: string; access: Access }
  | { kind: 'gone'; reason: 'revoked' | 'deleted'; linkId: string; listId: string | null }
  | { kind: 'unknown' };

export interface CachedSnapshot {
  list: List;
  items: Item[];
}

export interface CachedPreview {
  title: string;
  itemCount: number;
}

export interface ListCacheOptions {
  enabled: boolean;
  /** Zero means entries never expire, and only capacity removes one. */
  ttlMs: number;
  maxEntries: number;
  /**
   * Snapshots are bounded separately, because one of them is a whole list while
   * every other entry is a handful of bytes.
   */
  maxSnapshots: number;
  /** How long a list may go without its `last_active_at` being rewritten. */
  touchIntervalMs: number;
}

export interface ListCacheStats {
  enabled: boolean;
  hits: number;
  misses: number;
  entries: number;
  /** Fraction of cacheable reads served without touching Postgres, 0 to 1. */
  hitRate: number;
}

/**
 * A token nobody has ever seen is the one answer that is allowed to go stale on
 * its own, so it is the one answer with a clock on it. Everything else here can
 * only become wrong through a write this process makes, and is corrected there.
 * Thirty seconds is still plenty to blunt a flood of guesses.
 */
const UNKNOWN_TTL_MS = 30_000;

/**
 * The read cache in front of Postgres.
 *
 * Every read Checkpost serves repeatedly is here: the token lookup that runs on
 * literally every authenticated request, the list snapshot, the revision that
 * decides whether a polling client has anything to fetch, and the copy-link
 * preview.
 *
 * By default nothing in here expires, which sounds reckless and is not: an
 * entry is not evicted by a clock because a clock knows nothing about whether
 * it is still true. **Every write goes through `ListService` or `AdminService`
 * in this process, and both invalidate here in the same breath**, so an entry
 * is correct until the moment something makes it wrong, and then it is gone.
 * What bounds the cache is capacity: it fills to `maxEntries` and the least
 * recently used entry makes room for the newest, forever. A TTL is available
 * (`CACHE_TTL_SECONDS`) for anyone who wants a belt as well as braces.
 *
 * That is also the one thing to know before running a second API instance: this
 * cache is in-process, so an instance would not see the other's writes until
 * the entry expired. `CACHE_ENABLED=0` turns the whole thing off for that case.
 * Every method below is a no-op or a miss when disabled, so nothing else in the
 * codebase needs to know.
 */
export class ListCache {
  readonly #options: ListCacheOptions;
  readonly #links: TtlCache<LinkOutcome>;
  readonly #snapshots: TtlCache<CachedSnapshot>;
  readonly #revisions: TtlCache<number>;
  readonly #previews: TtlCache<CachedPreview>;
  /** Presence of a key means "recently written"; the value is never read. */
  readonly #touched: TtlCache<true>;

  /**
   * Reverse indexes, so a revocation can find the token hashes it has to
   * expire. Maintained by the caches' own eviction hook rather than alongside
   * them, which is what keeps them from outliving the entries they describe.
   */
  readonly #hashByLink = new Map<string, string>();
  readonly #hashesByList = new Map<string, Set<string>>();

  constructor(options: ListCacheOptions) {
    this.#options = options;
    const { maxEntries, ttlMs } = options;
    this.#links = new TtlCache<LinkOutcome>({
      maxEntries,
      ttlMs,
      onEvict: (hash, outcome) => this.#unindex(hash, outcome),
    });
    this.#snapshots = new TtlCache({ maxEntries: options.maxSnapshots, ttlMs });
    this.#revisions = new TtlCache({ maxEntries, ttlMs });
    this.#previews = new TtlCache({ maxEntries, ttlMs });
    this.#touched = new TtlCache({ maxEntries, ttlMs: options.touchIntervalMs });
  }

  get enabled(): boolean {
    return this.#options.enabled;
  }

  // ---------------------------------------------------------------------------
  // Token lookup
  // ---------------------------------------------------------------------------

  link(tokenHash: string): LinkOutcome | undefined {
    if (!this.#options.enabled) return undefined;
    return this.#links.get(tokenHash);
  }

  rememberLink(tokenHash: string, outcome: LinkOutcome): void {
    if (!this.#options.enabled) return;
    this.#links.set(tokenHash, outcome, outcome.kind === 'unknown' ? UNKNOWN_TTL_MS : undefined);
    this.#index(tokenHash, outcome);
  }

  /**
   * Turns one link's cached answer into a terminal one, rather than just
   * dropping it. A replaced link is a hard cut, so the next request has to say
   * "410, this link was replaced" immediately — and now does so without a
   * query, which is what makes an evicted client cheap instead of expensive.
   */
  expireLink(listId: string, linkId: string, reason: 'revoked' | 'deleted'): void {
    if (!this.#options.enabled) return;
    const hash = this.#hashByLink.get(linkId);
    if (hash) this.rememberLink(hash, { kind: 'gone', reason, linkId, listId });
  }

  /** Same, for every link on a list: a reissue, or the list itself going. */
  expireLinks(listId: string, reason: 'revoked' | 'deleted'): void {
    if (!this.#options.enabled) return;
    const hashes = this.#hashesByList.get(listId);
    if (!hashes) return;
    // Copied first: remembering an outcome rewrites the set being iterated.
    for (const hash of [...hashes]) {
      const current = this.#links.peek(hash);
      if (!current || current.kind === 'unknown') continue;
      this.rememberLink(hash, { kind: 'gone', reason, linkId: current.linkId, listId });
    }
  }

  /**
   * Forgets a link entirely, so the next request asks the database again. For
   * the one case where the row is really gone and 401 is the honest answer.
   */
  forgetLink(linkId: string): void {
    if (!this.#options.enabled) return;
    const hash = this.#hashByLink.get(linkId);
    if (hash) this.#links.delete(hash);
  }

  // ---------------------------------------------------------------------------
  // List data
  // ---------------------------------------------------------------------------

  snapshot(listId: string): CachedSnapshot | undefined {
    if (!this.#options.enabled) return undefined;
    return this.#snapshots.get(listId);
  }

  /**
   * Stores a snapshot a read just fetched — unless a write has overtaken it.
   *
   * A read is two statements, and READ COMMITTED gives each its own view, so a
   * write landing between them means the rows and the revision that came back
   * do not describe the same moment. Momentarily wrong is one thing; cached
   * until the process restarts is another. Since `invalidateList` records the
   * new revision the instant a write commits, anything that arrives here older
   * than what we already know is exactly that torn read, and is dropped on the
   * floor.
   */
  rememberSnapshot(listId: string, snapshot: CachedSnapshot): void {
    if (!this.#options.enabled) return;
    const known = this.#revisions.peek(listId);
    if (known !== undefined && snapshot.list.revision < known) return;
    // One array is handed to every caller, so freezing it turns a stray
    // in-place sort somewhere downstream into a throw instead of a mystery.
    Object.freeze(snapshot.items);
    this.#snapshots.set(listId, snapshot);
    this.#revisions.set(listId, snapshot.list.revision);
  }

  revision(listId: string): number | undefined {
    if (!this.#options.enabled) return undefined;
    return this.#revisions.get(listId);
  }

  /**
   * Monotonic on purpose. A read that started before a write can finish after
   * it, and a revision that went backwards would tell a polling client there is
   * nothing to fetch when there is.
   */
  rememberRevision(listId: string, revision: number): void {
    if (!this.#options.enabled) return;
    const known = this.#revisions.peek(listId);
    if (known !== undefined && known >= revision) return;
    this.#revisions.set(listId, revision);
  }

  preview(listId: string): CachedPreview | undefined {
    if (!this.#options.enabled) return undefined;
    return this.#previews.get(listId);
  }

  rememberPreview(listId: string, preview: CachedPreview): void {
    if (!this.#options.enabled) return;
    this.#previews.set(listId, preview);
  }

  /**
   * Called after every mutation. The new revision is known at the call site, so
   * it is recorded rather than dropped: a client polling `?since=` gets its
   * "nothing new" answer with no query at all, which is the read this product
   * serves more than any other.
   */
  invalidateList(listId: string, revision?: number): void {
    if (!this.#options.enabled) return;
    this.#snapshots.delete(listId);
    this.#previews.delete(listId);
    if (revision === undefined) this.#revisions.delete(listId);
    else this.rememberRevision(listId, revision);
  }

  /**
   * The list is gone. Its data goes, and its links start answering 410, which
   * is also what makes the dropped revision harmless: a read that was already
   * in flight can still fill a snapshot behind us, but no token can reach it.
   */
  forgetList(listId: string): void {
    if (!this.#options.enabled) return;
    this.expireLinks(listId, 'deleted');
    this.#snapshots.delete(listId);
    this.#previews.delete(listId);
    this.#revisions.delete(listId);
    this.#touched.delete(listId);
  }

  // ---------------------------------------------------------------------------
  // Liveness stamps
  // ---------------------------------------------------------------------------

  /**
   * `last_active_at` exists only to stop the reaper deleting a list somebody is
   * still using, and the reaper's window is a year. Writing it on every single
   * read is therefore pure noise: one write per list per interval says exactly
   * the same thing.
   */
  shouldTouch(listId: string): boolean {
    if (!this.#options.enabled) return true;
    return this.#touched.get(listId) === undefined;
  }

  markTouched(listId: string): void {
    if (!this.#options.enabled) return;
    this.#touched.set(listId, true);
  }

  /** After a failed write, so the next read tries again rather than waiting. */
  forgetTouch(listId: string): void {
    this.#touched.delete(listId);
  }

  // ---------------------------------------------------------------------------
  // Housekeeping
  // ---------------------------------------------------------------------------

  /** Drops expired entries. Called by the reaper; nothing depends on it. */
  sweep(): number {
    return (
      this.#links.sweep() +
      this.#snapshots.sweep() +
      this.#revisions.sweep() +
      this.#previews.sweep() +
      this.#touched.sweep()
    );
  }

  /**
   * Empties everything. Production never needs this; the test suite does,
   * because it truncates tables behind the API's back between cases.
   */
  clear(): void {
    this.#links.clear();
    this.#snapshots.clear();
    this.#revisions.clear();
    this.#previews.clear();
    this.#touched.clear();
    this.#hashByLink.clear();
    this.#hashesByList.clear();
  }

  stats(): ListCacheStats {
    const parts = [
      this.#links.stats(),
      this.#snapshots.stats(),
      this.#revisions.stats(),
      this.#previews.stats(),
    ];
    const hits = parts.reduce((total, part) => total + part.hits, 0);
    const misses = parts.reduce((total, part) => total + part.misses, 0);
    const entries = parts.reduce((total, part) => total + part.entries, 0);
    return {
      enabled: this.#options.enabled,
      hits,
      misses,
      entries,
      hitRate: hits + misses === 0 ? 0 : hits / (hits + misses),
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Terminal answers stay indexed as well as live ones. Without that, a link
   * cached as `410` would be unreachable from its own id, and the reaper could
   * not tell it that the row it describes has finally been deleted for good.
   */
  #index(tokenHash: string, outcome: LinkOutcome): void {
    if (outcome.kind === 'unknown') return;
    this.#hashByLink.set(outcome.linkId, tokenHash);
    if (!outcome.listId) return;
    let hashes = this.#hashesByList.get(outcome.listId);
    if (!hashes) {
      hashes = new Set();
      this.#hashesByList.set(outcome.listId, hashes);
    }
    hashes.add(tokenHash);
  }

  #unindex(tokenHash: string, outcome: LinkOutcome): void {
    if (outcome.kind === 'unknown') return;
    if (this.#hashByLink.get(outcome.linkId) === tokenHash) {
      this.#hashByLink.delete(outcome.linkId);
    }
    if (!outcome.listId) return;
    const hashes = this.#hashesByList.get(outcome.listId);
    if (!hashes) return;
    hashes.delete(tokenHash);
    if (hashes.size === 0) this.#hashesByList.delete(outcome.listId);
  }
}
