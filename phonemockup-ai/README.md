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

## iPhone without Dynamic Island

In the editor's **Model** panel, select **iPhone 16 Pro · Full Screen**, or select
**iPhone 16 Pro** and turn **Show Dynamic Island** off. Both support turning it
back on. The choice is saved with the project and used in still/video exports.
Other device models retain their own existing behavior.

The MCP render tools accept `showCameraIsland: false` (or `true`). Omitting it
uses the selected model's default: on for the original, off for Full Screen.

[Asset files, regeneration and validation](docs/models/iphone-16-pro-full-screen.md).

## Import provenance

Imported from the previously maintained `ogdans3/phonemockup-ai` project at
commit `e6af6c79cfc2007e2a40e9a80a280fc0ebe621dc`, including the iPhone, Pixel,
Samsung and articulated MacBook assets. PhoneMockup was absent from the
monorepo when this project folder was added. Subsequent island changes are a
separate commit from the unchanged import.
