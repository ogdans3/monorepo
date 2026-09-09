# Swaply

A bartering app. Say what you want, and when the wishes close a loop — directly,
or through a chain of three people — everyone swaps. Invite-only, and we are not
a party to the trade: no shipping, no payment, no cut.

`docs/DESIGN.md` is the product as decided and `docs/ARCHITECTURE.md` is how it
stands up — hosting, matching, the trade model and the erasure model. Between
them they are the authority for everything here.

## Layout

```
docs/       DESIGN.md, the round briefs, meeting notes
backend/    Fastify + Postgres            (@swaply/backend)
web/        SvelteKit: landing, invites, public item pages  (@swaply/web)
app/        Flutter, iOS + Android
shared/     Zod schemas and the constants both TS sides agree on  (@swaply/shared)
```

Each of `backend`, `web` and `app` deploys on its own. `shared` is a library and
deploys with whoever imports it — which is the two TypeScript sides only. **The
Flutter app cannot import from `shared/`**: it is Dart, so anything that has to
reach the app needs a second home under `app/lib/`, and the two have to be
changed together. Right now that applies to the palette; it will apply to the
API types the moment there are any.

The pnpm workspace covers `backend`, `web` and `shared`. The Flutter app sits
outside it and uses `flutter pub`.

## Running it

```sh
pnpm install
cp .env.example .env
pnpm db:up          # Postgres in Docker, on 5434 to miss the ports in use
pnpm db:migrate
pnpm db:test:setup  # the separate database the tests are allowed to wipe
pnpm db:seed        # three people who want each other's things
pnpm dev            # backend on 3001, web on 5174
pnpm dev:app        # the Flutter app, separately
```

On an Android emulator the host is `10.0.2.2`, not `localhost`:

```sh
cd app && flutter run --dart-define=API_BASE=http://10.0.2.2:3001
```

After seeding, sign in as `ola@epost.no`, `kari@epost.no` or `per@epost.no` with
the password `swaply123`.

Checks:

```sh
pnpm typecheck
pnpm test                        # backend
pnpm app:analyze && pnpm app:test
```

## Deploying

Through the master dashboard, like every other project here. Never by hand:
`docker compose up` recreates the front-door container and drops it off the
`aicentral` network, which takes the site down until the dashboard reattaches
it.

```
swaply.<host>        the app, in a browser — all forty-five screens
swaply-api.<host>    the API, through its own Caddy site block
```

Two hostnames because the app is a browser client calling the API
cross-origin, and the dashboard gives a project one subdomain. The site block
lives in `master-dashboard/caddy/sites/swaply-api.caddy` and points at
`host.docker.internal:4001`, the port the `api` service publishes.

The API origin is **compiled into the app bundle** — there is no server in the
app image to read an environment variable — so a deploy has to set it:

```sh
PUBLIC_API_ORIGIN=https://swaply-api.<host>
CORS_ORIGINS=https://swaply.<host>
```

Change either one and the app has to be rebuilt, not just restarted.

`MIGRATE_ON_BOOT` defaults to `1` in the compose file: the image carries the
SQL that matches it and nobody is going to run a migration by hand against a
container. It races if you ever run more than one API replica.

`DATABASE_URL` in `.env` is for host tooling — the dev server, migrations, the
seed. The container gets `API_DATABASE_URL`, and falls back to the database next
door. They are separate on purpose: Compose substitutes from `.env`, and
`localhost` inside a container is the container.

**The tests get a database of their own**, `TEST_DATABASE_URL`, created by
`pnpm db:test:setup` and run automatically by `pnpm test`. They truncate every
table they can reach, and on this host `DATABASE_URL` points at a Postgres that
also serves the deployment — so the guard refuses any database whose name does
not say test. It learned that the hard way.

## Where this is

**The app and the API are built, and every screen in round 5 is in them.**

- `backend/` — 22 tables including the `retained` schema for the sealed record,
  the trade engine (cycle search, the reservation lock, offer versions,
  completion snapshots, erasure) and the endpoints all forty-five screens need.
  81 tests against real Postgres, 29 of them walking the whole journey over HTTP.
- `app/` — every screen from `docs/round-5-screens.md`, with 55 widget tests
  driving the real API client against a fake server.
- `web/` — still a placeholder. The landing page, invite handling and the public
  item page are the next surface.

Two things say plainly what is missing rather than pretending: sign-in with
Google, Facebook or Apple needs provider agreements, and photo upload needs the
OVH bucket. Both are one screen away when the accounts exist.
