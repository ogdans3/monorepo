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

Two files carry placeholders and must be filled in, or app links will silently
fall back to this page forever:

| File | Replace |
|---|---|
| `static/.well-known/assetlinks.json` | `REPLACE_WITH_RELEASE_SIGNING_SHA256` — `keytool -list -v -keystore <release>.jks` |
| `src/lib/apple-app-site-association.json` | `REPLACE_WITH_TEAM_ID` — your Apple Developer Team ID |

**Why the Apple file is not in `static/`.** iOS demands it at exactly
`/.well-known/apple-app-site-association`, extensionless, served as
`application/json`. A static file cannot do both — there is no extension for
the static handler to infer a type from — and SvelteKit's router ignores
directories beginning with a dot, so it cannot be a route either. `src/hooks.ts`
reroutes that path to `src/routes/aasa/+server.ts`, which sets the header
itself. Get the content type wrong and Universal Links silently never work:
no error, links just keep opening this page forever.

Verify after any deploy:

```bash
curl -sI https://checkpost.app/.well-known/apple-app-site-association | grep -i content-type
# content-type: application/json
```

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_APP_STORE_URL` | Shown once the iOS app ships. Empty → honest "not in the stores yet" copy instead of a dead button. |
| `PUBLIC_PLAY_STORE_URL` | Same, for Android. |
| `PORT` | Listen port for the built server (default 3000). |
