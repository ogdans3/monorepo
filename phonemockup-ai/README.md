# PhoneMockup

Self-contained PhoneMockup project: Svelte editor, shared Three.js renderer,
local MCP renderer, API, device assets and Docker build. All commands below
run from this folder; no files or packages from other monorepo projects are needed.

```sh
npm --prefix client ci
npm --prefix client run dev
```

Build/check the client with `npm --prefix client run build` and
`npm --prefix client run check`. Build the local renderer with
`npm --prefix mcp ci` then `npm --prefix mcp run build`.
The root `Dockerfile` builds the client with this folder as its build context.
API deployment remains separately configured; see `CLAUDE.md` and `deploy/`.

## Device catalogue and front camera

New mockups offer four audited models: iPhone 16 Pro, Google Pixel 9 Pro,
Samsung Galaxy S24 Ultra and MacBook Pro 14-inch M4. Pixel 9 Pro is the default.
Earlier prototype models are hidden from the picker and public MCP catalogue;
their assets are retained so existing projects and old API calls still work.

The iPhone appears once. In **Model**, use **Show Dynamic Island** to turn the
island on or off. The Pixel has **Show camera cutout** for its front camera
hole. These settings persist with the project and apply to still/video exports.
The MCP render tools accept `showCameraIsland: false` (or `true`) for either.

Old `iphone-16-pro-full-screen` projects resolve to iPhone 16 Pro with the
island off unless they explicitly saved another setting. The separate
island-free Blender/GLB downloads are still available for independent use;
they do not add duplicate entries to the app.

[iPhone asset details](docs/models/iphone-16-pro-full-screen.md) ·
[Pixel asset details](docs/models/pixel-9-pro-full-screen.md) ·
[Catalogue selection](docs/models/catalogue.md).

## Import provenance

Imported from the previously maintained `ogdans3/phonemockup-ai` project at
commit `e6af6c79cfc2007e2a40e9a80a280fc0ebe621dc`, including the iPhone, Pixel,
Samsung and articulated MacBook assets. PhoneMockup was absent from the
monorepo when this project folder was added. Subsequent island changes are a
separate commit from the unchanged import.
