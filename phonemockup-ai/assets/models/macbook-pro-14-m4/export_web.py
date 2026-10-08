"""Preserve base/lid_hinge hierarchy; export a static compatible GLB and separate animated demo."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ID='macbook-pro-14-m4';repo=Path(__file__).resolve().parents[3];out=Path(__file__).parent
source=bpy.data.collections['LAPTOP_'+ID];root=bpy.data.objects['LAPTOP_ROOT__animate_this'];root.animation_data_clear();root['lid_open_degrees']=105;root.update_tag();bpy.context.view_layer.update()
hinge=bpy.data.objects['lid_hinge'];hinge.driver_remove('rotation_euler',0);hinge.rotation_euler.x=-math.radians(105);bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
web=bpy.data.scenes.new('WEB_MacBook_Pro');coll=bpy.data.collections.new('macbook_pro_14_m4');web.collection.children.link(coll)
newroot=bpy.data.objects.new('web_laptop_root',None);coll.objects.link(newroot)
newbase=bpy.data.objects.new('web_base',None);coll.objects.link(newbase);newbase.parent=newroot
newhinge=bpy.data.objects.new('web_lid_hinge',None);coll.objects.link(newhinge);newhinge.parent=newroot;newhinge.location=hinge.location.copy();newhinge.rotation_euler=hinge.rotation_euler.copy()
newhinge['axis']='X';newhinge['opening_sign']=-1;newhinge['default_angle_degrees']=105;newhinge['range_degrees']=[0,130]
mats={}
for o in list(source.all_objects):
 if o.type!='MESH':continue
 mesh=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
 target=newhinge if o.parent==hinge else newbase
 parentworld=hinge.matrix_world if o.parent==hinge else Matrix.Identity(4)
 mesh.transform(parentworld.inverted()@o.matrix_world);mesh.update();mesh.materials.clear()
 if o.name=='screen':
  depth=sum(v.co.z for v in mesh.vertices)/len(mesh.vertices)
  for v in mesh.vertices:v.co.z=depth
  mesh.update()
 for old in o.data.materials:
  if old is None:old=next(m for m in o.data.materials if m)
  name='screen' if o.name=='screen' else old.name
  if name not in mats:
   if name=='screen':
    mat=bpy.data.materials.new('web_screen');mat.use_nodes=True;p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.003,.003,.003,1);p.inputs['Roughness'].default_value=.15
   else:mat=old.copy();mat.name='web_'+name
   mat.use_backface_culling=True;mat['final_name']=name;mats[name]=mat
  mesh.materials.append(mats[name])
 obj=bpy.data.objects.new('web_'+o.name,mesh);coll.objects.link(obj);obj.parent=target;obj['final_name']=o.name
bpy.context.window.scene=web
# Merge repeated components into semantic meshes and cut draw calls.
for prefix,name in [('web_key_','keyboard_keys'),('web_rear_vent_fin_','rear_vent_fins')]:
 group=[o for o in coll.objects if o.type=='MESH' and o.name.startswith(prefix)]
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0]['final_name']=name
 if name=='keyboard_keys':group[0]['key_count']=78
contacts=[o for o in coll.objects if o.type=='MESH' and ('_contact_' in o.name or 'magsafe_pin_' in o.name)]
bpy.ops.object.select_all(action='DESELECT')
for o in contacts:o.select_set(True)
bpy.context.view_layer.objects.active=contacts[0];bpy.ops.object.join();contacts[0]['final_name']='connector_contacts'
for sc in list(bpy.data.scenes):
 if sc!=web:bpy.data.scenes.remove(sc)
for o in list(bpy.data.objects):
 if o.name not in coll.objects:bpy.data.objects.remove(o,do_unlink=True)
for c in list(bpy.data.collections):
 if c!=coll:bpy.data.collections.remove(c)
bpy.data.orphans_purge(do_recursive=True)
newroot.name='laptop_root';newbase.name='base';newhinge.name='lid_hinge'
for o in coll.objects:
 if o.type=='MESH':o.name=o.pop('final_name');o.data.name=o.name
for m in mats.values():
 if m.users:m.name=m.pop('final_name')
bpy.context.view_layer.update()
pts=[o.matrix_world@v.co for o in coll.objects if o.type=='MESH' for v in o.data.vertices];lo=Vector([min(v[i] for v in pts) for i in range(3)]);hi=Vector([max(v[i] for v in pts) for i in range(3)]);newroot.location=-(lo+hi)/2
for text in list(bpy.data.texts):bpy.data.texts.remove(text)
bpy.data.texts.new('START_HERE.txt').write('Rig hierarchy: laptop_root > base, lid_hinge. Set lid_hinge.rotation_euler.x = -radians(opening_degrees). Range 0–130, default 105. Do not transform mesh vertices or collapse this hierarchy. screen has upright native 0–1 UVs; app layer uses uv: upright.\n')
web.unit_settings.system='METRIC';web.unit_settings.length_unit='MILLIMETERS';web.render.fps=30;web.frame_start=1;web.frame_end=180
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/(ID+'-web.blend')),compress=True)
settings=dict(export_format='GLB',export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=False,export_extras=True)
path=repo/'client/static'/(ID+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_animations=False,**settings)
stats={'device':ID,'closed_enclosure_mm':[312.6,221.2,15.5],'feet_projection_mm':1.5,'native_pixels':[3024,1964],'screen_mm':[302.4,196.4],'hinge_pivot_blender_mm':[0,107.8,6.6],'working_angle_degrees':[0,130],'default_angle_degrees':105,'triangles':sum(len(f.vertices)-2 for o in coll.objects if o.type=='MESH' for f in o.data.polygons),'mesh_objects':len([o for o in coll.objects if o.type=='MESH']),'glb_bytes':path.stat().st_size,'pose_bounds_mm':list((hi-lo)*1000)}
(out/'export-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
# Explicit separate demo file: animations are intentionally absent from the app's primary GLB.
for frame,angle in [(1,0),(15,0),(75,105),(115,105),(165,0),(180,0)]:
 newhinge.rotation_euler.x=-math.radians(angle);newhinge.keyframe_insert(data_path='rotation_euler',frame=frame)
newhinge.animation_data.action.name='Lid_Open_Close';web.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(out/(ID+'-animated.glb')),export_animations=True,export_frame_range=True,export_force_sampling=True,**settings)
cat={'id':ID,'name':'MacBook Pro 14-inch M4','modelPath':'/'+ID+'.glb','defaultPosition':{'x':0,'y':0,'z':2.10},'defaultRotation':{'x':16,'y':-16,'z':0},'layers':[{'match':'screen','material':'video','uv':'upright'}],'caseColor':None,'hinge':{'node':'lid_hinge','minAngle':0,'maxAngle':130,'defaultAngle':105},'lidAngle':105}
(repo/'client/src/lib/models/3d-models'/(ID+'.model.json')).write_text(json.dumps(cat,indent=2)+'\n')
print('EXPORT_STATS',json.dumps(stats),flush=True)
