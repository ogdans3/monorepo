# Working in image-tools

Read `README.md` for architecture, `PRODUCT.md` + `DESIGN.md` for design
decisions. This file is the short version of what matters when editing.

## Rules

- **Self-contained.** This folder must build, test and deploy alone (the
  monorepo rule). Never reference anything outside `image-tools/`.
- **Client-side only.** Conversion never touches a server. Don't add upload
  endpoints or server-side conversion. The privacy promise is about files:
  they never leave the device. The copy must never promise "no tracking".
- **Analytics is live and deliberately anonymous.** PostHog (EU host) runs in
  `+layout.svelte` with `cookieless_mode: 'always'` and
  `person_profiles: 'never'`, guarded to skip localhost. This is what makes a
  consent banner legally unnecessary: nothing is written to cookies or
  storage. NEVER call `posthog.identify()` or `posthog.alias()`, and never
  loosen those two flags — doing so reintroduces personal data and breaks the
  GDPR basis for running banner-free.
- **Copy style.** No em dashes and no semicolons in user-facing text. Plain
  sentences, dry tone, SEO keywords ("X to Y converter", "free", "online",
  "no upload") carried naturally in titles, descriptions and headings.
- **The registry drives everything.** New format = edit
  `src/lib/engine/formats.ts` + add its decode/encode case. Pages, slugs,
  the matrix, accept lists and sitemap follow automatically. Don't hand-write
  per-pair pages or copy.
- **Tools follow the same pattern.** New tool = entry in
  `src/lib/tools/registry.ts` (slug, SEO copy, steps) + pure logic in
  `src/lib/tools/` with tests + an editor in `src/lib/ui/tools/` + a thin
  route wrapping it in `ToolPage`. Nav, landing, sitemap and cross-links
  update themselves. Export always goes through `ExportBar` and the engine
  encoders.
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
