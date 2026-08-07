# @checkpost/web

The public face: a one-screen landing page, and the handoff page a share link
lands on when it's opened in a browser instead of the app.

```bash
pnpm dev:web         # http://localhost:5173
pnpm --filter @checkpost/web build && pnpm --filter @checkpost/web start
```

## What it deliberately does not do

**It never talks to the API.** Opening `/l/<token>` in a browser shows a
handoff screen, not the list. Lists belong to the app; a web server that
renders them is a web server that holds a copy of everyone's checklist, and
this one holds nothing.

That means the only place a token appears here is the URL path — so:

- `robots.txt` disallows `/l/`, and the page sends `X-Robots-Tag: noindex`;
- `/l/*` responses are `Cache-Control: no-store, private`;
- `Referrer-Policy: no-referrer` everywhere, so a tap through to the App Store
  cannot carry the token with it;
- nothing on the page logs, stores, or forwards the path.

If you put this behind a reverse proxy, **turn off access logging for `/l/`**
or strip the path. That is the one leak this app cannot close by itself.

## Before launch

Two files under `static/.well-known/` carry placeholders and must be filled in
or app links will silently fall back to this page forever:

| File | Replace |
|---|---|
| `assetlinks.json` | `REPLACE_WITH_RELEASE_SIGNING_SHA256` — `keytool -list -v -keystore <release>.jks` |
| `apple-app-site-association` | `REPLACE_WITH_TEAM_ID` — your Apple Developer Team ID |

`apple-app-site-association` must be served as `application/json` with no
extension; `adapter-node` does this for static files already.

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_APP_STORE_URL` | Shown once the iOS app ships. Empty → honest "not in the stores yet" copy instead of a dead button. |
| `PUBLIC_PLAY_STORE_URL` | Same, for Android. |
| `PORT` | Listen port for the built server (default 3000). |
