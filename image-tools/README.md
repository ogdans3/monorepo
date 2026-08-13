# imagetoolbox

Free, client-side image conversion and editing in the browser, at
[imagetoolbox.org](https://imagetoolbox.org). The monorepo folder and the
dashboard slug keep the historical name `image-tools`.

Every format pair gets its own prerendered page under `/convert/`
(`/convert/heic-to-jpg`, `/convert/png-to-webp`, …, alias spellings like
`/convert/heif-to-jpeg` included — ~93 pages plus the `/convert` hub), each
with a dropzone, batch conversion, previews, per-file download and zip-all.
Old root-level pair URLs 301 to `/convert/…` via `src/hooks.server.ts`.
Conversion happens entirely on the user's device; the Node server only
serves the static build.

There are also 43 tools under `/tools/` (hub page at `/tools`, grouped
into Edit, Transform, Adjust, Privacy, Background, Documents and For the web),
same client-side rules: crop, combine, resize, rotate/flip, adjust
(brightness/contrast/saturation via canvas filters), blur (shape-drawn
regions, blur or pixelate), redact (solid shapes), transparent background
(magic-wand flood fill), EXIF viewer/remover (exifr for parsing, the
decode→encode pipeline for stripping), watermark (text or logo, 9-position
anchor or tiled), compress (binary search over quality to hit a byte
target, optional stepped downscaling) and a favicon generator (multi-size
ICO + PNG set + HTML snippet, zipped), round corners/circle crop, split
into a grid (zip), sharpen (unsharp mask), colour picker (click + dominant
palette via the GIF quantiser), bulk resize (zip), image→PDF (pdf-lib,
match-size or A4 pages) and PDF→image (pdfjs-dist, per page or zipped),
plus image→Base64. There is a nine-tool PDF suite on pdf-lib and pdfjs
(merge, split, extract/delete pages, reorder, rotate, watermark, page
numbers, PDF→text), and a filter family sharing pure pixel maths in
`src/lib/tools/pixels.ts` (black and white, sepia, pixelate, vignette,
replace colour, trim, extend canvas, border, drop shadow, blend, add text,
histogram). Most export through the engine's encoders via a shared
ExportBar. The three original root-level tool URLs 301 to `/tools/…` via
`src/hooks.server.ts`.

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

The tools follow the same pattern with their own registry
(`src/lib/tools/registry.ts` — slugs, SEO copy, how-to steps) feeding nav,
landing section, sitemap and cross-links. Pure logic (flood fill, crop
geometry, combine layout math) lives in `src/lib/tools/` under vitest;
the editors in `src/lib/ui/tools/` are the only DOM-bound parts.

## Deploy

Two paths, same Dockerfile (multi-stage node:22-alpine, listens on port 3000):

### 1. AI Central master-dashboard (dev/preview)

The dashboard discovers the folder automatically (Dockerfile +
`.dashboard.yaml`), builds and runs it, and exposes it at
`https://image-tools.<host>/`.

### 2. Production: Docker Swarm + Traefik (`deploy/`)

Adapted from the hvalen-minigolf setup. On the swarm host:

```bash
./deploy/update-stack.sh   # builds, pushes to 127.0.0.1:5000, deploys stack "imagetoolbox"
```

Traefik routes `imagetoolbox.org` and `www.imagetoolbox.org` to the container
with Let's Encrypt via `myresolver`. Both hosts must point at the swarm server
in DNS. The apex is canonical (`ORIGIN` and every canonical tag). Assumes the
external `proxy-net` network and the local registry, as with hvalen and
bobilpark.

Optional: register imagetoolbox.app/.net/.io as defensive redirects.

## Later

- Editing tools (crop, resize, rotate) — the RawImage hub is built for it.
- Web-worker conversion so huge AVIF encodes don't block the main thread.
- Animated GIF → animated WebP/AVIF.

## Design

`PRODUCT.md` (strategy, register, anti-references) and `DESIGN.md` (tokens,
type, components) are the authority. Short version: quiet tool, pure white
surface, olive primary, bronze accent, monospace for data, `→` as the brand
motif, no marketing noise.
