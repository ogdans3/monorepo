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
connection is a non-event and why the API scales past one instance without a
message bus.

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
  it off and run `pnpm db:migrate` as a release step.
