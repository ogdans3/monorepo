"""Derive PhoneMockup's browser asset from the audited Blender master.
Does not overwrite the master. Keeps measured external contours unchanged.
"""
import bpy,math,json,re,bmesh
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
RUNTIME=ROOT/'client/static/iphone-16-pro.glb'
bpy.context.window.scene=bpy.data.scenes['01_MOCKUP_iPhone16Pro']
dg=bpy.context.evaluated_depsgraph_get()
source=list(bpy.data.collections['PHONE_iPhone16Pro_NaturalTitanium'].all_objects)
turn=Matrix.Rotation(math.pi/2,4,'X')
web=bpy.data.scenes.new('phonemockup_web_export')
coll=bpy.data.collections.new('iphone_16_pro');web.collection.children.link(coll)
materials={};mapping={}
def clean(s):return re.sub('_+','_',re.sub('[^a-z0-9_]','_',s.lower())).strip('_')
def material(src=None,display=False):
    key='screen' if display else src.name
    if key in materials:return materials[key]
    names={'MAT_Titanium_Natural__brushed':'frame_titanium','MAT_Titanium_Polished_Edges':'polished_trim','MAT_BackGlass_NaturalTitanium__satin':'back_glass','MAT_OLED_Bezel_Black':'bezel_polymer','MAT_Polymer_Seals':'polymer_seals','MAT_Optics_Barrel_Anodized':'lens_barrels','MAT_Port_Interior':'port_interior','MAT_Antenna_Ceramic':'antenna_ceramic','MAT_Connector_Contacts':'connector_contacts','MAT_Flash_Diffuser':'flash_diffuser','MAT_Lens_Optical_Coating':'camera_optics','MAT_Sapphire_Cover':'lens_covers','MAT_Apple_Logo_Inlay':'logo_inlay'}
    name='screen' if display else names[src.name]
    m=bpy.data.materials.new('WEB_'+name);m.use_nodes=True
    # Closed opaque parts need only their outward faces. Drawing rear faces
    # caused isolated camera slivers through the display under SwiftShader.
    m.use_backface_culling=True
    p=m.node_tree.nodes.get('Principled BSDF')
    old=src.node_tree.nodes.get('Principled BSDF') if src else None
    color=tuple(old.inputs['Base Color'].default_value) if old else (.002,.002,.002,1)
    rough=old.inputs['Roughness'].default_value if old else .15
    metal=1 if key.startswith('MAT_Titanium') or any(t in key for t in ['Anodized','Contacts','Logo_Inlay']) else 0
    if 'Sapphire' in key:color=(.005,.008,.014,1);rough=.11
    if display:color=(.003,.003,.003,1);rough=.15;metal=0
    p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Transmission Weight'].default_value=0;p.inputs['Alpha'].default_value=1
    m.diffuse_color=color;m['export_name']=name;materials[key]=m;return m
def box_mesh(o):
    vs=[v.co for v in o.data.vertices];a=[min(v[k] for v in vs) for k in range(3)];b=[max(v[k] for v in vs) for k in range(3)]
    verts=[(a[0],a[1],a[2]),(b[0],a[1],a[2]),(b[0],b[1],a[2]),(a[0],b[1],a[2]),(a[0],a[1],b[2]),(b[0],a[1],b[2]),(b[0],b[1],b[2]),(a[0],b[1],b[2])]
    faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    m=bpy.data.meshes.new('micro_part');m.from_pydata(verts,[],faces);m.update();return m
omit=[]
for o in source:
    if o.type!='MESH':continue
    if o.name.startswith('SCREEN_GLASS') or any(t in o.name for t in ['_Optical_Well','_Optical_Baffle_','_Lens_Element','_Aperture']):
        omit.append(o.name);continue
    display=o.name=='SCREEN_VIDEO__REPLACE_MEDIA'
    special={'BODY_Titanium_Frame':'frame','BODY_BackGlass_Satin':'back_glass','SCREEN_Black_Bezel':'bezel','SCREEN_DynamicIsland__Occluder':'camera_cutout','CAM_Plateau_Integrated_Glass':'camera_bump'}
    name='screen' if display else special.get(o.name,clean(o.name))
    micro=o.name.startswith(('PORT_USB_C_Contact_','FRONT_Receiver_Mesh_'))
    mesh=box_mesh(o) if micro else bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
    if display:
        # Use an explicit convex centre fan instead of automatic n-gon tessellation.
        assert len(mesh.polygons)==1
        border=list(mesh.polygons[0].vertices)
        coords=[tuple(v.co) for v in mesh.vertices]
        center=tuple(sum(v[k] for v in coords)/len(coords) for k in range(3))
        center_index=len(coords)
        fan=bpy.data.meshes.new('display_fan')
        fan.from_pydata(coords+[center],[],[(border[i],border[(i+1)%len(border)],center_index) for i in range(len(border))])
        fan.update();mesh=fan
    mesh.materials.clear()
    mesh.materials.append(material(o.active_material,display))
    for poly in mesh.polygons:poly.material_index=0
    # Exact screenshot aspect is a renderer contract; retain width and adjust height by 0.058 mm.
    if display:
        target_height=.06657*2622/1206
        for v in mesh.vertices:v.co.y*=target_height/.14479
    if o.name in ['SCREEN_DynamicIsland__Occluder','FRONT_Camera_Optical_Lens','FRONT_Camera_Pupil']:
        world=o.matrix_world.copy();world.translation.z+=.000079
    elif o.name=='SCREEN_Black_Bezel':
        # 5 microns underneath the display caused depth fighting in SwiftShader.
        # Recess the black underlay 40 microns; keep the screen/body contours.
        world=o.matrix_world.copy();world.translation.z-=.000040
    elif o.name.startswith('BRAND_Apple_Logo'):
        # Keep the rear inlay clear of the back glass at oblique angles.
        world=o.matrix_world.copy();world.translation.z-=.000040
    else:world=o.matrix_world
    mesh.transform(turn@world);mesh.update()
    if name.startswith('brand_'):
        bm=bmesh.new();bm.from_mesh(mesh);bm.normal_update()
        bmesh.ops.reverse_faces(bm,faces=[f for f in bm.faces if f.normal.y<0])
        bm.to_mesh(mesh);bm.free();mesh.update()
    obj=bpy.data.objects.new('WEB_'+name,mesh);coll.objects.link(obj);obj['export_name']=name
    mapping[o.name]=name
    # Dissolve strictly coplanar tessellation while preserving curved source contours.
    if not display:
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.dissolve_limit(bm,angle_limit=.00001,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False,delimit={'MATERIAL'})
        if name in {'frame','bezel','back_glass','body_front_display_gasket','body_back_glass_gasket'}:
            bm.normal_update()
            caps=[f for f in bm.faces if len(f.verts)>100 and abs(f.normal.y)>.99 and max(v.co.y for v in f.verts)-min(v.co.y for v in f.verts)<1e-7]
            bmesh.ops.poke(bm,faces=caps,offset=0,center_mode='MEAN',use_relative_offset=False)
        bm.to_mesh(mesh);bm.free();mesh.update()

bpy.context.window.scene=web
# The antireflective camera cutout must stay dark under the app's studio IBL.
# A separate Principled material keeps this coating independent of the bezel.
cutout=bpy.data.objects['WEB_camera_cutout']
coating=bpy.data.materials.new('camera_cutout_coating');coating.use_nodes=True
coating.use_backface_culling=True
p=coating.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.001,.001,.001,1)
p.inputs['Metallic'].default_value=0
p.inputs['Roughness'].default_value=.28
p.inputs['Specular IOR Level'].default_value=.05
coating.diffuse_color=(.001,.001,.001,1)
cutout.data.materials.clear();cutout.data.materials.append(coating)
# Keep the audited body/display/plateau profiles intact; reduce only small parts.
protected={'frame','back_glass','bezel','camera_bump','screen','body_front_display_gasket','body_back_glass_gasket'}
for o in list(coll.objects):
    name=o['export_name']
    if name in protected or name.startswith('brand_') or sum(len(p.vertices)-2 for p in o.data.polygons)<100:continue
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('web_small_part_lod','DECIMATE');mod.ratio=.4
    bpy.ops.object.modifier_apply(modifier=mod.name)
# Group repetitive tiny parts to reduce browser draw calls.
for prefix,name in [('port_usb_c_contact_','connector_contacts'),('front_receiver_mesh_','receiver_grille'),('antenna_','antenna_bands')]:
    group=[o for o in coll.objects if o['export_name'].startswith(prefix)]
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0]['export_name']=name
# Delete all authoring scenes and their datablocks from this disposable process.
for scene in list(bpy.data.scenes):
    if scene!=web:bpy.data.scenes.remove(scene)
for o in list(bpy.data.objects):
    if o.name not in coll.objects:bpy.data.objects.remove(o,do_unlink=True)
for c in list(bpy.data.collections):
    if c!=coll:bpy.data.collections.remove(c)
bpy.data.orphans_purge(do_recursive=True)
for o in coll.objects:
    o.name=o.pop('export_name');o.data.name=o.name
for m in materials.values():
    if m.users:m.name=m.pop('export_name')
# Centre the complete phone including camera protrusion, as the editor does.
points=[v.co for o in coll.objects for v in o.data.vertices]
lo=Vector([min(p[k] for p in points) for k in range(3)]);hi=Vector([max(p[k] for p in points) for k in range(3)])
center=(lo+hi)/2
for o in coll.objects:
    for v in o.data.vertices:v.co-=center
    o.data.update()
screen=bpy.data.objects['screen'];vs=[v.co for v in screen.data.vertices]
x0,x1=min(v.x for v in vs),max(v.x for v in vs);z0,z1=min(v.z for v in vs),max(v.z for v in vs)
while screen.data.uv_layers:screen.data.uv_layers.remove(screen.data.uv_layers[0])
uv=screen.data.uv_layers.new(name='uv')
for loop in screen.data.loops:
    p=screen.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((p.x-x0)/(x1-x0),(p.z-z0)/(z1-z0))
web.unit_settings.system='METRIC';web.unit_settings.length_unit='MILLIMETERS'
web['source']='Audited iPhone 16 Pro v2; PhoneMockup browser export'
for text in list(bpy.data.texts):bpy.data.texts.remove(text)
bpy.data.texts.new('START_HERE.txt').write('PhoneMockup GLB source. Z up, front -Y. Only phone meshes. screen is the only media surface. No cover glass. Export with +Y Up.\n')
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=screen
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'iphone-16-pro-web.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(RUNTIME),export_format='GLB',export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=False)
catalog={'id':'iphone-16-pro','name':'iPhone 16 Pro','modelPath':'/iphone-16-pro.glb','defaultPosition':{'x':0,'y':0,'z':round(3-1.42*.14961,7)},'defaultRotation':{'x':0,'y':0,'z':0},'layers':[{'match':'screen','material':'video','uv':'planar'}],'caseColor':None}
catalog['cameraIsland']={'nodes':['camera_cutout','front_camera_optical_lens','front_camera_pupil']}
catalog['showCameraIsland']=True
(ROOT/'client/src/lib/models/3d-models/iphone-16-pro.model.json').write_text(json.dumps(catalog,indent=2)+'\n')
stats={'device':'iPhone 16 Pro','body_dimensions_mm':{'width':71.45,'height':149.61,'depth':8.25},'screenshot_pixels':[1206,2622],'screen_web_mm':[float(x1-x0)*1000,float(z1-z0)*1000],'full_bounds_mm':list((hi-lo)*1000),'original_origin_shift_mm':list(center*1000),'triangles':sum(len(p.vertices)-2 for o in coll.objects for p in o.data.polygons),'mesh_objects':len(coll.objects),'glb_bytes':RUNTIME.stat().st_size,'omitted_hidden_or_glass_parts':omit}
(OUT/'export-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
print('WEB_EXPORT',json.dumps(stats),flush=True)
