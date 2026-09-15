# good or bad choice

Two buttons. Green was a good call, red was a bad one. Tapping records the
choice and the moment, and that is the whole input surface of the product.

Once in a while you pick a stretch of time and watch every tap in it rain down
and settle into a grid. Mostly green and you can see that in half a second,
without reading a number.

`PRODUCT.md` and `DESIGN.md` are the contract, not decoration. `CLAUDE.md` is
for agents working here.

## Shape

```
app/    Flutter — the product, built for the browser and for iOS and Android
api/    Fastify + Postgres — the optional second home for the taps
```

Two containers: `db`, and one `web` that serves the built Flutter app *and* the
API from the same origin. That is deliberate — there is no CORS to configure, no
second hostname to arrange in the proxy, and no way for the client and the
server to be deployed at different versions.

**The app works with no server at all.** Every tap is written to the device
first and is already true before anything is sent. An account is a backup, so
the history survives a lost phone and shows up on another one. Nothing in the
interface waits on the network.

## Running it

```bash
cp .env.example .env
docker compose up -d db            # Postgres on 5435

cd api && npm install
npm run migrate                    # once
npm run dev                        # API on 4003

cd ../app && flutter pub get
flutter run -d chrome              # or a device
```

The Flutter app calls the same origin it was served from. Running
`flutter run -d chrome` serves it on a different port from the API, so pass the
API's origin in development:

```bash
flutter run -d chrome --dart-define=API_BASE=http://localhost:4003
```

To see it the way it ships — one origin, no define:

```bash
cd app && flutter build web --release
cp -r build/web ../api/public
cd ../api && npm run build && DATABASE_URL=... node dist/server.js
```

## Testing

```bash
cd api && npm test                 # against a real Postgres, not a mock
cd app && flutter analyze && flutter test
```

The API suite runs against a real database on purpose: the unique index on
`lower(username)`, the `on conflict do nothing` upsert and the cascade from a
deleted account are database behaviour, and mocking them would only test the
mock. It refuses to run against anything that is not local and does not have
"test" in its name — see `api/test/guard.ts`.

## Deploying

Through the dashboard, which reads `.dashboard.yaml` and brings up
`docker-compose.yml`. The `web` service is the front door and needs no published
port; the database binds to loopback.

`MIGRATE_ON_BOOT=1` in the container, because the image carries the SQL that
matches it and nobody is going to run a migration by hand against a container
that is replaced on every deploy.

## Where the data lives

In the `db` container, on the `gobc-db` volume, on the server. It is the only
copy of anything anybody has signed in to back up — the devices have their own,
which is the point, but a device is not a backup of the server and the server is
not a backup of a device.

Nothing here is shared with any other project in this repository. Its own
database, its own container, its own port, its own everything. See the
repository README for why.
