# iPhone 16 Pro · Full Screen

A creative mockup variant of the audited iPhone 16 Pro. The front Dynamic
Island and its two optical meshes are removed. The body dimensions, bezel,
rear cameras, materials and entire screen surface are unchanged. This is an
intentionally modified design, not a claim that Apple sells an island-free model.

## Files

- `client/static/iphone-16-pro-full-screen.glb` — standalone asset, 2,005,576 bytes,
  70 meshes and 93,609 triangles. No island geometry is present.
- `assets/models/iphone-16-pro-full-screen/iphone-16-pro-full-screen-studio.blend`
  — editable studio with packed demo image, lights and front/back presentation.
- `assets/models/iphone-16-pro-full-screen/iphone-16-pro-full-screen-web.blend`
  — compact web source with one media mesh/material named `screen`.
- `assets/models/iphone-16-pro-full-screen/previews/` — actual exported-GLB renders.
- `assets/models/iphone-16-pro-full-screen/qa/six-views.jpg` — front, back, left,
  right, top and bottom at the same scale.

The studio content object remains `SCREEN_VIDEO__REPLACE_MEDIA`. The GLB screen
and UVs cover the full display; replacing the demo with an image or video
requires no island mask. The original model files are retained unchanged.

## App setting

Choose **iPhone 16 Pro · Full Screen** for an island-free default. Both this
entry and **iPhone 16 Pro** offer **Show Dynamic Island** in the Model panel.
The shared renderer hides exactly `camera_cutout`, `front_camera_optical_lens`
and `front_camera_pupil`, marks the paused scene dirty and restores them when
enabled. Toggling does not reload or recenter the model and does not change UVs.

Both catalogue entries reuse `/iphone-16-pro.glb`, so either can restore the
island instantly without a second asset download. The separate full-screen
GLB above is for independent use outside the editor and has the parts deleted.

Saved projects retain explicit on/off choices and resolve node metadata from
the current catalogue. Older projects without the setting keep the original
model's on default. The MCP still/video tools accept `showCameraIsland` with
the same defaults and expose support/default information in their catalogue.

## Reproduce

From the PhoneMockup project directory, with Blender on PATH:

```sh
blender -b --python assets/models/common/blender_batch.py -- assets/models/iphone-16-pro-full-screen/build.py
python3 assets/models/iphone-16-pro-full-screen/validate_glb.py
blender -b --python assets/models/common/blender_batch.py -- assets/models/iphone-16-pro-full-screen/render.py
npm --prefix client run check
npm --prefix client run build
npm --prefix mcp run build
cd client && npx playwright test tests/camera-island.spec.ts --workers=1
```

Run `node mcp/scripts/check-camera-island.mjs` from the project directory after
building MCP. It renders every catalogue model, verifies both defaults and
both explicit island settings, and exercises animated frame exports.

Validation records are stored beside the asset in `qa/`: the Blender audit
compares all retained geometry, transforms and UVs; the exported GLB audit
compares all decoded positions, normals, UVs, indices, materials and transforms
against the original. Browser tests check rendered screen pixels, exact
restoration, paused redraws, save/load and changes during an unfinished load.
