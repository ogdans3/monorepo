# Swaply

A bartering app. Say what you want, and when the wishes close a loop — directly,
or through a chain of three people — everyone swaps. Invite-only, and we are not
a party to the trade: no shipping, no payment, no cut.

`docs/DESIGN.md` is the product as decided, and it is the authority for
everything here.

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
pnpm db:up          # Postgres in Docker, on 5434 to miss the ports in use
cp .env.example .env
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

Scaffolding. The three skeletons build, start and answer, and that is all they
do — `/health` on the backend, one placeholder page each on web and app. There
is no database schema yet, which is the next thing: `docs/DESIGN.md` has the
model sketched under *Data model*, and its *Next steps* list is the build order.
