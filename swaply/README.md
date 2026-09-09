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
pnpm db:seed        # three people who want each other's things, and two invitation links
pnpm dev            # backend on 3001, web on 5174
pnpm dev:app        # the Flutter app, separately
```

The seed prints two links, because a closed app needs a way in. `pnpm invite`
mints another at any time, and `pnpm invite ola@epost.no` mints it on somebody's
behalf.

On an Android emulator the host is `10.0.2.2`, not `localhost`:

```sh
cd app && flutter run --dart-define=API_BASE=http://10.0.2.2:3001
```

After seeding, sign in as `ola@epost.no`, `kari@epost.no` or `per@epost.no` with
the password `swaply123`.

Open one of the seeded links at `http://localhost:5174/i/<token>` to see the page
a shared listing gets, and `?invitasjon=<token>` on the app to see what it opens.
`INVITE_ONLY=0` in development, so an account can be made without a link; a
launch sets it to `1`.

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
swaply-web.<host>    the public web: the landing page and every shared link
```

`<host>` is `freelunch.no` on the machine this runs on, and any subdomain of it
already resolves without a DNS change.

Three hostnames because the dashboard gives a project one subdomain, and this
project deploys three things a browser talks to. The two extra ones are Caddy
site blocks in the dashboard's own tree — `caddy/sites/swaply-api.caddy` pointing
at `host.docker.internal:4001` and `caddy/sites/swaply-web.caddy` at
`host.docker.internal:4002` — which is why both services publish a host port
instead of only exposing one. A published port survives the container being
recreated on the next deploy; a container IP does not.

Nothing served this way is behind the dashboard's login: a project subdomain is
public, and each project does its own auth. That is what makes an invitation link
work for somebody who has never heard of us, and it is why the API has its own
entrance rather than sitting on a dashboard subdomain.

If the public page should own the short name instead — it is the one strangers
see — swap `compose_service` in `.dashboard.yaml` to `web` and give the app the
extra site block rather than the web. That is a deployment decision, not a code
one.

The API origin is **compiled into the app bundle** — there is no server in the
app image to read an environment variable — so a deploy has to set it:

```sh
PUBLIC_API_ORIGIN=https://swaply-api.<host>   # compiled into the app bundle
CORS_ORIGINS=https://swaply.<host>
PUBLIC_WEB_ORIGIN=https://swaply-web.<host>   # what an invitation link says
PUBLIC_APP_ORIGIN=https://swaply.<host>       # where «Åpne i Swaply» goes
```

`MEDIA_ORIGIN` is the API's own public hostname, because it is what a phone and
a chat client's preview fetch a photograph from. The photographs themselves live
in the `swaply-media` volume, which is the one thing here that cannot be rebuilt
from the repository — `docker compose down -v` would take other people's things
with it.

`PUBLIC_WEB_ORIGIN` is read by the **API**, not the web: the server writes the
whole link and the sentence around it, so no client has to assemble one and get
the path slightly wrong. The web service reaches the API over the container
network (`API_ORIGIN=http://api:3000`) and never from the browser, so the
invitation pages are outside the CORS story entirely.

`PUBLIC_API_ORIGIN` is the only one baked into a bundle, so changing it means
rebuilding the app image rather than restarting it. The API and the web server
both read theirs at boot — the web deliberately uses SvelteKit's *dynamic*
environment, so pointing it somewhere else is a restart.

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
  111 tests against real Postgres, 51 of them walking a whole journey over HTTP.
- `app/` — every screen from `docs/round-5-screens.md`, plus the share sheet, the
  invitation screen, the photo picker and looking around without an account. 65
  widget tests
  driving the real API client against a fake server.
- `web/` — the landing page and the page behind every invitation link, server
  rendered with Open Graph tags so a shared listing looks like something in a
  chat. The font is served from our own origin rather than a CDN, for the same
  reason the hosting is in the EEA.

- Photographs are uploaded from the phone and kept in a volume next to the
  database. The OVH bucket is still where they belong — a volume does not survive
  the machine — but a listing has a picture today, and the move is one file and a
  migration.

Two things say plainly what is missing rather than pretending: sign-in with
Google, Facebook or Apple needs provider agreements, and a link opens the app in
a browser because universal links need a registered domain and a bundle id. Both
are one screen away when the accounts exist.

The one gap that is nobody's account but ours: **erasure has an engine and no
door**. `anonymiseUser` is written and tested, and nothing calls it — settings
has no «Slett kontoen». It is item 10 in `docs/DESIGN.md`.
