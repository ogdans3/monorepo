# MacBook Pro 14-inch M4 (2024) — Silver

A compact articulated laptop for PhoneMockup, with the US ANSI 78-key keyboard.
The primary web asset is `client/static/macbook-pro-14-m4.glb`. The editable
studio and web Blender sources and a separate animated GLB are in
`assets/models/macbook-pro-14-m4/`.

## Open the lid

In PhoneMockup, select **MacBook Pro 14-inch M4** in Model settings. **Lid angle**
poses the display between 0° (closed) and 130°. **Open lid during animation**
starts closed at timeline zero and eases to that angle over **Opening duration**.
This uses the same renderer in the live editor, still/video export and MCP.
The angle and duration are preserved in saved projects. Existing phone presets
still move the complete device; the lid opening is independent of that motion.

MCP renders accept optional `lidAngle` and `lidOpenDuration` in seconds. An opening
duration of 0 or an omitted duration holds the selected angle. A still with an
opening duration is the first (closed) frame of that opening.

In the studio Blender file, select `LAPTOP_ROOT__animate_this` and use its custom
property **lid_open_degrees**. The supplied action opens/closes during frames
1–180 at 30 fps. Mute or remove this action to pose the custom property manually.
The saved frame is 90, showing the open laptop. Keep the root to move the whole
laptop; `base` stays rigid while `lid_hinge` carries the complete display assembly.

In the web Blender file or glTF, set `lid_hinge.rotation.x = -angle * π / 180`.
The hinge rotates about local X. Do not collapse this hierarchy or re-centre it
after every pose: doing so makes the base slide as the lid moves. The app's
primary GLB contains no animation, camera, light, floor or backdrop. The separate
`macbook-pro-14-m4-animated.glb` intentionally includes `Lid_Open_Close` for other
viewers and animation workflows.

## Screen media

Exactly one mesh, mesh data block and web material is named `screen`. It is a
flat 302.4 × 196.4 mm surface with upright native 0–1 UVs and a 3024 × 1964 aspect.
The notch is the separate `camera_cutout` and moves with the lid. There is no glass
pane in front of the video. The catalogue uses `uv: upright`: the renderer
compensates for its historical texture rotation using the local UV coordinates,
so changing the hinge cannot reproject, crop or distort the media.

For Blender, replace the packed demo image on **MAT_SCREEN_VIDEO → REPLACE_MEDIA**
with a picture or movie. Auto Refresh is enabled. No textures need to be linked
from a separate folder to open the delivered Blender project or either GLB.

## Dimensions and confidence

Apple's nominal closed enclosure is **312.6 × 221.2 × 15.5 mm**. Its specified
254 ppi and 3024 × 1964 resolution give a **302.4 × 196.4 mm** rectangular display.
The top two active-area corners are rounded; the lower corners are square.
Feet project approximately 1.5 mm below the enclosure, consistently with Apple's
side image. The logo uses an 80-micrometre surface offset to avoid browser depth artifacts;
small inlays also sit slightly above their surfaces.
The complete mesh bounds therefore differ from the nominal enclosure dimensions.

No complete public dimensioned manufacturing drawing was located. Main dimensions
come directly from Apple. Side-port coordinates are calibrated against Apple's
orthographic charging/expansion image (221.2 mm over 956 pixels). Closed-lid outline
and logo use Apple's product image; display, hinge arrangement and eight bottom
screws use Apple's service illustrations. Keyboard layout, trackpad, clearances,
radii and hinge-axis location are reference-derived estimates with a working
tolerance of about 0.5–1.5 mm depending on the source; these are not independently
verified manufacturing tolerances. The 0–130° working range is tested on
this asset; it is not presented as an Apple-certified mechanical stop angle.
The model represents the exterior and rigid articulation, not internal flex
cables, friction, hardware internals or a repair-ready CAD assembly.

Sources, pixel measurements and tolerances are recorded in `references.json`.
Verification uses actual geometry imported from the exported GLB, not just build
constants. `qa/validation.json` records dimensions, screen UVs, the hierarchy,
physical port openings, 27 hinge poses, collision tests against the chassis/keys/trackpad, and fixed-base
invariance. The concealed hinge mounts are intentionally excluded from this
external collision test because mating hinge components meet at the pivot.
Studio views and reference comparisons live in `qa/`; actual editor preset and
catalogue results live in `qa/app/`. The test quadrants confirm media orientation
in the browser and the saved-project test verifies both articulation settings.

## Proportion correction after visual review

The original model met its outer dimensions, but those checks did not independently
validate the silhouette. The lower enclosure roll was too square, the feet were
placed too near the edges, and the opened display stood approximately 7 mm too
high. The original hero image also used an orthographic camera.

The revised model follows measured source pixels from Apple's closed side/front
images and 90-degree open side elevation. It uses a roughly 6 mm lower roll,
tapered feet at X ±129 / Y ±83 mm, and hinge pivot (0, 107.8, 6.6) mm. Rear display
clearance is shaped around that pivot. The closed enclosure remains 15.5 mm high.
At 90 degrees the lid runs from 3.8 to 225.0 mm above the base underside, matching
the source-image estimates of 3.73 and 225.46 mm within the image tolerance.

The reference-profile test fails the original GLB and passes the revised export.
Maximum sampled silhouette error fell from 3.62 to 0.26 mm on the side and from
3.69 to 0.50 mm at the front. These figures describe agreement with image pixels,
not independently measured manufacturing accuracy. All 27 hinge poses are tested
again for chassis collisions, table clearance and fixed-base motion. Rig matrices
are checked for shear, nonuniform scaling and lid centring.

`qa/proportions-comparison.jpg` aligns reference and model at the same physical
scale. `qa/profile-revision.json` records the original and corrected geometry
hashes and measured errors. The main example now uses a 65 mm perspective camera;
the measurement views remain orthographic. A straight-on perspective example is
also provided in `previews/macbook-pro-14-m4_front-perspective.png`.

## Rebuild

1. Run `python3 assets/models/macbook-pro-14-m4/make_media.py` (Pillow required).
2. In Blender background mode run `build.py`, then open the studio file and run
   `export_web.py`. `assets/models/common/blender_batch.py` is the batch wrapper
   used on this host to avoid an audio shutdown hang.
3. Run `validate.py` in an empty Blender instance. Render `render.py final` and
   `render.py audit` from the studio file. `render.py animation` is an optional
   offline Cycles opening/closing sequence.
4. Run `npm run check` and `npm run build` in `client/`, then `npm run build` in
   `mcp/`. Run `npx playwright test tests/laptop-hinge.spec.ts` in `client/`.
5. Run `node mcp/scripts/render-model-check.mjs macbook-pro-14-m4
   assets/models/macbook-pro-14-m4/screen-demo.png
   assets/models/macbook-pro-14-m4/qa/app` from the repo root.

`export-stats.json` and `validation-summary.json` contain the measured final
file size, triangle count and verification results.
