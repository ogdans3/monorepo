// How long a sign-in waits before its password is even looked at.
//
// `POST /auth/login` used to check a password as fast as one could be sent, so
// guessing somebody's was a loop and some patience. Now a run of wrong
// passwords for one address makes the next attempt wait, twice as long after
// each one: the first few are free, then 2 s, 4 s, 8 s … up to a quarter of an
// hour. Somebody who mistyped and then remembered never notices; a script is
// down to four tries an hour. The right password ends the run, and so does a
// day without a wrong one.
//
// **Keyed by the address typed, not by who is asking.** The guessing this
// stops is aimed at one account, and the address is how a sign-in names it —
// compared without regard to case, as every address is (`emailAddress`). Who
// is asking cannot be told apart here anyway: Fastify trusts no forwarded
// header (there is no `trustProxy`), so behind Caddy and Cloudflare
// `request.ip` is the proxy's address for everybody, and keying on it would
// make one person's typos everybody's wait. `X-Forwarded-For` or
// `CF-Connecting-IP` is no better until nothing but the proxies can reach the
// API, which is not arranged: a header anybody can write is not a key. The
// price of keying by address is that somebody who knows yours can make you
// wait — never longer than the cap between two tries, and never past a right
// password.
//
// **Every address is counted, with an account behind it or not**, and the
// refusal comes before the account is looked up: a wait that only real
// accounts got would say which addresses have one.
//
// In memory, because there is one API process, as the migrations run on boot
// already assume. A restart forgets every run, which costs a guesser's wait
// and nobody's account. How much it remembers is bounded: see `makeRoom`.

export type SignInBackoffOptions = {
  /** Wrong passwords in a row that cost nothing: a typo or two is not an attack. */
  free: number
  /** The wait after the first wrong password past the free ones, doubled for each after it. */
  firstWaitMs: number
  /** No wait is longer than this. */
  maxWaitMs: number
  /** A run of wrong passwords is forgotten this long after the last of them. */
  forgetAfterMs: number
  /** How many addresses are remembered at once. */
  maxAddresses: number
  /** The clock, which a test turns by hand. */
  now: () => number
}

export const signInBackoffDefaults: SignInBackoffOptions = {
  free: 3,
  firstWaitMs: 2_000,
  maxWaitMs: 15 * 60_000,
  forgetAfterMs: 24 * 60 * 60_000,
  maxAddresses: 10_000,
  now: Date.now,
}

type Run = { failures: number; lastAt: number }

export class SignInBackoff {
  private readonly opts: SignInBackoffOptions
  // In the order of each run's last wrong password, oldest first: a run is
  // taken out and put back every time it grows.
  private readonly runs = new Map<string, Run>()

  constructor(opts: Partial<SignInBackoffOptions> = {}) {
    this.opts = { ...signInBackoffDefaults, ...opts }
  }

  /**
   * Whether a password for `address` may be checked now: 0 when it may, and
   * otherwise how many milliseconds are left to wait.
   *
   * An attempt let through is counted as a wrong one before it is checked, and
   * `succeeded` takes it back: counted after, a burst sent at once was all
   * checked before the first of it had failed. A refused attempt is not
   * counted at all — it was never checked, and counting it would let anybody
   * who knows the address keep its owner waiting for ever.
   */
  attempt(address: string): number {
    const now = this.opts.now()
    const run = this.current(address, now)
    const wait = run ? run.lastAt + this.waitAfter(run.failures) - now : 0
    if (wait > 0) return wait

    this.runs.delete(address)
    this.runs.set(address, { failures: (run?.failures ?? 0) + 1, lastAt: now })
    this.makeRoom(address, now)
    return 0
  }

  /** The password was right, and the run is over. */
  succeeded(address: string) {
    this.runs.delete(address)
  }

  /** The run for `address`, unless there is none or it is old enough to forget. */
  private current(address: string, now: number): Run | null {
    const run = this.runs.get(address)
    if (!run) return null
    if (now - run.lastAt >= this.opts.forgetAfterMs) {
      this.runs.delete(address)
      return null
    }
    return run
  }

  /** How long the attempt after `failures` wrong passwords in a row waits. */
  private waitAfter(failures: number): number {
    const past = failures - this.opts.free
    if (past <= 0) return 0
    // The exponent is held down before the cap applies, so a long run never
    // climbs to Infinity on the way.
    return Math.min(this.opts.firstWaitMs * 2 ** Math.min(past - 1, 30), this.opts.maxWaitMs)
  }

  /**
   * Keeps the map at `maxAddresses`. What goes first is a run old enough to be
   * forgotten anyway, then the shortest run, the oldest of those — so a flood
   * of made-up addresses, each tried once, cannot push out an address
   * somebody is working through, which a bound that dropped the oldest would
   * let it do. Never `keep`, the address just counted: in a map full of
   * longer runs it would otherwise be forgotten at once, every time, and never
   * made to wait.
   */
  private makeRoom(keep: string, now: number) {
    while (this.runs.size > this.opts.maxAddresses) {
      let drop: string | undefined
      let fewest = Infinity
      for (const [address, run] of this.runs) {
        if (address === keep) continue
        if (now - run.lastAt >= this.opts.forgetAfterMs) {
          drop = address
          break
        }
        if (run.failures < fewest) {
          fewest = run.failures
          drop = address
        }
      }
      if (drop === undefined) return
      this.runs.delete(drop)
    }
  }
}

/**
 * «30 sekunder», «2 minutter»: rounded up, so that waiting as long as it says
 * is always long enough. Minutes from one minute on.
 */
export function waitInWords(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  if (seconds < 60) return seconds === 1 ? '1 sekund' : `${seconds} sekunder`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minutt' : `${minutes} minutter`
}
