# Podium

A presentation tool where the room votes back. Three parts, one server:

- **The desk**, `/admin`: build presentations and run them. A slide is a 16:9
  canvas with text, pictures, video and the QR code placed on it. A question
  slide has as many answers as you like, each one placed on the slide where
  you want its count to appear. Each answer has a colour and a mark, a letter
  or a number. Every presentation opens with the way in, its title and the QR
  code big. Every slide after it carries the code small in its corner, which
  you can delete from any slide.
- **The display**, `/vis/<code>`: the slide on screen and nothing else. Every
  vote chimes, and its count rolls up in the answer's own place on the slide.
  Signed in, you step through it with the arrow keys or a clicker.
- **The ballot**, `/stem/<code>`: what a phone opens from the QR code. It
  follows the presentation. While a question is on screen, its answers are
  tiles in their colours and marks, the same as on the slide. One tap is one
  vote, and each phone gets one. Between questions the page is empty, and the
  next question arrives by itself. `/` takes the five-letter code for anyone
  who would rather type.

Svelte (SvelteKit, built static) for every screen, Go for the API, Postgres,
and a local folder for uploads. In production that folder is a Docker volume.
The Go server serves the API, the uploads and the built app on one port, so
there is one container to run and no CORS.

## Run it

```sh
cp .env.example .env          # set ADMIN_PASSWORD, 8 characters or more
docker compose up -d --build
```

Podium is on <http://127.0.0.1:4120>. Sign in at `/admin` with the password.

Phones must reach the address the display was opened on, because the QR code
points there. Behind an HTTPS proxy that is your domain. On a local network,
publish the port with `APP_BIND=0.0.0.0` and open the display at the machine's
LAN address.

## Develop

You need Go 1.27, Node 22 with pnpm 10, and Docker.

```sh
docker compose up -d db       # Postgres on 127.0.0.1:5452

cd backend
DATABASE_URL=postgres://podium:podium@127.0.0.1:5452/podium \
ADMIN_PASSWORD=utvikling \
go run ./cmd/podium           # the API on :8080

cd web
pnpm install
pnpm dev                      # the app on http://127.0.0.1:5180, /api and /media proxied to :8080
```

Set `PODIUM_API` to point Vite at a Go server on another address.

## Test

```sh
cd backend && go test ./...   # the API over HTTP against Postgres; makes podium_test itself
cd web && pnpm test           # the pure parts: geometry, the chime's cadence, QR, formats
cd web && pnpm check          # types
```

The end-to-end test runs the whole loop against a running Podium. A
presenter builds a question, starts it, and a phone votes. The display counts
the vote, and the phone follows the presenter to the next slide.

```sh
docker compose up -d --build
cd web && PODIUM_URL=http://127.0.0.1:4120 PODIUM_PASSWORD=<the password> pnpm e2e
```

It cleans up after itself. Playwright needs a Chromium; on a machine without
one, run `pnpm exec playwright install chromium` once.

## Configure

The server reads its environment:

| Variable         | Default    | What it is                                                   |
| ---------------- | ---------- | ------------------------------------------------------------ |
| `DATABASE_URL`   | (required) | Postgres. Migrations run at start-up, under a lock.          |
| `ADMIN_PASSWORD` | (required) | The admin password, 8 characters or more. Changing it signs everyone out. |
| `PORT`           | `8080`     | Where it listens.                                            |
| `MEDIA_DIR`      | `./media`  | Where uploads are kept.                                      |
| `MAX_UPLOAD_MB`  | `500`      | Uploads over this are refused.                               |

Compose reads `.env` for the same settings, plus `POSTGRES_PASSWORD`,
`APP_BIND` and `APP_PORT`. See `.env.example`.

## Deploy

- Run **one** instance. Live updates go through an in-memory hub, so a second
  server would not see the first one's votes.
- Put an HTTPS proxy in front that passes `X-Forwarded-Proto: https`, so the
  cookies are marked `Secure`. The display and the phones hold an event stream
  for the whole talk, so the proxy must not buffer it. Podium sends
  `X-Accel-Buffering: no` for nginx. A proxy that ends long responses is fine.
  The browser is back within a second, and a display or editor is sent the
  votes it missed.
- Behind Cloudflare, uploads over 100 MB are refused before they reach Podium.
  Set `MAX_UPLOAD_MB` under that, and the editor will say so before an upload
  starts.
- Two volumes hold everything: `podium-db` and `podium-media`. Back up both.
  Replacing the container keeps them; `docker compose down -v` deletes them.

## The vote sound

The brief asked for the sound from Dr Kawashima's Brain Training. That sound
belongs to Nintendo and is not shipped. Podium plays its own chime instead:
a short bell, synthesised in the browser (`web/src/lib/chime.ts`). Votes
that land together play as a quick rising run. A presentation can use an
uploaded sound instead, under *Presentasjonen → Lyd for hver stemme* in the
editor.

Browsers only play sound after a click or a key press on the page. The display
says so until one of them has happened.
