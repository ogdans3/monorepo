# Working in this repo

Checkpost is a shared checklist that lives at a link. Read `README.md` first.
`PRODUCT.md` and `DESIGN.md` are the design contract and are not decoration.

## Layout

```
apps/api      Fastify + Drizzle + Postgres + ws   (@checkpost/api)
apps/app      Flutter, iOS + Android
apps/web      SvelteKit landing + the list in a browser  (@checkpost/web)
packages/     contract: Zod schemas, limits, token helpers
```

pnpm workspace covers `apps/api`, `apps/web`, `packages/*`. The Flutter app is
outside it and uses `flutter pub`.

## Invariants. Break these and things go subtly wrong

**Tokens never appear in a URL the API sees.** `Authorization: Bearer` only,
never a query string. Not even for the WebSocket, where browsers cannot set
headers and the token rides `Sec-WebSocket-Protocol` instead. The one exception
is `/l/<token>` on the web app, which is why that route is `no-store`,
`noindex`, and disallowed in `robots.txt`.

**The web server never sees list data.** The list route is `ssr = false` on
purpose, so the browser calls the API directly. Do not add a server `load` or a
proxy endpoint for list content, however convenient it looks.

**`PUBLIC_API_ORIGIN` is read in two places that must agree**: the client, and
the Content Security Policy in `svelte.config.js`. If they diverge the browser
blocks every request with no obvious cause. Both read the project root `.env`.

**Only the SHA-256 of a token is stored.** Never persist a raw token
server-side.

**Every mutating transaction bumps `lists.revision` as its first statement.**
That row lock is what serialises concurrent writers, and the change-log row and
the broadcast hang off it. `ListService.#mutate` exists so this cannot be forgotten.

**Every write invalidates the read cache in the same breath.** `ListCache` sits
in front of Postgres for token lookups, snapshots, revisions and copy previews,
and **by default nothing in it ever expires**: entries are evicted when they are
wrong, or when capacity needs the room, never on a timer. That is safe *only*
because the writes that would make an entry wrong happen in this process and
invalidate it. `#mutate` does it for every list mutation; the link paths do it
by hand, and a revocation rewrites the cached answer to `410` rather than
dropping it, so the hard cut survives. **`AdminService` writes behind
`ListService`'s back**, which is why it takes the cache as a required
constructor argument. A write path added there without an invalidation is a
revoked link that keeps working until the process restarts.

**The cache is in-process, so more than one API container needs
`CACHE_ENABLED=0`.** Same reasoning as `MIGRATE_ON_BOOT`. Unlike `RealtimeHub`,
where a second instance only costs a beat of latency, here it costs correctness.
This is not hypothetical: two instances ran against the same database for weeks
on two machines, both with the cache on, and both running the reaper. Deploy
this project to exactly one machine, and check the other one before assuming
that is true.

**A socket that has stopped working does not say so.** A browser goes on
reporting `OPEN` for a connection whose network is gone — no close, no error,
no event of any kind — and a list watched in that state quietly stops moving
while looking perfectly healthy. This is what "I ticked it on my laptop and my
phone never noticed" actually is. So `realtime.ts` treats every frame as a sign
of life, asks for one every `PING_MS`, and retires a socket that has produced
nothing for `SILENT_MS` itself instead of waiting for `onclose`, which on a
dead connection can be minutes away. Under that, `ListSession` asks
`GET /changes?since=` every `POLL_MS` while the tab is visible. Neither is
redundant with the other and neither is redundant with the socket: the socket
is the fast path, the poll is the bound on how stale a visible list can get,
and it costs almost nothing because the usual answer is "nothing since your
revision" from a cached number. The Flutter client gets the same guarantee from
`pingInterval` on its socket, which Dart enforces itself.

**Remote changes are folded into the screen, not applied one per frame.** A
burst — two people working down a list, or one finger on a box — arrives as a
burst of frames, and redrawing on each one makes the row strobe. `#collect`
applies the first change after a quiet moment at once and gathers the rest into
one update per `FOLD_MS`. That is safe only because `#applyEvent` drops any
event at or below the revision the list has already reached, so a reconcile can
overtake the queue and what it left behind is ignored rather than replayed over
the top of a newer answer. Keep that guard if you touch either.

**The landing page's list is real, and it is the one write in the product
that needs no link.** `DemoService` is what keeps that from being a liability,
and it rests on two things that must stay true together: the token the page
publishes is **`read`**, and `POST /demo/tick` is the **entire** write surface
for that list — one boolean on one row, scoped to the demo's list id. Add a
second demo route, or widen the published link to `write`, and the front page
becomes something anybody can rewrite. The five rows live in
`packages/contract` because the API seeds from them and the page renders them
before it has heard back; their ids are fixed so a restart keeps whatever
people had ticked, and so the rows do not remount under the browser when the
live state arrives. The link is reissued every boot, because no raw token is
ever stored — which is why `ListSession` has a demo mode that asks for a new
one instead of showing the dead end an ordinary list would.

**The database is the `db` container, on a volume, on the server.** It is not
hosted any more, so `ops/backup.sh` is the only thing standing between a bad day
and the lists being gone. Its port is bound to loopback on purpose; see
`docker-compose.yml`.

**Anything that changes the database behind the API's back must clear the
cache.** `test/helpers.ts` does it after its `truncate`, and a test that ages a
row by hand also has to `forgetTouch` it. This is the failure mode to suspect
first when a test passes alone and fails in a suite. In production the same
applies to `psql`: with no expiry, restarting the API is the way to flush it.

**`apps/api/test/` is not typechecked** (`tsconfig.json` includes `src` only),
so a test that constructs a service or a cache by hand will happily pass a
malformed options object. Change a constructor and grep the tests.

**Access lives on the link, not the list.** One list has many live links at
different levels, so there is deliberately no unique index forcing one. Every
list route names the access it needs through `requireAccess`, which is why
adding a route without deciding who may call it is not possible.

**A copy link is not a weak read link.** It cannot see the list it came from at
all. It answers `403 copy_link`, which clients turn into an offer rather than an
error, and it is the only thing `POST /list/copy` accepts.

**A revoked or deleted list answers 410, never 401.** `share_links` rows
deliberately outlive their list (`on delete set null`) to make that possible.
The app's copy depends on the distinction.

**Three files hold one palette:** `DESIGN.md`, `apps/web/src/app.css`,
`apps/app/lib/design/tokens.dart`. Change them together.

**Only two clients may compute a position, and the web is not one of them.**
The Flutter app carries `fractional_index.dart`, so it works out the key for a
dragged row itself and shows the move instantly. The web client has no copy and
must not gain one, because that would make three files to keep byte-identical.
It holds a short-lived id order (`#pendingOrder` in `list-session.svelte.ts`)
until the server answers with the real key, and drops it then. Either way the
**server** is told in terms of neighbours, never a key: two people dragging
into the same gap have to end up with different keys, and only the server sees
both.

**Two files hold one ordering algorithm:**
`apps/api/src/lib/fractional-index.ts` and
`apps/app/lib/data/fractional_index.dart`. They must produce byte-identical
keys, and both test suites assert the same properties. Postgres sorts
`position` with an explicit `COLLATE "C"` in every query and index. Keep it
there.

**Deploy through the dashboard, never by hand.** `docker compose up` recreates
the front-door container and drops it off the `aicentral` network, which is
what the proxy resolves. Only the dashboard's start path reattaches it, so a
manual deploy takes the public site down with a 502.

**No BuildKit-only syntax in the Dockerfiles.** The dashboard's docker CLI has
no buildx and falls back to the classic builder, which fails outright on
`RUN --mount`. It has to build anywhere.

**The test suite truncates every table.** `apps/api/test/guard.ts` refuses any
database that is not local or whose name does not say "test". Do not weaken it.
`DATABASE_URL` now points at the `db` container on the server, which holds the
real lists.

**Correlated subqueries must be written as literal SQL.** Interpolating Drizzle
columns into a `sql` template inside a subquery renders them unqualified, so
`where list_id = id` compares the inner table to itself. It does not error, it
just reports zero. `AdminService.recentLists` has the shape to copy.

## Design rules that are not negotiable

From `PRODUCT.md` / `DESIGN.md`, restated because they get eroded first:

- **No green tick, no blue accent.** Both are the category reflex. One accent,
  the deep rose, under 10% of any screen.
- **Never colour alone.** Checked is the mark *plus* the strikethrough *plus*
  the dimming.
- **No second destructive red.** Consequences are spelled out in words in a
  confirm sheet, and the confirm button uses the normal accent.
- **No gesture-only affordance.** Swipe-to-open is a shortcut. The right-edge
  chevron and the menu do the same job. Drag-to-reorder is the same: the grip
  is a shortcut, and Move up / Move down in the item sheet do the same job.
  They are also the only way to move something a long way in a list that does
  not fit on one screen.
- **The box ticks, the row opens.** Not the other way round, which is what it
  was. The two acts are not equally cheap to get wrong: a stray tick is a
  change everybody on the list sees, a stray open costs a tap to close. So the
  one worth being sure about gets its own 48dp target and nothing else fires
  it. `widget_test.dart` pins both halves.
- **The done shelf reserves the grip's width without having a grip.** Its rows
  never reorder, but if they do not hold the column open, their checkboxes sit
  40dp left of the open rows directly above them, and a screen whose two lists
  do not line up reads as broken rather than as a distinction. The golden is
  what caught this, which is what goldens are for.
- **Cards are not the answer.** Both list surfaces are hairline-separated rows.
- **Motion 150 to 250ms, ease-out, no bounce**, and every animation has a
  `prefers-reduced-motion` / `disableAnimations` path. The one exception that
  survives Reduce Motion is the remote-change wash, because it is information.
- Empty states teach the interface. Errors are one plain sentence and a way
  forward, in the product's voice: what happened, no apology, no exclamation
  marks.

## Flutter rules learned the hard way

**Never touch `LibraryController` during a build.** It notifies its listeners,
and the home screen is one of them, sitting underneath every open list. Doing
it from `initState` throws "setState() called during build" on a real device.
Use a post-frame callback. `ListScreen.initState` shows the shape.

**`record` is called on every change to an open list**, including every timer
tick, so it has to stay cheap. `SavedList` has value equality and the
controller drops reports that change nothing. Disk writes are debounced by
400ms, except a new token, which is written straight away because losing it
locks the device out of its own list.

**Widget tests must mount the screen the way a person reaches it.** The
setState-during-build crash survived a full test suite because every test built
`ListScreen` directly, with no home screen listening underneath. Navigate.

## Testing

```bash
pnpm db:up && pnpm test    # API, against real Postgres, not a mock
pnpm app:analyze && pnpm app:test
pnpm typecheck
pnpm dev && pnpm test:e2e  # the browser client, against the running stack
```

- The API suite runs against a real database on purpose: the partial unique
  index, the row-lock serialisation and `COLLATE "C"` ordering are database
  behaviour, and mocking them would only test the mock.
- Flutter tests drive the real `CheckpostApi` against `test/fake_server.dart`
  through `MockClient`. Widget and golden tests must pass
  `realtimeFactory: noRealtime`, or reconnect timers outlive the widget tree.
- Goldens (`apps/app/test/goldens/`) are design regression tests. Regenerate
  with `flutter test --update-goldens` and read the diff as a review.
- The web e2e suite runs on an iPhone viewport in **WebKit**, because that is
  the engine iOS uses and it is where the keyboard and viewport bugs live. It
  needs the real stack up. Every case in it broke at least once during the
  build, which is why each one is written down.
- **Point the e2e suite at a stack of its own, never at production.** Creating
  a list is limited to `RATE_LIMIT_CREATE_MAX` an hour per address, and a suite
  that makes one per case runs that down in a couple of passes. What it looks
  like from the outside is every test failing in `makeList` with no navigation
  and no error, which reads like a hydration race and is not one. A throwaway
  stack is four commands, and the database it stands up must not be the one on
  `POSTGRES_PORT`, which on the server is the real lists:

  ```bash
  POSTGRES_PORT=5436 POSTGRES_PASSWORD=localdev docker compose -p checkpost-e2e up -d db
  DATABASE_URL=postgres://checkpost:localdev@localhost:5436/checkpost \
    API_PORT=4001 API_HOST=127.0.0.1 CORS_ORIGINS=http://localhost:5180 \
    RUN_REAPER=0 RATE_LIMIT_CREATE_MAX=1000 pnpm --filter @checkpost/api dev
  PUBLIC_API_ORIGIN=http://localhost:4001 pnpm --filter @checkpost/web build
  WEB_ORIGIN=http://localhost:5180 API_ORIGIN=http://localhost:4001 pnpm test:e2e
  ```

  `RATE_LIMIT_CREATE_MAX` is raised because the limit catches up with a local
  stack too, on the third run of the suite rather than the second pass against
  production. `CORS_ORIGINS` and `PUBLIC_API_ORIGIN` have to name each other or
  every request dies in a preflight, and the web app has to be **built** with that
  origin rather than handed it at run time: it is baked into the client and
  into the Content Security Policy together, on purpose.

## Conventions

- Conventional Commits. Commit and push each coherent unit.
- Product-facing copy is British-flavoured plain English, no exclamation marks,
  no emoji, no "Oops".
- Comments explain *why*, especially where the code looks odd on purpose
  (the revision bump, the 410-vs-401 split, the deferred settle).
