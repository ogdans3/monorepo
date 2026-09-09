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
pnpm dev            # backend on 3001, web on 5174
pnpm dev:app        # the Flutter app, separately
```

Checks:

```sh
pnpm typecheck
pnpm test                        # backend
pnpm app:analyze && pnpm app:test
```

## Where this is

Scaffolding plus a schema. The three skeletons build, start and answer —
`/health` on the backend, one placeholder page each on web and app — and the
database is real: 21 tables, a `retained` schema for the sealed record, and a
suite that asserts the invariants against actual Postgres rather than a mock.

The trade engine underneath it is real too: cycle search, the reservation lock,
offer versions, completion snapshots and erasure, with `backend/test/flows/`
covering six flows end to end as an executable specification.

No HTTP endpoints yet beyond health. `docs/DESIGN.md` closes with the build
order.
