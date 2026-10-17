# PhoneMockup Studio — October 2026

The editor continues the landing page's Archivo typography, warm neutral surfaces
and rust accent. The canvas takes priority, with a fixed inspector on desktop
and an accessible dialog below 900px. The actual scene renderer and export
pipeline remain shared with the existing app.

## Editing behavior

- Screen upload is always at the top of the inspector. It uses the same media
  controller as drag-and-drop and clears the bulk list for a single uploaded file.
- Model, Transform, Scene, Bulk upload, Project Settings and Export are exclusive
  inspector sections. Selecting a timeline keyframe reveals its Transform controls.
- The mobile inspector retains its active section across closing and reopening.
  Escape dismisses it and returns focus to Edit scene. Export opens the export
  section directly, including on mobile.
- Timeline time fields, clip insertion, dragging, resizing, snapping and frame
  stepping retain their existing behavior. Touch taps can now seek on the ruler.
- Space activates a focused form control; from the workspace it plays or pauses.
  Keyframe buttons expose their selected state with `aria-pressed`.
- The motion picker uses a responsive preview grid with the existing categories,
  preview playback policy and insertion logic.
- The mobile export dialog wraps controls and hides the optional rating card to
  leave room for progress and the output preview.

## Styling boundary

`mock-video/studio.css` scopes the theme to `.studio-theme`. The editor temporarily
applies that class to the body so portaled selects and dialogs inherit its palette.
It restores the previous dark class on teardown. This avoids changing the landing,
project list, preset gallery or standalone renderer.

The inspector is scrollable independently; the canvas and timeline remain in the
viewport. Focus rings, reduced-motion overrides and hover capability queries apply
to the editor. Touch controls have larger targets. No new dependencies or external
font requests were added.

The design follows the same [Emil Kowalski](https://github.com/emilkowalski/skills),
[Taste](https://github.com/leonxlnx/taste-skill) and
[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) guidance used
for the landing page: preserve working behavior, simplify hierarchy, use restrained
motion, and verify the real interface at desktop and mobile sizes.

## Verification

Run from `phonemockup-ai/`:

```sh
npm --prefix client run check
npm --prefix client run build
cd client
npx playwright test tests/layout-smoke.spec.ts tests/timeline.spec.ts \
  tests/timeline-interactions.spec.ts tests/add-animation.spec.ts \
  tests/regressions.spec.ts tests/camera-island.spec.ts tests/model-logo.spec.ts \
  tests/laptop-hinge.spec.ts tests/screen-switch.spec.ts --workers=1
npx playwright test --config=playwright.editor.config.ts
```

The editor matrix covers 360, 390, 768, 1024 and 1440px widths, touch scrubbing and
playback, the motion picker, mobile device selection, retained logo choices,
export access, keyboard control activation and focus restoration. It runs in
Chromium and iPhone-configured WebKit. This is emulation, not a physical iPhone test.
Set `PLAYWRIGHT_BASE_URL` to use an already running production server. Browser
executable overrides follow the existing Playwright configuration conventions.

Real PNG and MP4 downloads were also rendered at 3840×2160; the MP4's 0.5s duration
and dimensions were checked with the browser decoder. The PNG flow was exercised
again in a 390px mobile viewport, including returning to the inspector.

The homepage's `client/static/media/landing/editor.webp` is refreshed from the
actual redesigned editor. Model and screen-switch QA screenshots also show the
new interface; device geometry and model files are unchanged.
