"""Export the web Blender source to the app's static directory.

From the repository root:
blender -b assets/models/iphone-16-pro/iphone-16-pro-web.blend \
    --python assets/models/iphone-16-pro/export_glb.py
"""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[3]
scene = bpy.context.scene
assert all(obj.type == 'MESH' for obj in scene.objects), 'Open the web source, not the studio scene'
screens = [obj for obj in scene.objects if 'screen' in obj.name.lower()]
assert [obj.name for obj in screens] == ['screen']
assert screens[0].data.name == 'screen'
assert [m.name for m in screens[0].data.materials] == ['screen']

bpy.ops.export_scene.gltf(
    filepath=str(root / 'client/static/iphone-16-pro.glb'),
    export_format='GLB',
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_draco_mesh_compression_enable=False,
)
