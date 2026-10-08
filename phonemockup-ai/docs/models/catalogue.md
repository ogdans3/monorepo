# Curated device catalogue

The picker and public MCP catalogue contain four audited assets:

| Model | Why retained | Front camera setting |
| --- | --- | --- |
| iPhone 16 Pro | Audited external dimensions, corrected contours and complete screen UVs | Show Dynamic Island |
| Google Pixel 9 Pro | Documented dimensions, checked six views and screen projection | Show camera cutout |
| Samsung Galaxy S24 Ultra | Documented dimensions, checked six views and screen projection | Original cutout retained |
| MacBook Pro 14-inch M4 | Corrected chassis profile, verified hinge clearance and screen UVs | Not applicable |

The older `test-phone` and `iphone-test-phone` models and the alternate iPhone
17 / Pixel 10 exports are no longer offered. The earlier catalogue comparison
showed sideways screen textures on the iPhone 3 test exports and inconsistent
bezel, camera and material appearance among the older variants. The retained
models have their own dimensional audit and render records under `assets/models/`.
This selection does not certify every retired file as unusable; it makes the
new-project catalogue consistent and reviewable.

The prototype JSON definitions and GLBs are retained for old project and API
compatibility. `getModel` resolves these hidden models without listing them.
New projects default to the audited Pixel 9 Pro.

`iphone-16-pro-full-screen` was a duplicate catalogue entry pointing to the
same GLB with a different visibility default. It now resolves to iPhone 16 Pro
with `showCameraIsland: false`. Explicit choices in saved projects win over
that default. Cutout-free downloadable GLBs/Blender files do not add new rows.
