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
- **The sitemap lists canonical URLs only.** The alias spellings
  (`png-to-jpeg`, `heif-to-*`, `tif-to-*`) are still prerendered from
  `allPairSlugs()` and still rank, but they point `rel=canonical` at the
  primary spelling, so listing them too would contradict that. `lastmod`
  comes from `CONTENT_UPDATED` in `site.ts`, a hand-set date. Bump it when
  the words change, not when the build runs, or the signal stops being
  worth anything.
- **WASM codecs are lazy.** Keep them behind dynamic imports, and keep
  `optimizeDeps.exclude` in `vite.config.ts` in sync when adding one.
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
