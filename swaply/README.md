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
