# image-tools

Free, client-side image conversion in the browser. Working title — the
project is unnamed so far (update `src/lib/site.ts` and the wordmark when
christened).

Every format pair gets its own prerendered page (`/heic-to-jpg`,
`/png-to-webp`, …, alias spellings like `/heif-to-jpeg` included — ~93
pages), each with a dropzone, batch conversion, previews, per-file download
and zip-all. Conversion happens entirely on the user's device; the Node
server only serves the static build.

## Stack

- **SvelteKit** (Svelte 5 runes) with `@sveltejs/adapter-node`
- **Engine**: browser codecs where they exist, lazy-loaded WASM/JS where they
  don't — `@jsquash/avif`, `@jsquash/webp` (Safari fallback), `libheif-js`
  (HEIC), `utif2` (TIFF), `gifenc` (GIF), hand-rolled BMP/ICO encoders
- **fflate** for the zip-all download
- **vitest** for the pure engine parts

## Commands

```sh
pnpm install
pnpm dev        # dev server
pnpm test       # engine unit tests
pnpm check      # svelte-check
pnpm build      # production build (prerenders all pages)
pnpm start      # serve the build (PORT env, defaults to 3000)
```

## How the engine works

Everything passes through one hub: decoded, raw RGBA pixels
(`src/lib/engine/raw.ts`). A conversion is `sniff → decode → RawImage →
encode → rename`:

- `formats.ts` — the registry. Pages, slugs, accept lists, SEO copy and the
  conversion matrix are all derived from this one table. Add a format here
  and wire its decode/encode case; everything else follows.
- `sniff.ts` — magic-byte detection (extensions are only a fallback; a PNG
  renamed to `.jpg` is treated as a PNG). Tells HEIC and AVIF apart by ftyp
  brands.
- `decode.ts` / `encode.ts` — browser-only; WASM codecs are dynamic imports
  so each page only loads what it needs.
- `convert.ts` — the pipeline; keeps the base filename (`IMG_1.HEIC` →
  `IMG_1.jpg`, and `IMG_1.jpeg` on the `…-to-jpeg` alias pages).

HEIC, SVG and TIFF are source-only: HEVC encoding is patent-encumbered, and
raster→vector is a different tool. Animated GIFs flatten to their first
frame (v1).

## Before launch

- Set the real domain in `src/lib/site.ts` (canonicals + sitemap) and
  `static/robots.txt`.
- Pick a name; update `SITE_NAME`, the wordmark in
  `src/routes/+layout.svelte`, and this file.

## Later

- Editing tools (crop, resize, rotate) — the RawImage hub is built for it.
- Web-worker conversion so huge AVIF encodes don't block the main thread.
- Animated GIF → animated WebP/AVIF.

## Design

`PRODUCT.md` (strategy, register, anti-references) and `DESIGN.md` (tokens,
type, components) are the authority. Short version: quiet tool, pure white
surface, olive primary, bronze accent, monospace for data, `→` as the brand
motif, no marketing noise.
