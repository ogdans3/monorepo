"""Validate the actual shipped GLB by importing its bytes, including hinge sweeps."""
import bpy,json,struct,math,hashlib,re,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=Path(__file__).parent;repo=p.resolve().parents[2];path=repo/'client/static/macbook-pro-14-m4.glb'
if '--asset' in sys.argv:path=Path(sys.argv[sys.argv.index('--asset')+1])
report_path=Path(sys.argv[sys.argv.index('--report')+1]) if '--report' in sys.argv else p/'qa/validation.json'
b=path.read_bytes();g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);checks={}
def check(name,ok,details=None):checks[name]={'passed':bool(ok),'details':details}
check('binary_gltf_2',struct.unpack_from('<III',b,0)==(0x46546c67,2,len(b)))
check('under_10_MB',len(b)<10_000_000,len(b))
for kind in ['nodes','meshes','materials']:
 found=[x.get('name') for x in g[kind] if 'screen' in x.get('name','').lower()];check('unique_screen_'+kind,found==['screen'],found)
check('static_app_glb',not g.get('animations') and not g.get('cameras') and not g.get('extensions',{}).get('KHR_lights_punctual'))
check('no_compression_decoders',not set(g.get('extensionsUsed',[]))&{'KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'})
check('self_contained',all(not i.get('uri') for kind in ['images','buffers'] for i in g.get(kind,[])))
check('opaque_materials',all(m.get('alphaMode','OPAQUE')=='OPAQUE' and not m.get('extensions',{}).get('KHR_materials_transmission') for m in g['materials']))
sm=next(m for m in g['materials'] if m.get('name')=='screen');check('blank_media_placeholder','baseColorTexture' not in sm.get('pbrMetallicRoughness',{}))
a=(p/'macbook-pro-14-m4-animated.glb').read_bytes();ag=json.loads(a[20:20+struct.unpack_from('<I',a,12)[0]])
check('separate_open_close_clip',len(ag.get('animations',[]))==1,[x.get('name') for x in ag.get('animations',[])])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));objects=bpy.context.scene.objects
hinge=objects['lid_hinge'];hinge.rotation_mode='XYZ';base=objects['base'];screen=objects['screen'];meshes=[o for o in objects if o.type=='MESH']
check('rig_nodes_preserved',hinge.parent==base.parent and screen.parent==hinge)
check('moving_parts_parented',all(objects[n].parent==hinge for n in ['lid_aluminium','display_bezel','camera_cutout','camera_lens','brand_apple_body','brand_apple_leaf']))
check('base_parts_parented',all(objects[n].parent==base for n in ['base_enclosure','keyboard_keys','trackpad','speaker_grilles']))
check('only_asset_objects',all(o.type in ['MESH','EMPTY'] for o in objects))
check('one_video_material',[m.name for m in screen.data.materials]==['screen'])
check('78_keycaps',objects['keyboard_keys'].get('key_count')==78)
check('triangle_budget',sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)<=100000,sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons))
def points(names):return [objects[name].matrix_world@v.co for name in names for v in objects[name].data.vertices]
def bounds(pts):return [max(v[i] for v in pts)-min(v[i] for v in pts) for i in range(3)]
def pose(deg):hinge.rotation_euler.x=-math.radians(deg);bpy.context.view_layer.update()
pose(0)
check('lid_logo_faces_outward',all((o.matrix_world.to_3x3()@f.normal).z>.999 for o in [objects['brand_apple_body'],objects['brand_apple_leaf']] for f in o.data.polygons))
closed=points(['base_enclosure','lid_aluminium']);dims=[v*1000 for v in bounds(closed)]
check('manufacturer_closed_enclosure',max(abs(a-b) for a,b in zip(dims,[312.6,221.2,15.5]))<.001,dims)
logo_clearance=(min(v.z for v in points(['brand_apple_body','brand_apple_leaf']))-max(v.z for v in points(['lid_aluminium'])))*1000
check('logo_depth_clearance',.05<logo_clearance<.1,{'clearance_mm':logo_clearance})
references=json.loads((p/'references.json').read_text())
frame=objects['base_enclosure'];to_base=base.matrix_world.inverted()@frame.matrix_world
frame_bvh=BVHTree.FromPolygons([to_base@v.co for v in frame.data.vertices],[f.vertices[:] for f in frame.data.polygons])
for ref in references['port_calibration']['measurements']:
 obj=objects[ref['name']+'_well'];local=base.matrix_world.inverted()@obj.matrix_world
 vs=[local@v.co for v in obj.data.vertices];actual=(min(v.y for v in vs)+max(v.y for v in vs))*500
 check('reference_port_'+ref['name'],abs(actual-ref['source_centre_y_mm'])<.65,{'actual_mm':actual,'reference_mm':ref['source_centre_y_mm'],'tolerance_mm':.65})
 # Verify the port is cut into the shell, not merely hidden behind it.
 centre=Vector([(min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)])
 side=1 if centre.x>0 else -1
 hit=frame_bvh.ray_cast(Vector((side*.17,centre.y,centre.z)),Vector((-side,0,0)))[0]
 depth=(.1563-side*hit.x)*1000 if hit is not None else 312.6
 check('open_shell_port_'+ref['name'],depth>1.5,{'shell_recess_mm':depth,'minimum_mm':1.5})
# Compare the actual shell silhouette with independent Apple image measurements.
sections=[]
for name in ['base_enclosure','bottom_case','bottom_case_seam']:
 obj=objects[name];mat=base.matrix_world.inverted()@obj.matrix_world
 verts=[mat@v.co for v in obj.data.vertices]
 sections.extend((verts[e.vertices[0]],verts[e.vertices[1]]) for e in obj.data.edges)
def reference_profile(calibration,axis,half_extent):
 profile=[]
 for sample in calibration['samples']:
  z=sample['height_above_base_mm']/1000;positions=[]
  for va,vb in sections:
   if min(va.z,vb.z)-1e-9<=z<=max(va.z,vb.z)+1e-9:
    if abs(va.z-vb.z)<1e-10:positions.extend([va[axis],vb[axis]])
    else:positions.append(va[axis]+(vb[axis]-va[axis])*(z-va.z)/(vb.z-va.z))
  actual=(min(positions)+half_extent)*1000
  profile.append({**sample,'actual_inset_mm':actual,'absolute_error_mm':abs(actual-sample['inset_mm'])})
 return profile
for name,key,axis,half in [('apple_lower_silhouette','silhouette_calibration',1,.1106),('apple_front_silhouette','front_silhouette_calibration',0,.1563)]:
 profile=reference_profile(references[key],axis,half)
 check(name,max(x['absolute_error_mm'] for x in profile)<references[key]['tolerance_mm'],profile)
check('rig_without_shear_or_nonuniform_scale',all(abs(v.length-1)<1e-5 for o in meshes for v in o.matrix_world.to_3x3().col) and all(abs(o.matrix_world.to_3x3().col[i].dot(o.matrix_world.to_3x3().col[j]))<1e-6 for o in meshes for i,j in [(0,1),(0,2),(1,2)]))
check('lid_centred_across_base',abs(sum([max(v.x for v in points(['lid_aluminium'])),min(v.x for v in points(['lid_aluminium']))])-sum([max(v.x for v in points(['base_enclosure'])),min(v.x for v in points(['base_enclosure']))]))<1e-6)
feet=[]
for obj in objects:
 if obj.name.startswith('foot_'):
  mat=base.matrix_world.inverted()@obj.matrix_world;vs=[mat@v.co for v in obj.data.vertices]
  centre=[(min(v[i] for v in vs)+max(v[i] for v in vs))*500 for i in [0,1]];feet.append(centre)
foot_ref=references['foot_calibration']
check('foot_centres_match_apple',len(feet)==4 and all(min(abs(c[0]-x) for x in foot_ref['source_centres_x_mm'])<foot_ref['tolerance_mm'] and min(abs(c[1]-y) for y in foot_ref['source_centres_y_mm'])<foot_ref['tolerance_mm'] for c in feet),feet)
pose(90)
base_bottom=min(v.z for v in points(['base_enclosure']))
lid_heights=[(min(v.z for v in points(['lid_aluminium']))-base_bottom)*1000,(max(v.z for v in points(['lid_aluminium']))-base_bottom)*1000]
ref=references['open_lid_calibration']
check('open_lid_height_matches_apple',all(abs(actual-expected)<ref['tolerance_mm'] for actual,expected in zip(lid_heights,[ref['lower_edge_above_base_mm'],ref['upper_edge_above_base_mm']])),{'actual_mm':lid_heights,'reference_mm':[ref['lower_edge_above_base_mm'],ref['upper_edge_above_base_mm']],'tolerance_mm':ref['tolerance_mm']})
leaf=points(['brand_apple_leaf']);bodylogo=points(['brand_apple_body'])
check('logo_upright_with_lid_open',sum(v.z for v in leaf)/len(leaf)>sum(v.z for v in bodylogo)/len(bodylogo))
pts=points(['screen']);w,h=bounds(pts)[0],bounds(pts)[2]
check('active_display_mm',abs(w*1000-302.4)<.001 and abs(h*1000-196.4)<.001,[w*1000,h*1000])
check('native_aspect',abs(w/h-3024/1964)<1e-6,w/h)
check('flat_media_surface',bounds(pts)[1]<1e-7)
normal=sum(((screen.matrix_world.to_3x3()@f.normal)*f.area for f in screen.data.polygons),Vector()).normalized();check('front_normal_at_90',(normal-Vector((0,-1,0))).length<1e-5,list(normal))
x0=min(v.x for v in pts);z0=min(v.z for v in pts);uv=screen.data.uv_layers.active
error=max(abs(actual-expected) for loop in screen.data.loops for actual,expected in zip(uv.data[loop.index].uv,((pts[loop.vertex_index].x-x0)/w,(pts[loop.vertex_index].z-z0)/h)))
check('upright_native_UV',error<1e-5,error)
# Fixed base and media coordinates must not drift as the parent hinge is rotated.
base_original=points(['base_enclosure','trackpad']);uv_original=[tuple(x.uv) for x in uv.data]
def tree(obj):
 dg=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(dg);mesh=ev.to_mesh();t=BVHTree.FromPolygons([ev.matrix_world@v.co for v in mesh.vertices],[f.vertices[:] for f in mesh.polygons]);ev.to_mesh_clear();return t
fixed=[(name,tree(objects[name])) for name in ['base_enclosure','keyboard_keys','trackpad']];sweep=[]
for angle in range(0,131,5):
 pose(angle);hits=[]
 for name in ['lid_aluminium','display_bezel','screen','camera_cutout']:
  t=tree(objects[name])
  for bn,bt in fixed:
   if t.overlap(bt):hits.append([name,bn])
 delta=max((v-q).length for v,q in zip(base_original,points(['base_enclosure','trackpad'])))
 clearance=(min(v.z for v in points(['lid_aluminium']))-min(v.z for v in points([o.name for o in objects if o.name.startswith('foot_')])))*1000
 sweep.append({'angle':angle,'collisions':hits,'base_drift_m':delta,'lid_ground_clearance_mm':clearance})
check('27_hinge_poses_without_base_collisions',all(not x['collisions'] for x in sweep),sweep)
check('lid_clears_table',min(x['lid_ground_clearance_mm'] for x in sweep)>=0,min(x['lid_ground_clearance_mm'] for x in sweep))
check('base_stays_fixed',all(x['base_drift_m']<1e-9 for x in sweep))
check('UV_stays_attached',uv_original==[tuple(x.uv) for x in uv.data])
pose(105);pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];center=Vector([(min(v[i] for v in pts)+max(v[i] for v in pts))/2 for i in range(3)])
check('centred_at_default_pose',center.length<.00001,list(center))
report={'all_passed':all(x['passed'] for x in checks.values()),'glb_sha256':hashlib.sha256(b).hexdigest(),'checks':checks,'bytes':len(b)}
report_path.write_text(json.dumps(report,indent=2)+'\n');print('VALIDATION',sum(x['passed'] for x in checks.values()),'/',len(checks),flush=True)
for name,c in checks.items():
 if not c['passed']:print('FAILED',name,c['details'],flush=True)
if not report['all_passed']:raise SystemExit(1)
