# PhoneMockup.app

Free phone mockup generator. Browser-based 3D scene editor that produces images/videos of phones with custom screen content.

Production: https://phonemockup.app/

## Layout

```
phonemockup-ai/
├── client/      SvelteKit app (Svelte 5, adapter-node, Tailwind v4)
├── server/      Express 5 API (TypeScript, Drizzle + Neon Postgres)
├── mcp/         Local MCP server that renders mockups headlessly
├── docs/        phone-model-guide.md: how to build and add a phone model
└── deploy/      Docker Swarm + Traefik production stack
```

The client is the user-facing app; everything that *makes the mockup* (3D rendering, encoding, export) runs in the browser. The server only handles auth, project save/load, and file uploads to Backblaze B2.

## Client (`client/`)

SvelteKit with `@sveltejs/adapter-node`, Svelte 5 runes (`$state`, `$props`), Tailwind v4 via `@tailwindcss/vite`, shadcn-svelte UI in `src/lib/components/ui/`.

- `src/routes/+page.svelte` — marketing landing page
- `src/routes/platform/animation/[id]/` — the editor (chooses an animation by id)
- `src/routes/platform/project/` — saved projects list / detail
- `src/lib/components/mock-video/` — the editor proper
  - `canvas/` — `three.js` 3D scene (`ThreeScene.svelte`) + the `<Canvas>` wrapper
  - `recording/` — MP4/WebM/GIF encoders, bulk export queue, `VideoRecorder`
  - `sidebar/` — model picker, transform controls, scene settings, export panel
  - `timeline/` — keyframe timeline + playhead
  - `topbar/` — top bar
- `src/lib/animations/presets/*.json` — the eight active motion presets. Top-level `animations/*.json` remain available by ID for old links and projects, but are not listed in the catalogue. See `docs/motion-2026.md` for preview generation.
- `src/lib/stores/*.svelte.ts` — runes-based stores for `project`, `video`, `tracks`, `transform`, `animation`, `settings`
- `src/lib/repo/` — `localstorage` (project JSON), `media-store` (a saved project's screen media, in IndexedDB), `uploadFile` (image/video detection)
- `src/lib/models/` — 3D phone models (loaded via three.js). A new one is
  built to `docs/phone-model-guide.md`, the brief for a modeller or an AI in
  Blender: names, orientation, export settings, checks and the catalogue entry.
  Its Blender snippets were run in Blender 4.5 and 5.2, and a phone exported
  with them was loaded in the editor. Keep it true when the loader changes.
- `src/lib/render/` — **framework-agnostic scene**. `scene-renderer.ts` owns the
  renderer, lighting, environment, GLB loading, media texture linking and the
  transform math; `ThreeScene.svelte` is a thin Svelte shell over it (DOM
  sizing, pointer controls, store wiring). `headless-harness.ts` is the second
  consumer, bundled by `vite.harness.config.ts` for the MCP server.

Dev: `bun run dev` → Vite at `http://localhost:5173`. Vite proxies `/api/*` → `http://localhost:3000` (the Express server). In production there is no Vite proxy — `/api` traffic is routed by Traefik to a separately-deployed server stack.

Analytics: PostHog, initialized in `src/routes/+layout.ts`, proxied through `e.phonemockup.app`.

## Server (`server/`)

Express 5 + TypeScript, run with `bun --watch` in dev. Bootstrap order matters:

1. `secret-manager.ts` pulls `B2_API_KEY` and `NEON_DATABASE_URL` from **Google Secret Manager** (project `deployment-487315`) using a service-account JSON keyfile mounted as `./deployment-487315-74d4c09beec7.json`.
2. **Only after** secrets are loaded does `index.ts` dynamically `import("./routes/api.js")` so route modules see populated env vars.

Routes (`/api/*`):

- `auth.ts` — WorkOS AuthKit: `/login`, `/wos-callback`, `/logout`. Sealed session in `wos-session` cookie. The callback and sign-out URLs come from `WORKOS_REDIRECT_URI` and `APP_URL` (`config.ts`), defaulting to localhost; after sign-in it only redirects to a path on this site.
- `project.ts` — list/get/create/update projects, owned by WorkOS user id. `withAuth` middleware (`middleware/auth.ts`) loads + refreshes the sealed session, puts the user on `res.locals.user`, and answers 401 (not a redirect) without one. The file routes mount behind `withAuth` plus an owner check.
- `file.ts` — Backblaze B2 upload. Flow: client `POST /api/project` with `fileCount` → server inserts N placeholder rows in `file` table, returns `fileKeys` → client `POST /api/project/:id/file` with `fileKey` + multipart → server authorizes against B2, gets upload URL, uploads, fills in the row.
- `health.ts`, `user.ts`

DB: Drizzle — `db/client.ts` + `db/queries.ts` + `db/file-queries.ts`, schema in `db/schema.ts` (`user`, `project`, `file`). The raw-SQL layer that used to sit beside it (`database.ts`) was removed: its project listing never ran and nothing else needed it.

Not deployed: phonemockup.app answers `/api/*` with the client's 404 and the client makes no API calls. There is no `tsconfig.json`, so `npm run build`/`typecheck` don't work; `bun` runs the TypeScript directly.

## MCP (`mcp/`)

Local MCP server exposing the mockup renderer to AI agents: `list_phone_models`,
`list_animations`, `render_mockup_image`, `render_mockup_video`. Node + the MCP
SDK over stdio, driving headless Chromium through Playwright and encoding with
`ffmpeg-static`.

There is **no server of any kind**, not even a local one. The render page lives
at the synthetic origin `https://phonemockup.local` and every request against it
— HTML, the harness bundle, `.glb` models, screen content — is fulfilled from
disk by a Playwright route handler. Anything off that origin is aborted.

`npm run build` builds the harness (`vite.harness.config.ts` in `client/`) and
then the server. See `mcp/README.md` for tools, env vars and measured
per-frame cost.

## Deploy (`deploy/`)

Docker Swarm + Traefik. `docker-compose.yml` here runs:
- `phonemockup_client` — built from `../client/`, routed at `phonemockup.app`
- `posthog_proxy` — nginx proxying `e.phonemockup.app` to PostHog

The **server is not in this compose file** — it's deployed as a separate swarm service (the `deploy/README.md` references a `smule_server` stack from a previous project, which is somewhat stale). Migrations and DB init are run as one-shot swarm services from `server/DockerfileMigrate` / `DockerfileInitialise` (those Dockerfiles aren't in the repo currently).

`update-stack.sh` is the deploy entry point. The Traefik labels rely on a pre-existing static 15-year cert (no certresolver).

## Dashboard test version (root)

The project-local `Dockerfile` + `.dashboard.yaml` build and run **only the client** as a single container — same shape as the production compose. Use this PhoneMockup folder as the Docker build context. The Express server is not started here; routes that need the API (project save, file upload, login) will 404, but the marketing page and the in-browser editor work fully.

To run a real end-to-end stack inside the dashboard, swap the root Dockerfile for a `docker-compose.yml` and provide secrets for WorkOS / Neon / B2 / Google Secret Manager.

## Conventions and gotchas

- **Secrets bootstrap is async.** Routes are dynamically imported *after* `secretManager.initialize()`. If you add a route that reads `process.env.X` at module top-level, import it the same way.
- **WorkOS URLs are env-driven** (`WORKOS_REDIRECT_URI`, `APP_URL`). A real deployment must set both; the defaults are localhost.
- **Data access is Drizzle only.** Don't bring back raw template-string SQL beside it.
- **Svelte 5 runes only.** Stores are `.svelte.ts` files using `$state`, not the legacy `writable()` API. (A few files still import `get` from `svelte/store` against a runes-style controller — fine, but don't introduce new `writable`-based stores.)
- **Editor state is local-first.** The browser drives the entire mockup pipeline (three.js render → MediaRecorder/WebCodecs encoder → download). The server is only persistence.
- **Editor state is module-level singletons** (`project`, the video controller, selection and transform stores). A route that shows the editor must say which project it is: `/platform/animation/[id]` calls `startNewProject(animationGroup)` and `/platform/project/[id]` calls `openSavedProject()` (`stores/session.svelte.ts`), through `MockVideo`'s `prepare` prop. Without that, the last project's tracks, files and selection carry over.
- **Saved projects are two stores.** The project JSON goes to localStorage; the screen media (a File, which JSON can't hold) goes to IndexedDB under the same id (`repo/media-store.ts`). Deleting a project deletes both.
- **The editor canvas draws on demand.** While paused, `ThreeScene`'s loop poses the phone every frame but only renders when `SceneRenderer.needsRender` says something changed. Anything new that changes a frame must set `dirty` in `scene-renderer.ts`, or it won't show until something else moves. The export dialog's canvases are `passive` (no loop, no pointer controls); the exporter draws every frame itself and waits for `whenReady()` first.
- **Scene code is shared, not duplicated.** Anything that affects how a frame
  looks belongs in `client/src/lib/render/scene-renderer.ts`, so the editor and
  the MCP stay in lockstep. `ThreeScene.svelte` should only hold Svelte and DOM
  concerns.
- **Models are centred and animations are scaled per model.** `setModel` wraps
  the GLB in a pivot group centred on its bounding box, so every model turns
  about its own middle whatever origin its file has. `defaultPosition` is where
  that centre rests. Keyframe z is multiplied by the rest distance over
  `REFERENCE_DISTANCE` (4, where the iPhones sit), so a preset zooms a small
  model parked near the camera (the Pixels, 0.2 away) by the same factor as an
  iPhone instead of through the camera. x/y were already fractions of the frame.
- **A model file's screen UVs can't be trusted.** Some GLBs have none that work
  (every vertex at one UV) or point into a texture atlas; their layer sets
  `"uv": "planar"` to lay the image flat across the screen instead. The screen
  material keeps the file's sidedness, because some screens are wound inward.
  Render every model after touching `scene-renderer.ts` or a model JSON.
- **`caseColor: null` means the model's own colours.** A colour is painted over
  the whole phone on load, except the screen (any mesh a media layer matches,
  by mesh or material name) and glass (transmissive materials, which would
  tint the screen behind them). The picker's colour carries over when the
  model is switched.
- **Tailwind v4.** Configured via `@tailwindcss/vite`, no `tailwind.config.js`. Theme files (`theme.css`, `theme-2.css`, …) are CSS, not JS config.
- **Bun is used in dev** (`bun run dev`, `bun.lockb` present) but the Dockerfiles use `npm ci` against `package-lock.json`. Both lockfiles are committed.

## Model catalogue and camera cutouts

Offer only the four audited entries in `models`. Use `getModel` when resolving
saved projects or MCP model IDs: it supports hidden legacy models and merges
`iphone-16-pro-full-screen` into the current iPhone with the island off.
Keep the old asset files for project compatibility.

The iPhone 16 Pro and Pixel 9 Pro use exact `cameraIsland.nodes` metadata and
`showCameraIsland`. Keep visibility in the shared renderer, preserve the
setting in saved projects and forward it through the MCP harness. Pixel uses
`cameraIsland.label` to show “Show camera cutout” in the UI. Standalone cutout-free
GLBs and Blender files exist for downloads, without duplicate picker entries.
