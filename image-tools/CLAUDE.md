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
  **Contractions in body copy.** The site once had 114,000 words and not one
  "it's" or "don't", which is the loudest thing a reader notices without
  being able to name it. Titles, meta descriptions and h1s stay uncontracted:
  they are search targets and length checked. A blanket rewrite is not safe,
  because "the best original you have" is not "you've" and "renaming it is
  enough" is not "it's" — both are main verbs, not auxiliaries. Contract by
  hand or guard the rule.
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
- **The carried file lives in memory and nowhere else.** Continuing from one
  tool into the next holds the result in a module-level `$state`
  (`src/lib/ui/carry.svelte.ts`). Do not "improve" this into sessionStorage or
  IndexedDB. Writing a visitor's photograph into device storage is a new
  processing activity, it breaks what the privacy page says in plain words, and
  the ePrivacy basis for running without a banner is that nothing is stored.
  The slot holds one file, not a history, because five intermediate PNGs is a
  hundred megabytes. `src/lib/tools/handoff.ts` holds the pure part and has
  tests; `takes: 'pdf'` in the registry is what stops a PNG being offered to
  `merge-pdf`.
- **The chain reaches every tool through two shared components.** `Dropzone`
  opens the carried image, so every editor and every conversion page got it
  without being touched, and `ContinueIn` is the picker used by `ExportBar`,
  `FileRow` and the few editors that download on their own. A new tool that
  uses both gets chaining for free. One that rolls its own dropzone or download
  button does not, and should say why.
- **What follows you is what is on screen, and `ExportBar` is what makes that
  true.** It stops an internal navigation, renders the current result, then
  continues to where it was going. Rendering cannot happen in advance (that
  means encoding a full-size image after every edit) and cannot happen during
  navigation (that is synchronous), so cancel-render-resume is the only shape
  left. Only for `link` and `goto`: cancelling a `popstate` and re-issuing it
  pushes a new history entry instead of going back.
- **Opening the carried image happens once per page, and Start over lets it
  go.** `carry.shouldOpen` is what enforces it: a dropzone that comes back
  after the file was opened there means Start over was pressed, and handing the
  same image straight back would be a tool arguing with its user. Do not
  "improve" this into always opening.
- **Every response states its cache policy, and `serve.js` is why.**
  adapter-node sets `cache-control` on `/_app/immutable/` and nothing else,
  has no option for it, and serves prerendered pages and `static/` off disk
  before any hook runs, so it cannot be done from inside the app. `serve.js`
  wraps the adapter's exported `handler` and sets the header first. Do not
  put the entrypoint back to `build/index.js`: with no header the browser
  applies heuristic freshness, and visitors keep the last deploy's pages for
  hours without one request that would tell them otherwise. The policy is
  `cache-policy.js`, plain dependency-free JS so both the server and the test
  can import it, and the Dockerfile copies it next to `serve.js`.
- **A URL that is cached for a year has to carry its version.** That is why
  the ffmpeg core is copied to `static/ffmpeg/<version>/` and the loader
  builds its paths from `__FFMPEG_CORE_VERSION__`, defined in
  `vite.config.ts` from the same constant that does the copying. Unversioned,
  the 32MB core is byte-identical between deploys but freshly copied, so its
  ETag changes and everyone downloads it again.
- **WASM codecs are lazy.** Keep them behind dynamic imports, and keep
  `optimizeDeps.exclude` in `vite.config.ts` in sync when adding one.
- **Video tools are a second registry, and re-encode by definition.**
  `src/lib/video/tools.ts` mirrors `src/lib/tools/registry.ts` for the eleven
  editing pages under `/video/<slug>`. A parallel table rather than a
  `takes: 'video'` column, because the two sections share nothing past the
  words: different input, ffmpeg instead of a canvas, and a warning about the
  wait that no image tool needs. `edit.ts` builds the arguments and is pure and
  tested. Only two edits escape the re-encode, and they are the two worth
  advertising: a trim on a keyframe copies both streams, and dropping the sound
  copies the picture. `keepsFrames` in the registry is what says so, and a test
  pins it to exactly those two.
- **Slowing one section down is a concat of three, and the frames are not
  repeated.** `slow-motion-video` is the only edit that builds a
  `-filter_complex` rather than a `-vf`: `stretchFilter` in `edit.ts` trims the
  clip into head, section and tail, retimes the middle with `setpts` and joins
  them with `concat`, so everything outside the marks keeps its own pace.
  `-fps_mode vfr` beside it is load bearing. Left to itself ffmpeg makes the
  output constant rate, which for a fourteen times stretch means encoding
  fourteen times as many frames for a picture that steps at exactly the same
  moments. There is no `fps` filter in the graph for the same reason, and the
  about copy says so rather than pretending the result glides. A section that
  turns out to be the whole clip has no head and no tail, so `planEdit` hands
  it to the ordinary `speed` path instead of building a concat of one.
- **Two retiming pages, one set of controls, pointed opposite ways.**
  `slow-motion-video` and `speed-up-video` are both `op: 'stretch'` and differ
  only by `direction: 'slower' | 'faster'` in the registry. The panel derives
  everything else from that flag: the curve's `RampRange`, the preset labels,
  the chips, and whether the readout says slowest or fastest. Do not fork them
  into two panels, and do not add a third direction that crosses 1 in the
  middle — a `RampRange` always has 1 at one end, so the whole axis belongs to
  the thing the visitor came to do and a dragged point means one thing.
- **The ramp op carries its range, and that is not decoration.** Planning a
  speed up curve against the slow range clamps every point above 1 back down to
  it, and the result is a graph that encodes a clip doing nothing, which is
  indistinguishable from success. `edit.test.ts` pins it.
- **The slow motion page has two modes, and they share one filter builder.**
  `stretch` marks a section and gives it a length. `ramp` takes a drawn curve of
  how fast the clip runs at each moment, so footage can ease away from its own
  pace, hold, and ease back. Both end up as a concat of retimed slices, so
  `concatFilter` in `edit.ts` builds the graph for both and `concatPlan` wraps
  it with the same arguments. That is the only reason the curve was cheap: a
  marked section is three slices and a curve is thirty, and past that they are
  the same operation. Do not give either mode its own copy of the graph, or
  they will drift on `-fps_mode vfr` and the `-STARTPTS` on every slice, which
  are the two things that were expensive to get right.
- **A curve cannot be handed to ffmpeg, so it is sampled.** `setpts` takes a
  constant multiplier and `atempo` takes a constant factor, and neither has a
  form that accepts a curve. `ramp.ts` cuts the curve into constant-speed
  pieces, spending them where the speed is moving and saving them where it is
  not: an untouched head or tail comes back as **one** segment at exactly 1, so
  it gets no multiplier and no atempo at all. `RAMP_MIN_STEP` is a floor, not a
  round number, because atempo works on a window of samples and a piece below
  it leaves the sound nothing to work with. `ramp.test.ts` checks the sampled
  running time against a numerical integral of 1/speed rather than against
  hand-written numbers, which is what catches a sampler that drifts.
- **A step change is deliberately not expressible on the curve.**
  `normaliseRamp` collapses two points closer than a millisecond, so a vertical
  edge cannot be drawn. That is the point: this mode draws ramps and the simple
  mode does square edges. A test asserts it, because the first version of that
  test tried to build a square out of 1ms transitions and quietly measured
  something else.
- **Both modes live in `VideoToolPanel`, unlike merge.** The split for
  `VideoMergePanel` was about shape: a join takes a list of files. Here the
  shape is identical, one file and one preview and one probe, and only the
  controls differ, which is what that panel already branches on for ten tools.
  Splitting them would also throw the loaded video away on every mode switch,
  which is the one thing a mode switch must not do.
- **The preview plays the curve.** `playbackRate` on the `<video>` costs
  nothing and answers the question the graph cannot, which is whether the ramp
  actually looks right. Finding that out by encoding is a two minute round
  trip. Browsers clamp the rate to roughly a sixteenth and up, so the whole
  `RAMP_SPEED_MIN` to `RAMP_SPEED_MAX` range is inside what they will play.
  Leaving the curve mode has to hand the rate back to 1.
- **The graph has a keyboard and touch equivalent, and it is not optional.**
  Dragging circles is no use on a phone where they are smaller than a
  fingertip, and no use at all to a screen reader. Each point is a real
  `role="slider"`, and the row under the graph edits the selected point with
  two native range inputs. The `<svg>` itself is `role="group"`: the pointer
  handlers on it are a shortcut, not the only way in.
- **Joining videos: exit code 0 proves nothing, and that is the whole story
  of `merge.ts`.** The concat demuxer fails silently in two different ways and
  both were caught only in a browser with real files. An MP4 followed by a
  WebM writes **only the first clip**, logs "Non-monotonous DTS in output
  stream" and exits successfully: three seconds out of six, presented as
  "every frame is identical to the original". A **silent clip in front** is
  worse, because the length comes out right: the demuxer takes its stream
  layout from the first file, so the output has no audio track and every other
  clip's sound is dropped. The joined file decoded zero audio bytes and the
  page said nothing.
  So `joinLooksComplete` probes the **output** and checks it against the
  inputs, on length and on which streams are present, and anything short or
  missing a stream is thrown away and re-encoded. Do not "simplify" this into
  trusting the exit code, and do not weaken it to a duration check alone,
  which is what it was first and which passed while the audio was being lost.
  Unverifiable counts as failed: a join we could not measure is re-encoded.
- **The merge panel is separate on purpose.** `VideoToolPanel` is singular
  everywhere: one file, one preview, one probe, one set of controls bound to
  it. `VideoMergePanel` takes a list, and `VideoToolPage` branches on
  `op === 'merge'`. Threading a list through the shared panel would leave ten
  tools carrying a shape only the eleventh uses. Same split the image side
  already makes with `PdfMergeEditor`.
- **`merge` is in the `EditOp` union but throws in `planEdit`.** It is there
  only so the tools registry can name it like every other page, since `op` is
  typed as `EditOp['kind']`. Every function in `edit.ts` takes one probe and
  one input. A join routed through there would fall past every branch and come
  out as a plain re-encode of one file, which looks like it worked.
- **drawtext: escape the colon, never the percent.** Verified one character at
  a time in a real browser, because the failure modes are opposite and both are
  silent. An unescaped `:` ends the option list and ffmpeg fails with "Error
  while processing the decoded data". An escaped `%` makes the value
  unparseable and drawtext then draws **nothing at all and reports nothing**,
  which is how the first version shipped looking fine: the test caption had no
  punctuation in it. `expansion=none` covers the percent instead. The font is
  `static/fonts/caption.ttf` (Roboto Bold, Apache 2.0, licence beside it),
  written into ffmpeg's filesystem on demand, because there is no system font
  inside the wasm sandbox.
- **`text-anchor`-style silent overrides have a video cousin: the quality
  slider.** `quality` belongs to the compress tool alone. Passing the panel's
  `quality` state to `editVideo` unconditionally handed the compressor's
  setting to every other tool, so a crop encoded at the compressor's CRF. Pass
  it only when `tool.op === 'compress'`.
- **Video is ffmpeg.wasm, and three things about it are load bearing.**
  (1) The core is the **ESM** build, copied out of node_modules into
  `static/ffmpeg/<version>/` by a plugin in `vite.config.ts` and gitignored. ffmpeg
  spawns its worker with `type: "module"`, where `importScripts` does not
  exist, so it falls through to a dynamic import and needs a default export.
  The UMD build fails at runtime with "failed to import ffmpeg-core.js".
  Blob URLs fail the same way, so pass the plain paths.
  (2) `plan.ts` copies streams whenever the target container accepts the
  codecs, which is the difference between 60ms and 9s. Most real conversions
  (MOV to MP4, MKV to MP4, anything into Matroska) never re-encode at all.
  It copies **per stream**, not all or nothing: AVI takes H.264 but not AAC,
  so an MP4 going into an AVI keeps the picture and re-encodes only the
  sound. Treating that as a full transcode cost 2.5s instead of 1.0s on a
  three second clip, and the picture is the part that carries the quality.
  A copy that ffmpeg then refuses falls back to a real encode, which is not
  theoretical: H.264 inside an AVI will not remux into Matroska even though
  Matroska accepts H.264, and `mkv-to-avi` and `avi-to-mkv` both land on the
  fallback. Trying and falling back beats maintaining a table of exceptions.
  (3) The encoder settings were measured, not guessed. VP8 needs
  `-deadline realtime -cpu-used 8`, which is eight times faster for the same
  file size. **VP9 crashes the tab** and must not be offered. H.264 uses
  `veryfast`, not `ultrafast`, because ultrafast produced a file larger than
  the source. `plan.test.ts` pins all of this.
- **The feedback form posts nothing.** `/feedback` composes a message with
  `src/lib/feedback.ts` and hands it to the visitor's own mail app, so there
  is no endpoint, no third party and no new personal data for us to hold. Do
  not "improve" it into a form handler without updating the privacy policy
  and COMPLIANCE.md, because collecting a message and an email address is a
  new processing activity. The clipboard button needs a secure context and
  falls back to a selectable box, which is why it works on the real site and
  not over plain HTTP.
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
