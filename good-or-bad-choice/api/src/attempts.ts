/**
 * A fixed-window counter, per key, in memory.
 *
 * Guessing a password is the only thing in this API worth doing at volume, and
 * this is enough to make it pointless. In memory rather than in Postgres or
 * Redis because there is one process: a second one would each get its own
 * window, which halves the protection rather than removing it, and by then the
 * product has bigger questions than this file.
 */
export class Attempts {
  readonly #max: number;
  readonly #windowMs: number;
  readonly #seen = new Map<string, { count: number; resetAt: number }>();

  constructor(options: { max: number; windowMs: number }) {
    this.#max = options.max;
    this.#windowMs = options.windowMs;
  }

  /** Counts an attempt and says whether it is allowed. */
  allow(key: string): boolean {
    const now = Date.now();
    this.#sweep(now);
    const entry = this.#seen.get(key);
    if (!entry || entry.resetAt <= now) {
      this.#seen.set(key, { count: 1, resetAt: now + this.#windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.#max;
  }

  /** After a success. Getting it right should not spend the next person's budget. */
  forget(key: string): void {
    this.#seen.delete(key);
  }

  /**
   * Swept on write rather than on a timer. A timer here is a handle that keeps
   * the process alive for a map that is empty most of the time.
   */
  #sweep(now: number): void {
    if (this.#seen.size < 1000) return;
    for (const [key, entry] of this.#seen) {
      if (entry.resetAt <= now) this.#seen.delete(key);
    }
  }
}
