# Pixel 9 Pro without the front camera cutout

Select **Google Pixel 9 Pro** and turn **Show camera cutout** off in the Model
panel. This hides the black front-camera disc and its two optical meshes
(`camera_cutout`, `front_lens`, `front_lens_pupil`). The complete screen stays
visible underneath, including video content. Enable the switch to restore
all three meshes without reloading or moving the phone.

The setting is saved with the project and used by still/video exports. The
headless render tools use `showCameraIsland: false` for compatibility with the
existing iPhone setting. The Pixel's default remains on.

## Standalone files

- `client/static/pixel-9-pro-full-screen.glb`: 1,543,968 bytes, 59 meshes and
  75,387 triangles. No front-camera meshes remain.
- `assets/models/pixel-9-pro-full-screen/pixel-9-pro-full-screen-studio.blend`:
  editable studio with packed media.
- `assets/models/pixel-9-pro-full-screen/pixel-9-pro-full-screen-web.blend`:
  compact browser source with the single media mesh/material named `screen`.
- `assets/models/pixel-9-pro-full-screen/previews/`: actual model renders.
- `assets/models/pixel-9-pro-full-screen/qa/`: six-view renders and validation.

The studio screen is also named `screen`. Replace the packed image in
`MAT_SCREEN_VIDEO` → `REPLACE_MEDIA`, retaining the existing UV map.

The original asset is unchanged. Direct comparison of both exported GLBs
verifies that all 59 retained meshes have identical positions, normals, UVs,
indices, materials and transforms. This is a creative mockup modification,
not a physical Google product. There is only one Pixel entry in the app.

## Rebuild

From this project folder, with Blender on PATH:

```sh
blender -b --python assets/models/common/blender_batch.py -- assets/models/pixel-9-pro-full-screen/build.py
python3 assets/models/pixel-9-pro-full-screen/validate_glb.py
blender -b --python assets/models/common/blender_batch.py -- assets/models/pixel-9-pro-full-screen/render.py
```

After building the client and MCP packages, run `npx playwright test
tests/camera-island.spec.ts` in `client/`, and
`node mcp/scripts/check-camera-island.mjs` from the project folder.
The latter renders every active model plus both cutout states and the legacy
iPhone full-screen alias through the public export API.
