# Landing page redesign — October 2026

The homepage introduces the product through its real device renders and editor.
Archivo, a warm white surface, graphite text and a restrained rust accent replace
the previous italic headlines, pill controls and repeated promotional slogans.
The editing workspace now follows this direction too; see [the editor notes](editor-2026.md).

## Applied skill guidance

- [Emil Kowalski — Design Engineering](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): fast press feedback, specific transition properties, visible focus and restrained motion. The companion mobile-native guidance informs hover capability queries and touch targets.
- [Taste — Redesign Existing Projects](https://github.com/leonxlnx/taste-skill/blob/main/skills/redesign-skill/SKILL.md): audit before changing the page; preserve the existing Svelte stack and functioning previews; improve hierarchy, copy and spacing with the product's actual assets.
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max): design-system search for a creative editorial showcase and Svelte accessibility guidance. Applied its contrast, semantic controls, responsive layout and reduced-motion checks. The recommended monochrome structure fits this product; the existing warm brand accent informs the final CTA color.

## Structure and behavior

- The hero pairs a selectable phone preview with a MacBook preview on desktop.
  Mobile keeps one prominent preview to conserve space and decoding work.
- The first six motions cover an orbit, zoom, spin, flip, laptop and detail shot.
  Expanding the gallery preserves their order, adds the remaining ten and exposes
  its expanded state. Category filters search the entire catalogue.
- The device browser selects among all four audited models and opens the
  matching preset. Logo/cutout/hinge copy reflects the current editor features.
- Mobile navigation is a disclosure with Escape dismissal and focus restoration.
- MotionPreview retains its existing playback authority, lazy source loading,
  reduced-motion policy and trusted-tap retry. Its style now has consistent
  44px controls, gated hover and press feedback.

## Assets

- `client/static/fonts/archivo/archivo-latin-variable.woff2` is self-hosted.
  Its SIL Open Font License is alongside it in `OFL.txt`.
- `client/static/media/landing/editor.webp` is a real 1440×1000 screenshot of
  `/platform/animation/soft-orbit`, paused at 2.5 seconds with Model open.
  It is lazy-loaded with intrinsic dimensions. Refresh it if that editor view changes.
- All device footage and posters come from the existing `previews/motion-2026`
  collection. No generated UI mockups or additional animation library are used.

## Verification

Run from this project:

```sh
npm --prefix client run check
npm --prefix client run build
cd client
HOST=127.0.0.1 PORT=5198 npm start
```

In a second terminal in `client/`, point Playwright at the running production
server so the video range and loop checks use `server.mjs`:

```sh
PLAYWRIGHT_PORT=5198 npx playwright test tests/motion-collection.spec.ts --workers=1
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5198 npx playwright test --config=playwright.mobile.config.ts --workers=1
```

The collection suite checks widths 320, 390, 768 and 1440, gallery expansion and
filters, featured controls, device/preset mapping, mobile navigation, reduced
motion, fallback playback and editor save/reopen. The mobile matrix checks
Chromium and WebKit touch playback, blocked autoplay, failed download recovery,
visibility pausing, two full loops and exact video range responses. WebKit device
emulation does not replace testing Safari on a physical iPhone.
