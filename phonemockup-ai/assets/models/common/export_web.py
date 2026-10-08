"""Derive a PhoneMockup web GLB from a studio file without changing that master.
blender -b <id>-studio.blend --python blender_batch.py -- export_web.py <id>
"""
import bpy,sys,math,json,bmesh
from pathlib import Path
from mathutils import Matrix,Vector
id=sys.argv[sys.argv.index('--')+1];root=Path(__file__).resolve().parents[3];out=root/'assets/models'/id
s=bpy.data.scenes['01_MOCKUP_'+id];bpy.context.window.scene=s
body=list(s['body_mm']);pixels=list(s['native_pixels']);omit=json.loads(s['web_omit']);device=s['device']
asset=bpy.data.collections['PHONE_'+id];source=list(asset.all_objects);dg=bpy.context.evaluated_depsgraph_get()
web=bpy.data.scenes.new('phonemockup_web_export');coll=bpy.data.collections.new(id.replace('-','_'));web.collection.children.link(coll)
turn=Matrix.Rotation(math.pi/2,4,'X');mats={}
for o in source:
    if o.type!='MESH' or o.name in omit:continue
    mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
    mesh.transform(turn@o.matrix_world);mesh.materials.clear();mesh.update()
    if o.name=='screen':
        # Eliminate the float32 cos(pi/2) residue: the media plane is exactly planar.
        depth=sum(v.co.y for v in mesh.vertices)/len(mesh.vertices)
        for v in mesh.vertices:v.co.y=depth
        mesh.update()
    key='screen' if o.name=='screen' else o.active_material.name
    if key not in mats:
        m=bpy.data.materials.new('web_'+key);m.use_nodes=True;m.use_backface_culling=True;m['final_name']=key
        p=m.node_tree.nodes.get('Principled BSDF');old=o.active_material.node_tree.nodes.get('Principled BSDF')
        for name in ['Base Color','Metallic','Roughness','Coat Weight','Coat Roughness','Specular IOR Level']:
            if old:p.inputs[name].default_value=old.inputs[name].default_value
        if key=='screen':p.inputs['Base Color'].default_value=(.003,.003,.003,1);p.inputs['Roughness'].default_value=.15;p.inputs['Metallic'].default_value=0
        p.inputs['Transmission Weight'].default_value=0;p.inputs['Alpha'].default_value=1;m.diffuse_color=p.inputs['Base Color'].default_value;mats[key]=m
    mesh.materials.append(mats[key]);obj=bpy.data.objects.new('web_'+o.name,mesh);coll.objects.link(obj);obj['final_name']=o.name
    for f in mesh.polygons:f.material_index=0
    # Preserve evaluated custom split normals, including weighted normals around
    # the drilled frame ports. Rebuilding this mesh with BMesh discarded them
    # and created visible diagonal reflections in the app's software renderer.
    if o.name.startswith('brand_'):
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-9)
        bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
        bmesh.ops.dissolve_degenerate(bm,dist=1e-10,edges=list(bm.edges));bm.normal_update()
        bmesh.ops.reverse_faces(bm,faces=[f for f in bm.faces if f.normal.y<0])
        bm.to_mesh(mesh);bm.free();mesh.update()
bpy.context.window.scene=web
# One low-specular black cutout material keeps the selfie mask black under app lighting.
cut=bpy.data.objects['web_camera_cutout'];m=bpy.data.materials.new('camera_cutout_coating');m.use_nodes=True;m.use_backface_culling=True
p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.001,.001,.001,1);p.inputs['Roughness'].default_value=.28;p.inputs['Specular IOR Level'].default_value=.05
cut.data.materials.clear();cut.data.materials.append(m)
# Collapse repetitive microscopic components into useful semantic layers.
for prefix,name in [('usb_c_contact_','usb_c_contacts'),('bottom_speaker_mesh_','speaker_grille')]:
    group=[o for o in coll.objects if o['final_name'].startswith(prefix)]
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0]['final_name']=name
for sc in list(bpy.data.scenes):
    if sc!=web:bpy.data.scenes.remove(sc)
for o in list(bpy.data.objects):
    if o.name not in coll.objects:bpy.data.objects.remove(o,do_unlink=True)
for c in list(bpy.data.collections):
    if c!=coll:bpy.data.collections.remove(c)
bpy.data.orphans_purge(do_recursive=True)
for o in coll.objects:o.name=o.pop('final_name');o.data.name=o.name
for m in mats.values():
    if m.users:m.name=m.pop('final_name')
pts=[v.co for o in coll.objects for v in o.data.vertices];lo=Vector([min(p[k] for p in pts) for k in range(3)]);hi=Vector([max(p[k] for p in pts) for k in range(3)]);center=(lo+hi)/2
for o in coll.objects:
    for v in o.data.vertices:v.co-=center
    o.data.update()
screen=bpy.data.objects['screen'];vs=[v.co for v in screen.data.vertices];x0=min(p.x for p in vs);z0=min(p.z for p in vs);w=max(p.x for p in vs)-x0;h=max(p.z for p in vs)-z0
while screen.data.uv_layers:screen.data.uv_layers.remove(screen.data.uv_layers[0])
uv=screen.data.uv_layers.new(name='uv')
for loop in screen.data.loops:
    co=screen.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((co.x-x0)/w,(co.z-z0)/h)
for text in list(bpy.data.texts):bpy.data.texts.remove(text)
bpy.data.texts.new('START_HERE.txt').write('Z up, screen toward -Y. Only phone meshes. screen is the only media surface. +Y Up glTF export. See references.json for dimensional confidence.\n')
web.unit_settings.system='METRIC';web.unit_settings.length_unit='MILLIMETERS';web['body_mm']=body;web['native_pixels']=pixels
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/(id+'-web.blend')),compress=True)
path=root/'client/static'/(id+'.glb')
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=False)
cat={'id':id,'name':device.split(' — ')[0],'modelPath':'/'+id+'.glb','defaultPosition':{'x':0,'y':0,'z':round(3-1.42*body[1]*.001,7)},'defaultRotation':{'x':0,'y':0,'z':0},'layers':[{'match':'screen','material':'video','uv':'planar'}],'caseColor':None}
(root/'client/src/lib/models/3d-models'/(id+'.model.json')).write_text(json.dumps(cat,indent=2)+'\n')
stats={'device':device,'body_dimensions_mm':dict(zip(['width','height','depth'],body)),'native_pixels':pixels,'screen_mm':[w*1000,h*1000],'full_bounds_mm':list((hi-lo)*1000),'origin_shift_mm':list(center*1000),'triangles':sum(len(p.vertices)-2 for o in coll.objects for p in o.data.polygons),'mesh_objects':len(coll.objects),'glb_bytes':path.stat().st_size,'omitted_studio_coatings':omit}
(out/'export-stats.json').write_text(json.dumps(stats,indent=2)+'\n');print('EXPORT_STATS',json.dumps(stats),flush=True)
