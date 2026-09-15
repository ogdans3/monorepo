# Working in this repo

Read `README.md` first. `PRODUCT.md` and `DESIGN.md` are the design contract and
are not decoration.

## Layout

```
app/   Flutter, browser + iOS + Android   (one lib/, only the shell differs)
api/   Fastify + Postgres, and the server that serves the browser build
```

The two are not a workspace. `api/` has its own `package.json` and `app/` uses
`flutter pub`; nothing imports across the line.

## Invariants. Break these and things go subtly wrong

**The device is the source of truth, not the server.** `AppState.record` is
synchronous and writes to memory, and the screen is already redrawing before
anything touches disk or the network. Nothing in the UI may `await` the API —
not to record a tap, not to draw a recap. An account is a second home for the
same facts.

**A tap's id is minted on the device, at the moment of the tap.** That is what
makes syncing an upsert rather than a conversation: a batch sent twice because
the first reply was lost carries the same ids and lands once. Never let the
server mint one.

**A tap carries when it happened, never when it arrived.** A week offline and
then a sync must not pile a week of choices onto today. `at` is set at the tap
and travels as UTC.

**Nothing the API returns may be cached.** Every list answers at the same
address — `GET /api/choices` is the URL for everybody and the bearer token
decides whose taps come back — so a cache keying on the URL serves one account's
history to the next. `no-store` and `Vary: Authorization` on everything under
`/api/`, and `no-cache` on the browser build because Flutter's entrypoints have
no content hash and a CDN would otherwise make a deploy invisible.

**The colour is never the only thing saying it.** This is an app made of red and
green, which is the common colour blindness. Every place the two decide
something also says it in a word: the halves are labelled, the verdict is
"mostly good", the menu rows carry counts beside the bar. The palette also keeps
a lightness gap wide enough to survive a greyscale screenshot, and Settings
offers a blue/orange pair. Adding a screen where the hue carries it alone is the
easiest way to break this product.

**Three files hold one palette:** `DESIGN.md` and
`app/lib/design/tokens.dart`. Change them together.

**Never store a raw password or a raw token.** scrypt for one, SHA-256 for the
other, both in `api/src/auth.ts`, both using nothing but `node:crypto`. A
password hash must not become a dependency somebody has to keep patched.

**Sign-in says the same thing about a wrong password and a name that does not
exist**, and does the same amount of work either way. Returning instantly for an
unknown name is how somebody finds out which names exist. `api/src/app.ts`
verifies against a dummy hash for the missing case, and there is a test.

**The recap reads oldest first.** The grid is a page: the beginning is top left.
`Recap.taps` is sorted and the painter walks it in order.

**`ColoredBox` with no child lays out at `constraints.smallest`.** The menu's
balance bar was in the tree and eight pixels of nothing on screen until its Row
got `CrossAxisAlignment.stretch`. Worth knowing before adding another bare
coloured rectangle to a Row.

**Reduce Motion is a setting people chose for a reason.** The tap throw is
skipped and the recap lands every square at once, both pinned by a test. The
flash on the tapped half survives, because it is the acknowledgement and not the
flourish.

## Testing

```bash
cd api && npm test                 # real Postgres, guarded
cd app && flutter analyze && flutter test
```

`api/test/guard.ts` refuses any database that is not local or whose name does
not say "test". Do not weaken it. The suite truncates `users` and lets the
cascade take the rest.

The local Postgres this project expects is on **5435** — 5432, 5433 and 5434
belong to other projects on the same machine, and none of them are shared.

## Conventions

- Conventional Commits, scoped `good-or-bad-choice`.
- Product-facing copy is British-flavoured plain English, lower case for labels,
  no exclamation marks, no encouragement. The app never says "well done" and
  never says "oh dear".
- Comments explain *why*, especially where the code looks odd on purpose (the
  √ landing schedule, the dummy password verify, the debounced disk write).
