# Checkpost

A shared checklist that lives at a link.

Make a list, send the link. Everyone who has it sees the same list and can tick
things off, at the same time, from anywhere. There are no accounts, no invites
and no passwords. The link *is* the access. If a link ends up somewhere it
shouldn't, you replace it and the old one dies.

```
apps/api    Node · Fastify · Drizzle · Postgres · WebSockets
apps/app    Flutter (iOS + Android)
apps/web    SvelteKit landing page, and the list in a browser
packages/   contract (shared Zod schemas + limits)
```

## Get it running

```bash
cp .env.example .env   # the API reads this. Without it, it says so by name
pnpm install
pnpm db:up             # Postgres in Docker on :5433
pnpm dev               # api on :4000, web on :5173

# the app, against your local API
pnpm dev:app           # or: cd apps/app && flutter run
```

A debug build of the app points at the local API already, picking the right
host for the target. See [apps/app/README.md](apps/app/README.md) for physical
devices, which need your machine's LAN address.

```bash
pnpm test           # API suite (needs Postgres up)
pnpm app:test       # Flutter suite
pnpm app:analyze
pnpm typecheck
pnpm test:e2e       # the browser client, against a running stack
```

`pnpm test:e2e` drives a real browser against the real API and database, on an
iPhone viewport in WebKit, which is the engine iOS actually uses. It needs the
stack up and `npx playwright install webkit` once.

The API applies its migrations at boot, so there is no separate setup step.

`DATABASE_URL` is used by the host tools and by the API container alike, so a
hosted database works for both unchanged and `pnpm db:up` is only needed for the
tests. **The test suite refuses to run against anything that is not local, or
whose name does not say "test"**, because it truncates every table between
cases. See `apps/api/test/guard.ts`.
`pnpm dev` builds `packages/contract` first and then watches it, because both
the API and the web app import it and neither can start until it has been
compiled once.

## The three ideas the whole thing hangs on

**1. The link is the credential.** A share token is 32 random bytes, base64url,
giving 43 characters and ~192 bits. The server stores only its SHA-256, so a
database dump yields no working links. There is no list id in any URL. A token
resolves to exactly one list and nothing else is reachable.

**1b. A link carries its own permission.** `read` looks, `write` ticks and adds,
`admin` also makes and revokes links. A fourth kind, `copy`, is not on that
ladder: opening it hands you a private copy of the list with nothing ticked off,
and it cannot read the list it came from. One list has as many live links as you
need, which is what lets you send read to the group and keep admin for yourself.

**2. A replaced link is a hard cut.** Rotation revokes the old token
immediately and disconnects every socket holding it. There is no grace period,
because a grace period would defeat the feature. The old link then answers `410 Gone`,
not `401`, so the app can say *"this link was replaced, ask for the new one"*
instead of the useless *"invalid link"*.

**3. Two people editing at once is the normal case.** Every mutation bumps a
per-list revision as its first statement, which both serialises concurrent
writers on the list row and gives clients a change log to replay after a
reconnect. Item order is a fractional index, so inserting between two items
writes one row and two people inserting at the same spot never collide. The
same algorithm runs on the server and in the Flutter client, byte for byte.

WebSockets carry changes but are only a *hint*: clients also reconcile with
`GET /changes?since=` on connect and on resume, which is why a dropped
connection is a non-event.

## Not spamming the database

Almost every read Checkpost serves is the same read. A token resolves to a link
on every single request. A list is looked at far more often than it changes. And
the answer to "anything new since revision N?" is nearly always "no". So there
is an in-process cache in front of Postgres holding exactly those things, plus
the copy-link preview, in `apps/api/src/services/list-cache.ts`.

It is not a TTL cache hoping for the best. **Every write invalidates it in the
same breath**, which is why entries do not expire at all by default. A clock
knows nothing about whether an entry is still true; the write that makes one
wrong does, and removes it there. What bounds the cache is capacity: it fills to
`CACHE_MAX_ENTRIES` and then the least recently used entry makes room for the
newest, forever. Snapshots have a smaller ceiling of their own
(`CACHE_MAX_SNAPSHOTS`), because one of them is a whole list while every other
entry is a few dozen bytes. `CACHE_TTL_SECONDS` is there for anyone who wants a
belt as well as braces; zero, the default, means no expiry.

Three consequences worth knowing:

- **A dead link is refused from memory.** Replacing or revoking a link rewrites
  its cached answer to `410` rather than dropping it, so the hard cut stays
  immediate *and* an evicted client in a reconnect loop costs no queries at all.
- **A poll that has nothing to fetch costs nothing.** The revision is recorded
  as each write commits, so `GET /list/changes?since=` answers "nothing new"
  without a query. The socket's greeting reads the same number instead of the
  whole list.
- **`last_active_at` is throttled**, to one write per list per
  `TOUCH_INTERVAL_SECONDS`. It used to be a write on every read. It only decides
  whether a list nobody has opened in a year gets reaped, so one stamp per ten
  minutes says exactly the same thing.

The one thing nothing in the process can correct is a change made *to the
database* from outside it: an edit in `psql`, a restore from a backup. With no
expiry, the cache will not notice. Restart the API, which is the whole flush
procedure, because none of this is on disk.

`AdminService` is the one place that writes behind `ListService`'s back, so it
takes the cache as a constructor argument rather than optionally reaching for
it. The hit rate is on `/v1/admin`, next to the other counts.

## The operator console

`GET /v1/admin`, behind HTTP Basic auth, showing counts, every list, and two
actions per list. It exists **only when `ADMIN_USER` and `ADMIN_PASSWORD` are
both set**. There is deliberately no fallback password, because an admin
surface that appears by default is a way to hand somebody your database.

It cannot show you a share URL, and that is not an oversight. Only the SHA-256
of a token ever reaches the database, which is exactly what makes a leaked
backup harmless. **Issue new link** is the only honest way to get a working URL
out of it, and it kills the old one, which the page says before you press it.

## Where things are written down

| | |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Who it is for, the voice, the design principles, accessibility |
| [DESIGN.md](DESIGN.md) | Palette (with measured contrast), type, space, motion |
| [docs/API.md](docs/API.md) | The wire contract, in full |
| [apps/app/README.md](apps/app/README.md) | How the client behaves on a bad network |
| [apps/web/README.md](apps/web/README.md) | The browser client, and what it deliberately does not do |

## Trade-offs worth knowing before you build on this

**Losing the app's local index loses your way back in.** There are no accounts,
so `shared_preferences` on the device is the only record that a list exists.
The list itself survives, since anyone else with the link still has it, but
that device cannot get back in without the link. This is inherent to "no users", and
it is why the share sheet is a first-class screen rather than a setting.

**Nothing has an owner, so nothing is ever tidied up by a person.** A
background reaper is the only bound on the database: change-log rows past
`EVENT_RETENTION_DAYS` (14), lists untouched for `LIST_TTL_DAYS` (365, reset by
any read or write), and links whose list has been gone for 30 days.

**Do not publish the API on 0.0.0.0 behind a proxy.** `trustProxy` is on, so
the API believes `X-Forwarded-For`. If the port is also reachable directly, that
header can be forged and the rate limiter walked straight past. Set `API_BIND`
to the docker bridge gateway on any host with a proxy in front. The default is
`0.0.0.0`, which is right for local development and wrong for a server.

**A token in a URL path is the one leak the app cannot close.** The API takes
tokens in an `Authorization` header only, and scrubs anything token-shaped from
its logs. But `/l/<token>` reaches the web server as a path. If you put that
behind a reverse proxy, turn off access logging for `/l/` or strip the path.

The web client keeps the rest of the property: the list route is client-rendered
only, so the request for list data goes straight from the browser to the API and
the web server never holds a copy of anyone's checklist.

**Realtime fan-out is in-process.** A second API instance costs correctness
nothing. Clients on the other instance find out a beat later instead of
instantly. When "a beat later" stops being good enough, swap `RealtimeHub` for
one backed by Postgres `LISTEN/NOTIFY`. The interface is the seam.

**The read cache is in-process too, and it is not as forgiving.** It is correct
because the writes that would invalidate it happen in the same process. A second
instance breaks that: it would go on serving its own cached answer for a list
somebody edited on the other one — and worse, go on accepting a link the other
instance revoked. With no expiry, "go on" means until it restarts. **Run more
than one API container and you must set `CACHE_ENABLED=0`**, which turns every
cache method into a miss and nothing else. The seam for doing better is the same
one: `ListCache` is one class, and a shared Redis or a `LISTEN/NOTIFY`
invalidation channel would slot in behind it.

## Running it on the AI Central dashboard

The dashboard scans the top level of `~/git` for a compose file, and does not
look inside directories, so this project is reached through a relative symlink
made once on the host:

```bash
ln -s monorepo/checkpost ~/git/checkpost
```

Relative on purpose. The dashboard container mounts the git directory, and an
absolute symlink would point outside that mount and break inside the container.
`.dashboard.yaml` names the front-door service and port.

**One project gets one public hostname**, and Checkpost wants two: the browser
client calls the API cross-origin, so both have to be reachable. The front door
is currently the **API**, which makes `https://checkpost.<host>/v1/admin` the
operator console and lets the Flutter app work. Serving the browser client
publicly needs a second hostname, either by pointing `compose_service` at `web`
and giving the API its own Caddy block, or the other way round. Until that is
decided, the browser client is a local-development thing.

## Before it can ship

- Fill in `apps/web/static/.well-known/assetlinks.json` (release signing
  SHA-256) and `apple-app-site-association` (Team ID), and enable Associated
  Domains on the App ID in Xcode. Until then app links open the list in the
  browser, which is a working fallback rather than a dead end.
- Set `PUBLIC_APP_STORE_URL` / `PUBLIC_PLAY_STORE_URL` once the app is listed.
  While they are empty the site says so plainly instead of showing dead buttons.
- `MIGRATE_ON_BOOT=1` is right for one API container. With more than one, turn
  it off and run `pnpm db:migrate` as a release step, and set `CACHE_ENABLED=0`:
  the read cache is in-process and one instance cannot see the other's writes.
