"""Read GLB JSON, re-import the exported bytes, test the loading contract, render it."""
import bpy,json,struct,math,re
from pathlib import Path
from mathutils import Vector,Matrix
import sys
id=sys.argv[sys.argv.index('--')+1]
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models'/id;path=ROOT/'client/static'/(id+'.glb')
stats=json.loads((OUT/'export-stats.json').read_text());PW,PH=stats['native_pixels'];W=stats['body_dimensions_mm']['width'];H=stats['body_dimensions_mm']['height']
d=path.read_bytes();magic,version,length=struct.unpack_from('<III',d,0)
j=json.loads(d[20:20+struct.unpack_from('<I',d,12)[0]])
checks={}
def check(name,value,details=None):checks[name]={'passed':bool(value),'details':details}
check('binary_gltf_2',magic==0x46546c67 and version==2 and length==len(d))
check('under_10_MB',len(d)<10_000_000,len(d))
for key in ['nodes','meshes','materials']:
    found=[x.get('name','') for x in j.get(key,[]) if 'screen' in x.get('name','').lower()]
    check('unique_screen_'+key,found==['screen'],found)
for key in ['cameras','animations']:check('no_'+key,not j.get(key))
check('no_lights',not j.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights'))
forbidden={'KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_meshopt_compression','KHR_texture_basisu'}
check('no_decoder_extensions',not forbidden.intersection(j.get('extensionsUsed',[])+j.get('extensionsRequired',[])),j.get('extensionsUsed',[]))
check('self_contained',all(not x.get('uri') for key in ['buffers','images'] for x in j.get(key,[])))
check('opaque_materials',all(m.get('alphaMode','OPAQUE')=='OPAQUE' and not m.get('extensions',{}).get('KHR_materials_transmission') for m in j['materials']))
check('opaque_parts_backface_culled',all(not m.get('doubleSided',False) for m in j['materials']))
check('binary_metallic',all(m.get('pbrMetallicRoughness',{}).get('metallicFactor',1) in [0,1] for m in j['materials']))
sm=next(m for m in j['materials'] if m.get('name')=='screen')
check('screen_placeholder',not any(k.endswith('Texture') for k in sm.get('pbrMetallicRoughness',{})) and abs(sm['pbrMetallicRoughness']['roughnessFactor']-.15)<1e-5)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
s=bpy.context.scene;meshes=[o for o in s.objects if o.type=='MESH']
check('phone_meshes_only',all(o.type=='MESH' for o in s.objects),len(s.objects))
names=lambda o:[o.name,o.data.name]+[m.name for m in o.data.materials]
found=[o.name for o in meshes if any('screen' in n.lower() for n in names(o))]
check('screen_matching_only',found==['screen'],found)
check('lowercase_part_names',all(re.fullmatch('[a-z][a-z0-9_]*',n) for o in meshes for n in names(o)))
check('applied_transforms',all(all(abs(v)<1e-6 for v in o.rotation_euler) and all(abs(v-1)<1e-6 for v in o.scale) for o in meshes))
screen=bpy.data.objects['screen'];points=[screen.matrix_world@v.co for v in screen.data.vertices]
w=max(p.x for p in points)-min(p.x for p in points);h=max(p.z for p in points)-min(p.z for p in points)
check('native_screenshot_aspect',abs(w/h-PW/PH)<1e-6,{'width_mm':w*1000,'height_mm':h*1000,'ratio':w/h,'reference_ratio':PW/PH})
check('screen_single_material',[m.name for m in screen.data.materials]==['screen'])
normal=sum(((screen.matrix_world.to_3x3()@p.normal)*p.area for p in screen.data.polygons),Vector()).normalized()
check('screen_front_normal',(normal-Vector((0,-1,0))).length<1e-5,list(normal))
check('every_screen_face_points_outward',all((screen.matrix_world.to_3x3()@p.normal).dot(Vector((0,-1,0)))>.9999 for p in screen.data.polygons))
check('screen_flat',max(p.y for p in points)-min(p.y for p in points)<1e-7)
bezel=bpy.data.objects['bezel']
clearance=min((bezel.matrix_world@v.co).y for v in bezel.data.vertices)-max(p.y for p in points)
check('display_depth_clearance',clearance>=.000040,{'mm':clearance*1000,'minimum_mm':.04})
logos=[o for o in meshes if o.name.startswith('brand_')]
back_y=max((bpy.data.objects['back_glass'].matrix_world@v.co).y for v in bpy.data.objects['back_glass'].data.vertices)
logo_gap=min((o.matrix_world@v.co).y for o in logos for v in o.data.vertices)-back_y
check('logo_depth_clearance',logo_gap>=.000040,{'mm':logo_gap*1000,'minimum_mm':.04})
check('logo_faces_outward',all((o.matrix_world.to_3x3()@p.normal).dot(Vector((0,1,0)))>.9999 for o in logos for p in o.data.polygons))
uv=screen.data.uv_layers.active;x0=min(p.x for p in points);z0=min(p.z for p in points)
err=max(abs(a-b) for loop in screen.data.loops for a,b in zip(uv.data[loop.index].uv,((points[loop.vertex_index].x-x0)/w,(points[loop.vertex_index].z-z0)/h)))
check('upright_uv_0_1',err<1e-5,err)
allpts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(p[k] for p in allpts) for k in range(3)]);hi=Vector([max(p[k] for p in allpts) for k in range(3)])
center=(lo+hi)/2;check('centred',center.length<.001,list(center*1000))
check('real_scale',abs(hi.z-lo.z-H*.001)<.001 and abs(hi.x-lo.x-W*.001)<.001,list((hi-lo)*1000))
tri=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
check('triangle_limit',tri<=200000,tri);check('preferred_triangle_budget',20000<=tri<=100000,tri)
cut=bpy.data.objects['camera_cutout'];cy=min((cut.matrix_world@v.co).y for v in cut.data.vertices)
check('camera_cutout_in_front',.00007<points[0].y-cy<.00013,(points[0].y-cy)*1000)
report={'all_passed':all(x['passed'] for x in checks.values()),'checks':checks,'triangles':tri,'bytes':len(d)}
(OUT/'qa/validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('WEB_VALIDATION',json.dumps(report),flush=True)
if not report['all_passed']:raise RuntimeError('PhoneMockup GLB contract failed')
