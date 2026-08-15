# Working in image-tools

Read `README.md` for architecture, `PRODUCT.md` + `DESIGN.md` for design
decisions. This file is the short version of what matters when editing.

## Rules

- **Self-contained.** This folder must build, test and deploy alone (the
  monorepo rule). Never reference anything outside `image-tools/`.
- **Client-side only.** Conversion never touches a server. Don't add upload
  endpoints or server-side conversion. The privacy promise is about files:
  they never leave the device. The copy must never promise "no tracking".
- **Analytics is live and deliberately anonymous.** PostHog (EU host) starts
  in `+layout.svelte` with `cookieless_mode: 'always'` and
  `person_profiles: 'never'`, guarded to skip localhost. This is what makes a
  consent banner legally unnecessary: nothing is written to cookies or
  storage. NEVER call `posthog.identify()` or `posthog.alias()`, and never
  loosen those two flags — doing so reintroduces personal data and breaks the
  GDPR basis for running banner-free.
- **Do Not Track and GPC are checked by us, not by PostHog.** `respect_dnt`
  does not work when `cookieless_mode` is `'always'`: the SDK already counts
  every visitor as opted out and captures anyway, since in its model
  cookieless capture is what an opted-out visitor gets. Verified in a
  browser, with DNT on it still posted an event. So `+layout.svelte` checks
  `doNotTrack` and `globalPrivacyControl` itself and does not even import the
  library. Do not "simplify" this back to the config option. It is the only
  way we can honour an objection, since remembering an opt-out would need the
  device storage we promise not to use, and the privacy policy states it as
  fact. `/tmp/e2e/privacy.mjs` covers it, and needs a non-localhost base URL
  plus a masked `navigator.webdriver`, or PostHog's bot filter makes every
  case pass for the wrong reason.
- **Analytics goes through the first-party relay at `/t`**
  (`src/routes/t/[...path]/+server.ts`), so content blockers cannot drop it.
  Two things there are load-bearing: `x-forwarded-for` and `user-agent` must
  be forwarded, because cookieless mode hashes them server-side to count
  unique visitors and without them every visitor collapses into one; and
  `trailingSlash = 'ignore'` stops a 308 on every `/i/v0/e/` post. `api_host`
  is built from `location.origin`, so it follows whatever domain serves the
  site.
- **Keep analytics off the critical path.** It is a dynamic import started on
  idle. A static import puts ~55KB in the layout chunk that every page waits
  for. Measure with the resource timing API before and after any change here.
- **Copy style.** No em dashes and no semicolons in user-facing text. Plain
  sentences, dry tone, SEO keywords ("X to Y converter", "free", "online",
  "no upload") carried naturally in titles, descriptions and headings.
- **The registry drives everything.** New format = edit
  `src/lib/engine/formats.ts` + add its decode/encode case. Pages, slugs,
  the matrix, accept lists and sitemap follow automatically. Don't hand-write
  per-pair pages or copy.
- **Tools follow the same pattern.** New tool = entry in
  `src/lib/tools/registry.ts` (slug, SEO copy, steps, `faq`) + pure logic in
  `src/lib/tools/` with tests + an editor in `src/lib/ui/tools/` + a thin
  route wrapping it in `ToolPage`. Nav, landing, sitemap and cross-links
  update themselves. Export always goes through `ExportBar` and the engine
  encoders.
- **Every page needs its own questions.** `src/lib/faq.ts` holds the two
  shared trust questions, which carry all four promises and are identical
  site wide on purpose. Everything after them must belong to that page
  alone: `pairFaq` derives them from the format table, tools carry a `faq`
  field, presets get them from `presetFaq`. Tests enforce two per tool, no
  question used twice, and answers over 140 characters, because a one-line
  answer is not the shape a search result or an assistant quotes. When the
  shared pair was the whole FAQ it was 29% of every page's words and word
  for word the same on all 163.
- **One page per conversion, 63 of them.** The alias spellings
  (`png-to-jpeg`, `heif-to-*`, `tif-to-*`) are 301s in `hooks.server.ts`,
  not pages. They were pages pointing `rel=canonical` at the primary
  spelling, which meant 31 near-copies Google was never going to index, and
  dropping them from the sitemap left them with no inbound links at all.
  `spellingNote()` puts the other spelling on the primary page instead,
  which is what covers the query. Every prerendered page is now both
  linked and listed: 138 pages, 138 sitemap URLs, zero orphans, and a test
  pins the count at 63 because the hub copy once claimed 93 by counting
  spellings.
- **`lastmod` comes from `CONTENT_UPDATED` in `site.ts`**, a hand-set date.
  Bump it when the words change, not when the build runs, or the signal
  stops being worth anything.
- **WASM codecs are lazy.** Keep them behind dynamic imports, and keep
  `optimizeDeps.exclude` in `vite.config.ts` in sync when adding one.
- **Video is ffmpeg.wasm, and three things about it are load bearing.**
  (1) The core is the **ESM** build, copied out of node_modules into
  `static/ffmpeg/` by a plugin in `vite.config.ts` and gitignored. ffmpeg
  spawns its worker with `type: "module"`, where `importScripts` does not
  exist, so it falls through to a dynamic import and needs a default export.
  The UMD build fails at runtime with "failed to import ffmpeg-core.js".
  Blob URLs fail the same way, so pass the plain paths.
  (2) `plan.ts` copies streams whenever the target container accepts the
  codecs, which is the difference between 60ms and 9s. Most real conversions
  (MOV to MP4, MKV to MP4, anything into Matroska) never re-encode at all.
  (3) The encoder settings were measured, not guessed. VP8 needs
  `-deadline realtime -cpu-used 8`, which is eight times faster for the same
  file size. **VP9 crashes the tab** and must not be offered. H.264 uses
  `veryfast`, not `ultrafast`, because ultrafast produced a file larger than
  the source. `plan.test.ts` pins all of this.
- **Pure parts stay pure.** BMP/ICO encoders, sniffing, slugs and naming run
  in plain Node and have vitest coverage. DOM code lives only in
  `decode.ts`/`encode.ts`/UI.
- **Design register is product, personality "quiet tool".** Dry copy, no
  exclamation marks, monospace for data, one accent. No new colors outside
  the tokens in `src/app.css`.

## Verify

```sh
pnpm test && pnpm check && pnpm build
```

For real-browser verification: `pnpm build && PORT=4173 pnpm start`, then
exercise a page with actual files (HEIC decode, AVIF encode and the Safari
WebP fallback only prove themselves in a browser).
