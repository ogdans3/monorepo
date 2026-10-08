# Building a phone model for PhoneMockup

This is the brief for whoever builds a new phone model for PhoneMockup
(phonemockup.app), including an AI working in Blender. It covers what the file
must contain, what to name things, how to export it and how to check it before
handing it over. The rules come from how the editor loads models
(`client/src/lib/render/scene-renderer.ts`). Break one of the *Must* rules and
the file won't load, or the user's picture ends up in the wrong place.

## What PhoneMockup does with the file

The editor loads a `.glb` with three.js in the browser. It finds the screen by
name and replaces its material with the user's screenshot or screen recording.
It lights the phone with its own studio environment, and it moves and turns the
whole phone as one piece for the animations. Everything else in the file is
shown as it is.

## What to hand over

1. **`<model-id>.glb`**, for example `iphone-16.glb`: lowercase, words joined
   by hyphens.
2. **The catalogue entry** from the end of this guide, filled in.
3. **A short note** with:
   - the device;
   - its real height, width and depth in millimetres;
   - the screenshot resolution the screen was built for, for example
     1179 × 2556;
   - the triangle count and the file size.
4. **A front render** (PNG) of the phone as exported, so it can be judged
   before it is wired in.

## Must

1. **glTF 2.0 Binary (`.glb`)**, with every texture embedded. The editor
   fetches one file.
2. **No Draco, Meshopt or KTX2/Basis compression.** The loader has no decoder
   for any of them, so the file fails to load.
3. **No lights, cameras or animations.** A light in the file would be added to
   the scene and change the lighting.
4. **Only the phone.** No floor, backdrop, reference image or stray vertices.
   Everything in the file appears in every mockup, and the editor centres the
   phone on the box around all of it.
5. **Upright, with the screen facing the front** (see *Orientation*). The
   editor shows the file's front to the camera.
6. **Exactly one object called `screen`**, with mesh data called `screen` and
   one material called `screen`. That name is how the editor finds where the
   picture goes.
7. **No other object, mesh or material name contains `screen`**, in any case.
   The editor matches any name containing `screen`, so a part called
   `screen_border` or `ScreenGlass` would show the picture too.
8. **The screen's outline has the device's screenshot proportions.** The
   picture is stretched to fill the screen's bounds exactly.

## Orientation, scale and origin

- **Real size, in metres.** One Blender unit is one metre, so a typical phone
  is about 0.15 tall.
- **Upright**, with the top of the phone up.
- **Screen toward the front.** In Blender (Z up) the screen faces **−Y**, so you
  look straight at it in Front view (numpad 1). Exported with *+Y Up*, that
  becomes glTF's +Y up and +Z front, which is what the editor expects.
- **Centred on the world origin.** Apply rotation and scale on every object
  (Ctrl+A → Rotation & Scale) so each one ends up with rotation 0 and scale 1.

## The screen

The `screen` object is the lit display area only: the part a screenshot
covers.

- **One flat surface** with no thickness, its normals pointing out toward the
  viewer. Give it the real display's rounded corners, with enough segments that
  they stay round close up (12 or more per corner).
- **Proportions.** The outline's width ÷ height must equal the device's
  screenshot width ÷ height (1179 ÷ 2556 for an iPhone 16). The picture fills
  the outline's bounding rectangle, and the rounded corners clip it as they do
  on the real phone.
- **Placement.** Put it just in front of the bezel around it, so nothing covers
  it.
- **No cover glass.** Don't put a separate glass object in front of the
  screen. The editor has its own glass-reflection option for the screen, and a
  transparent pane over it dims the picture and costs render time.
- **Camera cutout** (Dynamic Island, punch hole). Make it a separate black
  object called `camera_cutout`, about 0.1 mm in front of the screen, not a hole
  in the screen.
- **Material.** `screen` is plain near-black and glossy (roughness about
  0.15), with no texture. It only shows until the user's picture loads. If you
  put a test picture on it while checking, take it off before exporting.
- **UVs.** Give it one UV map, a front projection that fills the whole 0–1
  square, with the picture upright in Blender's UV editor (the screen's
  bottom-left corner at 0,0). The editor projects the picture from the front
  itself, so these UVs are for every other viewer. This sets them exactly:

```python
import bpy, bmesh

obj = bpy.data.objects["screen"]
bm = bmesh.new()
bm.from_mesh(obj.data)
uv = bm.loops.layers.uv.verify()
points = [obj.matrix_world @ v.co for v in bm.verts]
x0, x1 = min(p.x for p in points), max(p.x for p in points)
z0, z1 = min(p.z for p in points), max(p.z for p in points)
for face in bm.faces:
    for loop in face.loops:
        p = obj.matrix_world @ loop.vert.co
        loop[uv].uv = ((p.x - x0) / (x1 - x0), (p.z - z0) / (z1 - z0))
bm.to_mesh(obj.data)
bm.free()
```

## Names

- **Name every object and material after the part it is**, in lowercase with
  underscores. For example: `frame`, `back_glass`, `camera_bump`, `lens_main`,
  `flash`, `side_button`, `volume_buttons`, `bezel`, `camera_cutout`,
  `speaker_grille`, `logo`.
- **No Blender default names** such as `Cube.003` or `Material.001`. Part names
  keep the file readable and let parts be targeted by name later.
- **Name materials by part, never by colour.** The colour picker skips any
  material named exactly `white`.

## Materials and textures

- **Principled BSDF only.** Connect image textures straight to its inputs: Base
  Color, Metallic, Roughness and Normal. Ambient occlusion goes through
  Blender's glTF Material Output node. Procedural nodes and other shaders don't
  survive the export.
- **Physically plausible values.** Metallic is 1 for bare metal and 0 for
  everything else.
- **Opaque materials.** No Transmission and no alpha-blended glass: in the
  browser they render slowly and sort badly. Make lens covers and the back glass
  dark, glossy and opaque.
- **No baked lighting in Base Color.** The editor lights the phone itself with
  a studio room, two soft key lights and a filmic tone curve, so baked
  highlights and shadows would be lit twice. Ambient occlusion in its own
  texture is fine.
- **Recolouring.** The editor's colour picker sets the base colour of every
  material except the screen, and multiplies it into any colour texture. A part
  with a plain base colour and no colour texture takes a picked colour exactly.
- **Textures.** Use JPEG, and PNG only where alpha is needed. Keep each one at
  2048 × 2048 or smaller.

## Budget

- **File size:** under 10 MB, ideally around 5 MB. Every visitor downloads the
  file before they see the phone.
- **Triangles:** 20,000–100,000, and never more than 200,000. Exports render at
  up to 4K, sometimes without a graphics card.
- **Shading:** bevels and subdivision are applied on export. Shade curved
  surfaces smooth (Smooth by Angle).

## Exporting from Blender

Use File → Export → glTF 2.0 (.glb/.gltf) with these settings:

- Format: **glTF Binary (.glb)**
- Include: Cameras **off**, Punctual Lights **off**
- Transform: **+Y Up** on
- Data → Mesh: **Apply Modifiers** on, **UVs** on, **Normals** on
- Data → Material: Materials **Export**, Images **Automatic** (or JPEG)
- Data → Compression: **off**
- Animation: **off**

The same export from Python:

```python
import bpy

bpy.ops.export_scene.gltf(
    filepath="/path/to/iphone-16.glb",
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_draco_mesh_compression_enable=False,
)
```

## Check before handing over

First, read the file itself. This runs in Blender's Python console or in plain
Python:

```python
import json, struct

path = "/path/to/iphone-16.glb"
data = open(path, "rb").read()
gltf = json.loads(data[20:20 + struct.unpack_from("<I", data, 12)[0]])
print("Size: %.1f MB" % (len(data) / 1e6))
print("Extensions required:", gltf.get("extensionsRequired", []))
print("Cameras:", len(gltf.get("cameras", [])), " Animations:", len(gltf.get("animations", [])),
      " Lights:", len(gltf.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", [])))
```

It passes when:
- the size is under 10 MB;
- the required extensions include none of `KHR_draco_mesh_compression`,
  `EXT_meshopt_compression` or `KHR_texture_basisu`;
- there are no cameras, animations or lights.

Then import the `.glb` into an empty scene (File → New → General, and delete
the cube, camera and light) and run:

```python
import bpy
from mathutils import Vector

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

def names(o):
    return [o.name, o.data.name] + [s.material.name for s in o.material_slots if s.material]

print("Named 'screen':", [o.name for o in meshes if any("screen" in n.lower() for n in names(o))])

screen = bpy.data.objects.get("screen")
if screen:
    pts = [screen.matrix_world @ v.co for v in screen.data.vertices]
    w = max(p.x for p in pts) - min(p.x for p in pts)
    h = max(p.z for p in pts) - min(p.z for p in pts)
    normal = sum((screen.matrix_world.to_3x3() @ p.normal for p in screen.data.polygons), Vector())
    print("Screen: %.1f x %.1f mm, width/height %.4f" % (w * 1000, h * 1000, w / h))
    print("Screen materials:", [s.material.name for s in screen.material_slots if s.material])
    print("Screen faces:", tuple(round(c, 2) for c in normal.normalized()))

corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = [min(c[i] for c in corners) for i in range(3)]
hi = [max(c[i] for c in corners) for i in range(3)]
print("Phone (mm): width %.1f, depth %.1f, height %.1f" % tuple((hi[i] - lo[i]) * 1000 for i in range(3)))
print("Centre (mm):", [round((hi[i] + lo[i]) / 2 * 1000, 1) for i in range(3)])
print("Triangles:", sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
```

It passes when:
- *Named 'screen'* is exactly `['screen']`;
- the screen's width/height equals the screenshot's (1179 / 2556 = 0.4613 for
  an iPhone 16);
- its only material is `screen`;
- it faces `(0, -1, 0)`;
- the phone's size is the real device's;
- the centre is within a millimetre of `0, 0, 0`;
- the triangle count is within the budget.

Last, open the file in a three.js viewer such as
<https://gltf-viewer.donmccurdy.com/>. The editor uses three.js too, so if the
phone looks right there it will look right in PhoneMockup, apart from the
screen's content.

## The catalogue entry

This part is for the developer wiring the file in. Each model is one JSON file
in `client/src/lib/models/3d-models/`, named `<id>.model.json`:

```json
{
    "id": "iphone-16",
    "name": "iPhone 16",
    "modelPath": "/iphone-16.glb",
    "defaultPosition": {"x": 0, "y": 0, "z": 2.79},
    "defaultRotation": {"x": 0, "y": 0, "z": 0},
    "layers": [
        {"match": "screen", "material": "video", "uv": "planar"}
    ],
    "caseColor": null
}
```

- **`id`** is unique, lowercase and hyphenated. Saved projects store it, so it
  never changes once the model is released.
- **`name`** is what the model picker shows.
- **`modelPath`** is the file in `client/static/`, which the site serves from
  its root.
- **`defaultPosition`** is where the phone's centre rests.
  - The camera sits at z = 3, looks toward −z and has a 45° vertical field of
    view.
  - `z = 3 − 1.42 × height` (height in metres) puts the phone at 85% of the
    frame height, like the iPhones. For an iPhone 16 (0.1476 m tall) that gives
    2.79.
  - Keep x and y at 0.
- **`defaultRotation`** is in degrees, and is 0, 0, 0 for a file built to this
  guide.
- **`layers`** says where the user's picture goes.
  - `"match": "screen"` finds the screen: any object or material whose name
    contains it, in any case.
  - `"material": "video"` puts the user's image or video there.
  - `"uv": "planar"` projects the picture from the front. The editor turns
    media a quarter turn to suit the older models' UVs, so a file with ordinary
    upright UVs needs it.
- **`caseColor`**: `null` keeps the file's own colours, and a hex colour paints
  the phone on load.

Then:
1. Import the JSON in `3d-models-spec.ts` and add it to `models`.
2. Put the `.glb` in `client/static/`.
3. Rebuild the MCP (`npm run build` in `mcp/`) so `list_phone_models` lists the
   new model.
4. Render the model with every preset before shipping it, as `CLAUDE.md` asks.

## Articulated laptops

The phone rules above describe rigid devices. A hinged laptop can additionally
contain named empty/group nodes: `laptop_root`, `base`, and `lid_hinge`. Preserve
the hierarchy and local hinge origin; apply geometry transforms to the individual
meshes without baking the lid into a single rigid object. The default pose is
centred once. `lid_hinge` rotates around local X, with a negative rotation opening
the display. The primary app GLB still has no embedded animations; a separate
animated GLB can be provided as an additional deliverable.

A laptop with validated native glTF UVs uses `uv: upright` on the screen layer.
Unlike `planar`, this does not depend on the screen's pose: it converts the native
glTF UVs to the app's media texture convention once and retains them while the
lid moves. The catalogue can specify `hinge: {node, minAngle, maxAngle,
defaultAngle}` and `lidAngle`. An optional `lidOpenDuration` eases the lid from
its minimum angle at timeline zero to the chosen angle in that many seconds.
The shared renderer handles this for the editor and exports. User selections
are saved with the project. See `docs/models/macbook-pro-14-m4.md` for a tested
reference asset and the separate Blender animation workflow.
