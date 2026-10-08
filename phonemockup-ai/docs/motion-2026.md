# Motion collection and landing page — October 2026

The public gallery, editor preset picker and MCP catalogue now offer sixteen original looping animations. Existing projects retain their embedded keyframes, and legacy animation IDs (including `still`) still resolve. The old collection is no longer advertised.

| Preset | Seconds | Preview device | Direction |
| --- | ---: | --- | --- |
| Soft Orbit | 6 | iPhone 16 Pro | Gentle orbit and drift |
| Edge Reveal | 5.4 | iPhone 16 Pro | Edge to front, readable hold, return |
| Lift Off | 5 | Pixel 9 Pro | Rise, settle, hold and leave |
| Slow Spin | 6 | Galaxy S24 Ultra | One full turn between front holds |
| Detail Study | 6 | Pixel 9 Pro | Close detail pan, wider reveal |
| Side Step | 5.6 | Galaxy S24 Ultra | Lateral glide and alternating tilt |
| Snap In | 4.4 | iPhone 16 Pro | Quick arrival, settle and return |
| Top Down | 6 | MacBook Pro 14 M4 | Overhead to front three-quarter orbit |
| Macro Rush | 6 | iPhone 16 Pro | Wide view to close screen detail and back |
| Pull Focus | 6 | Pixel 9 Pro | Close detail to a full-device reveal |
| Orbit Dive | 6 | iPhone 16 Pro | Wide lateral sweep with a close pass |
| Double Spin | 5 | Galaxy S24 Ultra | Two complete 360° turns |
| Barrel Roll | 6 | Pixel 9 Pro | A full 360° roll around the screen axis |
| Flip Cut | 5.5 | iPhone 16 Pro | Horizontal flip; screen cut at 2.50s |
| Tumble Cut | 5.5 | Pixel 9 Pro | End-over-end flip; screen cut at 2.50s |
| Whip Switch | 4 | Galaxy S24 Ultra | Fast lateral flip; screen cut at 1.80s |

The phone entrances deliberately begin partly outside the frame. Detail Study, Macro Rush, Pull Focus and the close pass of Orbit Dive use deliberate cropping. Top Down moves the already open laptop; the existing lid controls remain available separately. All motions can be edited and applied to other devices.

## Direction and references

Research informed pacing and presentation, rather than copying a template or downloading competitors' assets:

- [Rotato's monitor-to-phone transition tutorial](https://rotato.app/blog/monitor-to-phone-transition): deliberate camera moves, readable holds, and a slight angled finish. The article includes a video tutorial; the written walkthrough was reviewed.
- [Rotato templates](https://rotato.app/templates): product-focused scene presentation.
- [Jitter's device collection](https://jitter.video/templates/devices/) and [animated iPhone template](https://jitter.video/template/animated-iphone-mockup/): short motion studies with varied entrances, rotations and lateral movement.
- [WebKit's iOS video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/) and [autoplay guidance](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/): muted inline playback, visibility handling and a usable play fallback.

The keyframes, FORMA sample screens, palette and page layout are authored for this project. Previews render the actual shipped GLB models through the same SceneRenderer used by the editor and exports.

## Reproduce the assets

From `phonemockup-ai/`, with Python/Pillow and the client/MCP npm dependencies installed:

```sh
python3 assets/motion-2026/generate.py
npm --prefix mcp run build
node mcp/scripts/render-motion-collection.mjs
```

The renderer accepts optional preset IDs for a partial rerender. The JSON files under `client/src/lib/animations/presets/` are the active collection; their model, background and demo metadata also initialize the browser editor. New projects open in a matching 4:5 canvas. Built-in sample selection persists on save/reload; uploaded media takes precedence.

Video output is 640×800 at 24 fps, H.264/yuv420p, fast start and no audio track. Durations are rounded to the nearest video frame. The first eight videos total **2,578,161 bytes**, individually 207–471 kB. `qa/render-report.json` records the sizes and hashes for the complete current collection. Posters are WebP. Editable models are not downloaded by the landing page.

`assets/motion-2026/qa/` contains five rendered checkpoints per motion, a contact sheet, file hashes and encoding checks. Partial renderer runs update the selected presets in `render-report.json` while preserving the other entries.

## Playback and compatibility

`MotionPreview.svelte` loads video sources on visibility and calls `play()` on muted, inline videos. There is one playback policy (no competing native autoplay attribute). It pauses outside the viewport, in a hidden tab, when locally paused, or when the page-wide pause control is active. Reduced motion starts with a poster; explicit play remains available. Rejected play requests show “Tap to play”.

Landing previews have individual controls and a page-wide pause switch. Preset cards embedded in existing links/buttons use the same component without nested interactive controls. Posters remain usable if playback is unavailable.

## Initial collection validation

- Inspected 40 actual rendered checkpoint frames across all eight motions, including loop endpoints and quarter points.
- All eight video files decode completely; verified H.264, yuv420p, no audio track, and `moov` before `mdat` for fast start.
- Browser checks cover widths 320, 390, 768 and 1440; mobile autoplay without interaction; visibility pause/resume; global pause; reduced motion; blocked autoplay recovery; gallery filtering; featured selections; matching iPhone/MacBook scenes; and demo persistence after save/reload.
- All 11 motion collection checks and 3 existing project/preset regression checks passed. The initial MCP catalogue listed eight new presets, and legacy `still` and `group-center-spin-zoom` render successfully.
- Client and MCP production builds passed. Svelte check reports zero errors and eight existing warnings.
- Screenshots record desktop and mobile layouts. Mobile tests use Chromium device emulation, not a physical iPhone/Safari certification. Browser power-saving or per-site policy can still require the explicit play button.

Run browser checks from `client/` with `npx playwright test tests/motion-collection.spec.ts`. The repository Playwright config accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_PORT` when a system browser or alternate port is needed.

## Zooms, spins and screen transitions

The added collection keeps the first eight motions available and adds filters
for Zoom, Spin and Flip. New phone motions run from four to six seconds.

Flip Cut and Tumble Cut hold the back towards the camera from 2.20–2.80s,
with a suggested cut at 2.50s. Whip Switch holds it from 1.60–2.00s and cuts
at 1.80s. These are real held poses, not opacity tricks. A contrasting red/green
screen comparison on all three audited phones produced **zero changed pixels**
at each cut, with over 1,000 changed pixels in the front-view controls. See
`qa/screen-cuts/verification.json`.

In the editor, choose **Switch screens**, upload a **Before the flip** and an
**After the flip** image, then choose **Create screen switch**. **Try demo**
uses the original FORMA focus/completed-session designs. **Go to cut** seeks
to the hidden moment. The helper is available on a single phone track and
uses live clip times, so shifting a clip moves its suggested cut. Editing the
held pose to show the front removes that cue.

The helper creates a silent ordinary video file, preserving the existing
playback, export and save/reload path. The video is 30fps, up to 1,920px on
its longest side, and takes the first image's aspect ratio; the second image
is cropped to fill. The timeline may be up to 60 seconds. Supported codecs
are selected at runtime; an unavailable encoder or unreadable image leaves
the old screen content untouched and displays an error. Recreate the screen
video after changing animation timing. Original uploads are not separately
stored by this helper; the generated video is saved through IndexedDB.

For rendered examples that actually change screen content, run:

```sh
node mcp/scripts/render-motion-collection.mjs --screen-switch-demo
node mcp/scripts/check-screen-cuts.mjs
```

These examples go to `assets/motion-2026/screen-switch-demos/`. The public
looping cards retain one screen design so the loop endpoints match; the
separate transition examples show a before/after result.

`client/tests/screen-switch.spec.ts` checks shifted/edited cues, actual screen
pixels before and after the encoded cut, save/reload, unsupported encoding,
the new filters and the full-size one-click demo.

## Expanded collection validation

- All 16 collection/browser checks passed, including the full-resolution screen-switch demo, frame colors immediately before/after the cut, save/reload, error fallback and mobile autoplay. The five screen-switch checks were rerun after final control readability and invalid-coordinate handling changes.
- Inspected 45 checkpoints for the eight additional motions (including two extra rear-facing frames in the 720° spin) and 18 checkpoints in the three actual screen-switch demos. Close crops in Macro Rush and Pull Focus are intentional.
- All 16 public previews and three screen-switch examples fully decode as H.264/yuv420p, silent, with fast-start metadata. The eight new public videos total 2,517,151 bytes. Encoding results are in the two `video-validation.json` files under `qa/`.
- Nine red/green screen comparisons cover all three flip motions on iPhone 16 Pro, Pixel 9 Pro and Galaxy S24 Ultra. Every cut has zero changed pixels; each front-facing control shows the contrasting screen.
- Client and MCP production builds passed. Svelte check reports zero errors and eight existing warnings. Production preview assets match the completed source videos.

To reproduce the 44-second, eight-motion presentation video after rendering both collections:

```sh
python3 mcp/scripts/assemble-more-motion.py --output-dir /tmp/phonemockup-more-motion
```

The presentation uses the actual shared-renderer output. The final three clips show the screen changing; the editable phone poses loop, while the two-image screen content deliberately starts and ends differently.
