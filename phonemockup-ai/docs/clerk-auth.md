# Clerk authentication

PhoneMockup keeps SvelteKit/Svelte 5 and Express 5. The selected Clerk application is
`app_3KpbkjJ8Th3Wsj3wLa3LWI4JRgP`; the Next.js choice in the Dashboard does not change
this project's framework. No replacement application should be created.

## Current implementation

- `client/src/lib/auth/clerk.svelte.ts` loads the official JavaScript SDK and UI
  lazily in the browser. The shadcn theme uses the studio's warm colors and Archivo.
- `/sign-in` and `/sign-up` mount Clerk's sign-in and sign-up components. The account
  button mounts Clerk's profile and sign-out controls after a session is established.
- Landing navigation, the studio toolbar, and the project list expose account controls.
- Missing configuration or a Clerk load error leaves local editing/export available.
  It displays an honest unavailable state on the account pages, with retry for errors.
- Authentication does **not** enable cloud storage, payments, or gate the editor.
  Projects and media continue to live in localStorage and IndexedDB on this browser.
- The separately deployed Express API uses `@clerk/express` to verify **session bearer
  tokens**. It does not accept ambient cookies, machine tokens, or the retired WorkOS
  session. `APP_URL` determines the permitted token `azp` origin.
- `authenticatedFetch('/api/...')` obtains a fresh Clerk session token and adds the
  Authorization header. It rejects non-API targets and redirects. Use it when connecting
  cloud persistence; do not send user IDs to establish identity.

## Configuration and handoff

On 17 October 2026, the CLI login completed and this repository was linked to the
selected application. Development credentials were pulled into the ignored
`client/.env.local` through `clerk env pull`, without reading or printing that file.
The real sign-in and sign-up forms load in desktop Chromium and iPhone WebKit.
No test users were created, no completed account sessions were tested, and no
database migration was applied.

The project-root `Dockerfile` is specifically the dashboard's development preview
at `phonemockup-ai.freelunch.no`. It supplies this app's **public development key**
as an overridable build argument/runtime environment default. No secret key is
included. `.dockerignore` excludes environment files. The separate
`client/Dockerfile` used by the production stack has no development-key default.

`clerk deploy status` currently reports `not_started`: the selected app has no
production instance, domain, or production OAuth configuration yet. The preview's
development login must not be treated as a production rollout. Clerk's production
wizard requires a human terminal; run `npx -y clerk@latest deploy --mode human`
from the linked project when ready, then verify with `clerk deploy status`.

To repeat setup on another machine:

1. Sign into the CLI **in your host terminal**:
   ```sh
   npx -y clerk@latest auth login
   ```
2. The SDKs are now installed: **do not run init again**. In `client/`, link to the
   already-selected application and pull development keys:
   ```sh
   npx -y clerk@latest link --app app_3KpbkjJ8Th3Wsj3wLa3LWI4JRgP
   npx -y clerk@latest env pull --app app_3KpbkjJ8Th3Wsj3wLa3LWI4JRgP --instance dev --file .env.local
   npx -y clerk@latest doctor
   ```
   If the CLI cannot detect SvelteKit's key name, the app also accepts the JavaScript
   quickstart's `VITE_CLERK_PUBLISHABLE_KEY`. Do not print/read existing environment
   files in agent output or commit their contents.
3. Run the client with Node 22 and `npm run dev`. Use the selected development
   instance's sign-up flow yourself. Ask separately before creating test users in it.
4. For production, complete the selected app's Clerk production domain/DNS/provider
   configuration and inject its **production publishable key** into the client
   container as `CLERK_PUBLISHABLE_KEY`. `PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `VITE_CLERK_PUBLISHABLE_KEY` are also supported. Configuration is read at runtime:
   the Docker image does not need keys at build time. Only this public key is returned
   by `+layout.server.ts`. The client container does not need a secret key.
5. For the Express API, set `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `APP_URL`
   (the exact browser origin, e.g. `https://phonemockup.app`). Keep the existing
   database, B2, and Secret Manager configuration. Never expose the secret key through
   a public/Vite prefix. The API remains a separate service; the existing client-only
   Docker deployment does not start it or route `/api` by itself.

Use one Clerk instance consistently for client and API. Development and production
have separate user stores. A development login is not a production migration test.

## Existing-user migration and rollout

Do this against the actual target deployment before switching its API traffic:

1. Inventory the old provider's users and the database's `user` IDs/project owners.
   Back up the database and retain the old deployment for rollback. Repository code
   alone cannot establish whether there are existing live users.
2. Apply the additive, rerunnable `server/migrations/20261017_clerk_identity.sql`.
   It adds a unique mapping table without rewriting users or project owners.
3. Import existing accounts with Clerk's Backend API `createUser`, setting
   `externalId` to their exact existing application/WorkOS user ID. Preserve verified
   identifiers and import password digests only with Clerk-supported hash formats.
   If compatible hashes cannot be exported, use a planned password-reset or
   passwordless sign-in flow; do not invent or silently replace passwords.
4. Configure the same OAuth providers in Clerk, including production callback URLs
   and provider credentials. Check linked-provider/verified-email continuity with
   representative existing accounts before cutover. Do not assume that a password
   import or matching email automatically migrates every OAuth identity or token.
5. On the first verified API call, the server fetches the Clerk user through the
   authenticated Backend API. Its `externalId` resolves to the existing local user.
   Missing external IDs for imported accounts must be fixed **before** first API use.
   New accounts without one get a distinct `clerk:<id>` local ID. An unknown external
   ID or conflicting mapping fails closed. Later profile changes do not remap owners.
   Never use browser `unsafeMetadata`, request parameters, or an unverified email
   address for this mapping.
6. Test migrated account read/update/upload, cross-user rejection, sign-out, expired
   tokens, mobile redirects, and a new account. Switch the client/API to the same
   production instance together. Existing WorkOS sessions require a fresh sign-in;
   they cannot be converted into Clerk sessions. Old login URLs redirect to `/sign-in`.
7. Monitor rejected auth and identity-mapping errors. Keep old identities and the
   additive table during rollback; do not drop old users or rewrite ownership.

The app currently stores projects only in the browser. Signing into a different
account does not move, upload, or isolate those local files; the UI states this.

## Verification

```sh
# In server/
npm run typecheck
npm run build
npm test

# In client/
npm run check
npm run build
# Run against a local client with no Clerk keys for the unavailable-state cases:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5197 npx playwright test --config=playwright.auth.config.ts
```

The server suite exercises the actual Clerk signature verifier with locally generated
RSA keys and actual Express project routes, with an in-memory data fixture. It covers
expired/forged/malformed/wrong-origin/pending tokens, old-cookie rejection, ownership,
and identity imports. It does not contact Clerk or modify a database.

The browser suite covers account navigation, same-origin return paths, missing-config
fallback, and existing editor interactions in Chromium and iPhone-configured WebKit.
It is browser emulation, not a physical iPhone test. Real sign-up/OAuth/profile flows
still require connection to the selected Clerk instance and an authorized test account.

To check the real Clerk forms and sign-in/sign-up navigation without submitting
credentials or creating users, start a configured client and run:

```sh
CLERK_LIVE_TEST=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5200 npx playwright test --config=playwright.auth.config.ts auth-live.spec.ts
```

For the built client, `HOST=127.0.0.1 PORT=5200 node --env-file=.env.local server.mjs`
loads the CLI-pulled configuration without displaying its contents. Use Node 22.

The npm lockfile remains the production source of truth. `bun.lock` was regenerated
from that lock with current Bun, replacing the obsolete binary lockfile; use Bun 1.2+
for local Bun installs.

References: [Clerk JavaScript](https://clerk.com/docs/js-frontend/getting-started/quickstart),
[Express](https://clerk.com/docs/expressjs/getting-started/quickstart),
[migration](https://clerk.com/docs/guides/development/migrating/overview),
[CLI](https://clerk.com/docs/cli).

To repeat the actual SDK network-failure check without a Clerk account, start a
second built client with a synthetic publishable key (this key has no real instance):

```sh
# In client/, terminal 1
CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmstZml4dHVyZS5jbGVyay5hY2NvdW50cy5kZXYk PORT=5199 npm start
# In client/, terminal 2
CLERK_FAILURE_TEST_URL=http://127.0.0.1:5199 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5199 npx playwright test --config=playwright.auth.config.ts auth-network.spec.ts
```

The fixture intercepts all requests to its synthetic Frontend API, verifies that
SDK initialization reaches the API, shows the error state, retries successfully,
and allows navigation to local projects. It does not simulate a successful login.

Verified on 17 October 2026: client typecheck (zero errors; three pre-existing
warnings), client production build, server typecheck/build, built API module loading,
14 backend tests, 42 production browser account/editor cases, and two production SDK
network-recovery cases all passed. No physical-device or live-account login claim is
made by these checks.

After connecting the selected instance, all six opt-in live-form checks passed
in Chromium and iPhone WebKit, including sign-in/sign-up links retaining the
requested editor destination. These checks do not create accounts or verify a
completed email/Google sign-in session.
