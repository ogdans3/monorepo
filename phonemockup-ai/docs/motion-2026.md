# Motion collection and landing page — October 2026

The public gallery, editor preset picker and MCP catalogue now offer eight original looping animations. Existing projects retain their embedded keyframes, and legacy animation IDs (including `still`) still resolve. The old collection is no longer advertised.

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

The phone entrances deliberately begin partly outside the frame; Detail Study deliberately crops the device. Top Down moves the already open laptop; the existing lid controls remain available separately. All motions can be edited and applied to other devices.

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

Video output is 640×800 at 24 fps, H.264/yuv420p, fast start and no audio track. Durations are rounded to the nearest video frame. The eight videos total **2,578,161 bytes**, individually 207–471 kB. Posters are WebP. Editable models are not downloaded by the landing page.

`assets/motion-2026/qa/` contains five rendered checkpoints per motion, a contact sheet, file hashes and encoding checks. `render-report.json` is replaced by each renderer invocation; rerun the complete collection for a complete report.

## Playback and compatibility

`MotionPreview.svelte` loads video sources on visibility and calls `play()` on muted, inline videos. There is one playback policy (no competing native autoplay attribute). It pauses outside the viewport, in a hidden tab, when locally paused, or when the page-wide pause control is active. Reduced motion starts with a poster; explicit play remains available. Rejected play requests show “Tap to play”.

Landing previews have individual controls and a page-wide pause switch. Preset cards embedded in existing links/buttons use the same component without nested interactive controls. Posters remain usable if playback is unavailable.

## Validation

- Inspected 40 actual rendered checkpoint frames across all eight motions, including loop endpoints and quarter points.
- All eight video files decode completely; verified H.264, yuv420p, no audio track, and `moov` before `mdat` for fast start.
- Browser checks cover widths 320, 390, 768 and 1440; mobile autoplay without interaction; visibility pause/resume; global pause; reduced motion; blocked autoplay recovery; gallery filtering; featured selections; matching iPhone/MacBook scenes; and demo persistence after save/reload.
- All 11 motion collection checks and 3 existing project/preset regression checks passed. The MCP catalogue lists exactly eight new presets, and legacy `still` and `group-center-spin-zoom` render successfully.
- Client and MCP production builds passed. Svelte check reports zero errors and eight existing warnings.
- Screenshots record desktop and mobile layouts. Mobile tests use Chromium device emulation, not a physical iPhone/Safari certification. Browser power-saving or per-site policy can still require the explicit play button.

Run browser checks from `client/` with `npx playwright test tests/motion-collection.spec.ts`. The repository Playwright config accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_PORT` when a system browser or alternate port is needed.
