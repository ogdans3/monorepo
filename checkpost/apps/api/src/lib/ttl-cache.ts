export interface TtlCacheOptions<V> {
  /** Hard ceiling on entries. The oldest is dropped first. */
  maxEntries: number;
  /**
   * Default lifetime, in milliseconds. `set` may shorten it per entry.
   * Zero or less means entries never expire, and capacity is the only thing
   * that ever removes one.
   */
  ttlMs: number;
  /**
   * Called whenever an entry stops being cached: evicted, expired, replaced,
   * deleted or cleared. `ListCache` uses it to keep its reverse indexes exactly
   * as large as the cache itself, which is what stops them leaking.
   */
  onEvict?(key: string, value: V): void;
}

export interface TtlCacheStats {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * A bounded map with least-recently-used eviction, and optionally an expiry.
 *
 * Insertion order in a `Map` is the LRU order for free: a hit deletes and
 * re-inserts the key, so the first key the iterator yields is always the one
 * nobody has wanted for the longest. Expiry is checked on read rather than by a
 * timer, because a timer per entry is how a cache becomes the thing that keeps
 * the process awake.
 *
 * With `ttlMs` at zero nothing expires and capacity is the whole policy: the
 * cache fills up and then, forever after, the least recently used entry makes
 * room for the newest. That is the right default here, because entries are
 * invalidated by the writes that make them wrong rather than by the clock.
 */
export class TtlCache<V> {
  readonly #entries = new Map<string, Entry<V>>();
  readonly #max: number;
  readonly #ttl: number;
  readonly #onEvict?: (key: string, value: V) => void;
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(options: TtlCacheOptions<V>) {
    this.#max = Math.max(1, options.maxEntries);
    this.#ttl = options.ttlMs > 0 ? options.ttlMs : Infinity;
    this.#onEvict = options.onEvict;
  }

  get(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (!entry) {
      this.#misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.#drop(key, entry.value);
      this.#misses += 1;
      return undefined;
    }
    // Re-insert to move the key to the young end of the iteration order.
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    this.#hits += 1;
    return entry.value;
  }

  /**
   * The value without the bookkeeping: no hit counted, no LRU refresh. For
   * guards that ask "what do I already know" rather than serving a request.
   */
  peek(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) return undefined;
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.#ttl): void {
    const previous = this.#entries.get(key);
    if (previous) this.#drop(key, previous.value);
    // Infinity + anything is Infinity, so "never expires" needs no special case
    // on the read side: the comparison below is simply never true.
    this.#entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next();
      if (oldest.done) break;
      const victim = this.#entries.get(oldest.value)!;
      this.#drop(oldest.value, victim.value);
      this.#evictions += 1;
    }
  }

  delete(key: string): void {
    const entry = this.#entries.get(key);
    if (entry) this.#drop(key, entry.value);
  }

  clear(): void {
    for (const [key, entry] of [...this.#entries]) this.#drop(key, entry.value);
    this.#entries.clear();
  }

  /** Drops everything already expired. Cheap, and only worth running rarely. */
  sweep(): number {
    const now = Date.now();
    let dropped = 0;
    for (const [key, entry] of [...this.#entries]) {
      if (entry.expiresAt <= now) {
        this.#drop(key, entry.value);
        dropped += 1;
      }
    }
    return dropped;
  }

  get size(): number {
    return this.#entries.size;
  }

  stats(): TtlCacheStats {
    return {
      entries: this.#entries.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
    };
  }

  #drop(key: string, value: V): void {
    this.#entries.delete(key);
    this.#onEvict?.(key, value);
  }
}
