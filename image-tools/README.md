# imagetoolbox

Free, client-side image conversion and editing in the browser, at
[imagetoolbox.org](https://imagetoolbox.org). The monorepo folder and the
dashboard slug keep the historical name `image-tools`.

Every format pair gets its own prerendered page under `/convert/`
(`/convert/heic-to-jpg`, `/convert/png-to-webp`, … — 63 pages plus the
`/convert` hub), each with a dropzone, batch conversion, previews, per-file
download and zip-all. Ten formats can be read and seven written, since HEIC,
SVG and TIFF have no browser encoder. Old root-level pair URLs 301 to
`/convert/…` via `src/hooks.server.ts`, and so do the alias spellings
(`png-to-jpeg`, `heif-to-jpg`, `tif-to-png`), which used to be pages of
their own pointing `rel=canonical` at the primary spelling. The primary page
now carries a sentence saying the spellings are interchangeable.
`/convert/jpeg-to-jpg` and
`/convert/jpg-to-jpeg` are a special case: the same format under two
extensions, so they rename the file rather than re-encode it, and only
convert when the bytes turn out not to be a JPEG after all. Conversion
happens entirely on the user's device; the Node server only serves the
static build.

There are also 47 tools in two sections: 32 image tools under `/tools/`
(hub at `/tools`, grouped into Crop and combine, Size and orientation,
Colour and light, Borders and effects, Text and marks, Privacy, Inspect
and For the web) and 15 PDF tools under `/pdf/` (hub at `/pdf`). Both hubs
have a live search box, and every tool page offers hand-picked next steps
from the registry's `next` field. Old `/tools/<pdf-slug>` URLs 301 to
`/pdf/`, as do the three original root-level tool URLs to `/tools/`.

Every page carries an FAQ with matching FAQPage structured data: two shared
trust questions and then two or three that belong to that page alone,
derived from the format table for conversions and hand-written per tool.

Video conversion lives under `/video/` (30 pages plus the `/video` hub):
MP4, MOV, WebM, MKV and AVI in every direction, plus video to GIF and video
to MP3. It runs ffmpeg compiled to WebAssembly, in the browser, so nothing is
uploaded and there is no size cap beyond what a tab can hold. Conversions that
only change the container copy the streams and finish in about a second
regardless of the video's length; conversions that change the codec rebuild
every frame and take roughly as long as the video runs. Each page says which
kind it is. The 32MB core is fetched only when a file is dropped, is about
7MB over the wire once brotli has it, and is then cached by the browser.

Ten video editing pages sit beside the conversions, driven by their own
registry in `src/lib/video/tools.ts`: trim, crop, resize, speed, frame rate,
rotate, blur, add text, remove sound and compress. The arguments are built by
`src/lib/video/edit.ts`, which is pure and tested like the conversion planner
beside it. Every one of them re-encodes except two, and those two are the ones
worth knowing about: trimming on a keyframe copies both streams, and removing
the sound copies the picture, so both finish in about a second with every
frame identical to the original. Adding text needs a font written into
ffmpeg's filesystem, since a browser sandbox has none, so
`static/fonts/caption.ttf` ships with the site.

Everything runs client-side. The image tools cover crop, combine, split,
trim, extend canvas, resize, bulk resize, rotate, flip, adjust, black and
white, sepia, invert, replace colour, sharpen, border, round corners, drop
shadow, vignette, blend, add text, watermark, blur, redact, pixelate, EXIF
removal, transparent background, colour picker, histogram, compress,
favicon and Base64. The PDF tools cover image→PDF, PDF→image, merge,
split, extract pages, delete pages, reorder, rotate, watermark, page
numbers and PDF→text, plus four format-specific landing pages (JPG, PNG
and HEIC to PDF, and PDF to PNG) that share those editors but arrive
preconfigured for the format they name.

Shared pure logic lives in `src/lib/tools/`: `pixels.ts` (luma greyscale,
sepia matrix, colour replacement, edge trimming), `pdf.ts` (page ranges,
document rebuilding), plus flood fill, crop geometry and layout maths. The
editors in `src/lib/ui/tools/` are the only DOM-bound parts, and several
are shared by variant (one filter editor serves four tools, one frame
editor three, one PDF page-selector two).

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
pnpm start      # serve the build via serve.js (PORT env, defaults to 3000)
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

## Carrying a result into the next tool

Convert to JPG, blur a face, then crop, without a download and a re-upload
between each step. Every tool's export bar and every converted file carry a
**Continue in** row: the two or three steps that obviously follow this one as
buttons you can hit without opening anything, then **All tools**, which opens
a searchable panel of every tool and every conversion out of the format the
result is already in. A dropdown of thirty-six tools is a filing cabinet, and
picking the next step is not filing.

The image then follows you until you say otherwise, and what follows you is
what is on screen rather than what was handed over last. Leave a tool by any
route at all, a link, the breadcrumb, the panel's way out to the full list, and
the result is rendered on the way past. Without that, cropping an image and
then walking to the next tool quietly loses the crop, which is the sort of bug
that makes a feature worse than not having it. The navigation is stopped, the
result is made, and it carries on where it was going, so the cost is the
moment it takes to render.

Any tool you open loads what you are carrying, once, and says at the top of the
page where it came from. Press **Start over** and it is let go, because
pressing Start over only to be handed the same image again would be a tool
arguing with you. Reloading forgets it too, since the only copy was in the tab.

The mechanism is deliberately the smallest one that could work, because of what
this site promises. Files never leave the device, so there is no server to park
a working copy on. Nothing is written to storage, so IndexedDB and
sessionStorage are out too, and putting somebody's photograph into device
storage to save them a click would be a bigger promise broken than the click was
worth. What is left is a variable in the running tab, which is exactly right: it
lasts as long as the tab does and not a moment longer.

Two seams make it reach everywhere. Every tool editor takes its files through
one `Dropzone`, so opening the carried image lives there and all of them got it
at once. Twenty export through one `ExportBar`, and every conversion goes
through one `FileRow`, so the picker lives in those two places rather than in
each tool. The rest have it added by hand next to their own download button.

- `src/lib/tools/handoff.ts` decides what a tool will take and where a result
  can usefully go, and is covered by tests.
- `src/lib/ui/carry.svelte.ts` is the slot itself. One file, not a history: a
  chain of five intermediate PNGs in memory is a hundred megabytes nobody asked
  for, so each step replaces the last.
- A file carried in keeps its format, so a chain that starts with a conversion
  to JPG still saves a JPG at the end. Dropping a file of your own clears that.

The two places it does not reach: the Back button, because cancelling a Back
and re-issuing it pushes a new history entry rather than going back, and
pressing Back is not somebody saying "bring this with me"; and the tools that
produce a zip rather than one image, which have nothing single to carry.

## Caching

Every response says how long it may be kept, because the ones that don't get
guessed at. Two classes, decided in `cache-policy.js`:

| | |
|---|---|
| `/_app/immutable/*`, `/ffmpeg/<version>/*` | a year, `immutable`, never revalidated |
| everything else | `no-cache`, revalidated every time |

`no-cache` does not mean "do not store", it means "ask first", and the ETag
turns nearly every one of those questions into a 304 with no body. So a deploy
is live for everyone the moment it lands, and costs one small request rather
than a re-download.

That policy needs `serve.js` as the entrypoint instead of the adapter's
`build/index.js`. adapter-node sends no `cache-control` at all except on the
hashed assets, has no option to change it, and serves prerendered pages and
`static/` off disk before any SvelteKit hook runs, so the header cannot come
from inside the app. `serve.js` wraps the adapter's exported `handler`, which
is the documented way in. Without it, browsers fall back to heuristic freshness
and quietly reuse a page for a fraction of its age, so the longer a deployment
has been up, the longer visitors keep seeing the previous one.

The ffmpeg core sits under its version number for the same reason. The bytes
are identical from one deploy to the next, but the file is freshly copied, so
its ETag changes and every visitor would download 32MB again for nothing.

Which build is live: `curl -s https://imagetoolbox.org/_app/version.json`.

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

- Web-worker conversion so huge AVIF encodes don't block the main thread.
- Animated GIF → animated WebP/AVIF, and GIF frame tools.
- PDF compress, sign and OCR. Note that pdf-lib cannot encrypt, so a
  password-protect tool would need another library.
- Eraser and brush, motion blur, kaleidoscope, QR generator and reader.

## Design

`PRODUCT.md` (strategy, register, anti-references) and `DESIGN.md` (tokens,
type, components) are the authority. Short version: quiet tool, pure white
surface, olive primary, bronze accent, monospace for data, `→` as the brand
motif, no marketing noise.
