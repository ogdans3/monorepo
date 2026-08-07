# @checkpost/web

The landing page, and a full read and write client for a list. Opening a share
link in a browser gives you the list itself, not an advert for the app.

```bash
pnpm dev:web         # http://localhost:5173
pnpm --filter @checkpost/web build && pnpm --filter @checkpost/web start
```

It needs the API running and reachable from the browser. `pnpm dev` starts both.

## This reverses an earlier decision

The first version of this app deliberately never touched the API. Opening
`/l/<token>` showed a handoff screen and nothing else, on the grounds that a web
server which renders lists is a web server holding a copy of everyone's
checklist.

That reasoning was about the **server**, and it still holds. What changed is
where the work happens:

- The list route is **client-rendered only** (`export const ssr = false`). The
  request for list data goes straight from the browser to the API. This server
  never sees a list, an item, or an API response. It serves a shell.
- So the privacy property survives, and a person with a link no longer needs to
  install anything to use it.

## The token is still the one leak

A share token arrives here in the URL path, and that is unavoidable for a link
you can send someone. Everything that can be done about it is done:

- `robots.txt` disallows `/l/`, and the page sends `X-Robots-Tag: noindex`
- `/l/*` responses are `Cache-Control: no-store, private`
- `Referrer-Policy: no-referrer` everywhere, so a tap through to a store or an
  external link cannot carry the token with it
- nothing here logs, stores, or forwards the path

If you put this behind a reverse proxy, **turn off access logging for `/l/`** or
strip the path. That is the one leak this app cannot close by itself.

## Phone first

This is a checklist you use standing in a shop, so the phone is the design
target and the desktop is the afterthought.

- **Fixed app shell.** The page never scrolls, only the list does, which is what
  stops iOS rubber-banding the composer off the screen.
- **The composer rides above the keyboard.** `interactive-widget=resizes-content`
  covers Chrome and Android. iOS ignores it, so `src/lib/keyboard.ts` measures
  `visualViewport` and publishes the overlap as `--keyboard` for the layout to
  pad with. Without this the field you are typing into hides behind the thing
  you are typing on, which is the classic mobile web failure.
- **Every input is at least 16px**, or iOS zooms the whole page on focus.
- **48px minimum touch targets**, `-webkit-tap-highlight-color: transparent`,
  and `overscroll-behavior: contain` on the list.
- **Safe-area insets** on the header, the composer and every sheet.
- **Swipe a row to open it**, with `touch-action: pan-y` so a vertical drag
  still scrolls. The gesture only claims the touch once it is clearly
  horizontal. The right-edge chevron does the same job for anyone who does not
  know about the swipe.
- **Sheets are native `<dialog>`**, which brings focus trapping, an inert page
  behind, and Escape without reimplementing any of it.

## How the client is put together

```
src/lib/api.ts                  fetch client, error shapes, per-tab client id
src/lib/realtime.ts             the change feed, with reconnect and backoff
src/lib/list-session.svelte.ts  one open list: optimistic writes and reconcile
```

`ListSession` follows the same rules as the Flutter client, deliberately:

**Optimistic, always.** Every edit lands on local state first. A refusal is
undone and said out loud. Being merely offline keeps the edit, because it is
still true in this tab, and reconcile settles it when the network is back.

**The socket is a hint.** A browser cannot set headers on a WebSocket
handshake, so the token travels as the second entry of
`Sec-WebSocket-Protocol`, which the API accepts for exactly this reason. It is
never put in a query string. Every connect, and every return to a backgrounded
tab, is followed by asking what was missed.

**The client id lives in `sessionStorage`, not `localStorage`.** Two tabs on the
same list need different ids. Sharing one makes a change you made in the other
tab look like your own echo, and it would not be highlighted as somebody
else's.

**No fractional indexing here.** The client never sends a position. An
optimistic new item gets a sort-last sentinel that never leaves the tab, and the
server's answer replaces it. That keeps the ordering algorithm in exactly two
places rather than three.

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_API_ORIGIN` | Where the browser calls. Baked at build time, and named in the Content Security Policy by `svelte.config.js`. If those two ever disagree the browser blocks every request with no obvious cause, so they read one variable from the project root `.env`. |
| `PUBLIC_APP_STORE_URL` | Shown once the iOS app ships. Empty means the page says so plainly instead of showing a dead button. |
| `PUBLIC_PLAY_STORE_URL` | Same, for Android. |
| `PORT` | Listen port for the built server (default 3000). |

## Before launch

Two files carry placeholders and must be filled in, or app links will silently
fall back to the browser forever:

| File | Replace |
|---|---|
| `static/.well-known/assetlinks.json` | `REPLACE_WITH_RELEASE_SIGNING_SHA256`, from `keytool -list -v -keystore <release>.jks` |
| `src/lib/apple-app-site-association.json` | `REPLACE_WITH_TEAM_ID`, your Apple Developer Team ID |

**Why the Apple file is not in `static/`.** iOS demands it at exactly
`/.well-known/apple-app-site-association`, extensionless, served as
`application/json`. A static file cannot do both, because there is no extension
for the static handler to infer a type from, and SvelteKit's router ignores
directories beginning with a dot, so it cannot be a route either. `src/hooks.ts`
reroutes that path to `src/routes/aasa/+server.ts`, which sets the header
itself. Get the content type wrong and Universal Links silently never work: no
error, links just keep opening this page forever.

Verify after any deploy:

```bash
curl -sI https://checkpost.app/.well-known/apple-app-site-association | grep -i content-type
# content-type: application/json
```
