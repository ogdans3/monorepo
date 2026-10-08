"""Derive the full-screen creative variant without changing the audited body.
Run through assets/models/common/blender_batch.py. No external files required.
"""
import bpy, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE=ROOT/'assets/models/pixel-9-pro'
STUDIO_NODES=['camera_cutout','front_lens','front_lens_pupil']
WEB_NODES=['camera_cutout','front_lens','front_lens_pupil']
report={'variant':'Pixel 9 Pro Full Screen','intent':'Creative mockup variant; front camera cutout and optics removed, not a physical Google device.'}
def fingerprint(o):
    mesh=o.data
    return hashlib.sha256(repr((list(o.matrix_world),[tuple(v.co) for v in mesh.vertices],
        [tuple(p.vertices) for p in mesh.polygons],
        [[tuple(d.uv) for d in layer.data] for layer in mesh.uv_layers])).encode()).hexdigest()
def remove_only(names):
    before={o.name:fingerprint(o) for o in bpy.data.objects if o.type=='MESH' and o.name not in names}
    for name in names:
        obj=bpy.data.objects.get(name)
        assert obj is not None,name
        bpy.data.objects.remove(obj,do_unlink=True)
    after={o.name:fingerprint(o) for o in bpy.data.objects if o.type=='MESH'}
    assert before==after,'Unrelated geometry changed'
    return {'removed':names,'unchanged_meshes':len(after),'all_remaining_geometry_transforms_and_uvs_identical':True}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'pixel-9-pro-studio.blend'))
report['studio']=remove_only(STUDIO_NODES)
demo=bpy.data.objects['screen'].active_material.node_tree.nodes['REPLACE_MEDIA'].image
assert demo.packed_file, 'Demo image must be packed for a portable build'
(OUT/'screen-demo.png').write_bytes(demo.packed_file.data)
for scene in bpy.data.scenes:scene['variant']='Full Screen — no front camera cutout'
for image in bpy.data.images:
    if image.source=='FILE' and image.has_data and not image.packed_file:image.pack()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pixel-9-pro-full-screen-studio.blend'),compress=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'pixel-9-pro-web.blend'))
report['web']=remove_only(WEB_NODES)
bpy.context.scene['source']='Audited Pixel 9 Pro web asset; only front island and optics removed'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pixel-9-pro-full-screen-web.blend'),compress=True)
path=ROOT/'client/static/pixel-9-pro-full-screen.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,
 export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',
 export_image_format='AUTO',export_cameras=False,export_lights=False,export_animations=False,
 export_draco_mesh_compression_enable=False)
report['glb_bytes']=path.stat().st_size
report['glb_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
report['triangles']=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
(OUT/'qa/geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
