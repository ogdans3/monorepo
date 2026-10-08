"""MacBook Pro 14-inch M4 (2024), Silver, ANSI US. Dimensions in mm.
Closed enclosure is 312.6 x 221.2 x 15.5. Feet extend 1.5 mm below.
Reference-calibrated secondary dimensions and hinge range are documented separately.
"""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'common'))
from phone_asset import Phone,rounded,MM,bpy,Vector,Matrix,pi,cos,sin
ID='macbook-pro-14-m4'
p=Phone(ID,'MacBook Pro 14-inch M4 (2024) — Silver',(312.6,221.2,15.5),(3024,1964))
p.asset.name='LAPTOP_'+ID;p.root.name='LAPTOP_ROOT__animate_this'
for c in list(p.collections.values()):bpy.data.collections.remove(c)
p.collections={}
for name in ['00_controls','01_body','02_video','03_lid','04_keyboard','05_trackpad','06_ports','07_branding','08_hinges','09_underside']:
 c=bpy.data.collections.new(name);p.asset.children.link(c);p.collections[name]=c
p.collections['00_controls'].objects.link(p.root)
p.root['coordinates']='X right, Y rear, Z up. Metres. Rotate root to move the complete laptop.'
p.root['lid_open_degrees']=105.0
p.root.id_properties_ui('lid_open_degrees').update(min=0,max=130,soft_min=0,soft_max=130,description='0 = closed. Working range 0–130 degrees; estimated, not a certified Apple mechanical limit.')
base=bpy.data.objects.new('base',None);p.collections['00_controls'].objects.link(base);base.parent=p.root
hinge=bpy.data.objects.new('lid_hinge',None);p.collections['00_controls'].objects.link(hinge);hinge.parent=p.root
hinge.location=(0,.1078,.0066);hinge.empty_display_type='ARROWS';hinge.empty_display_size=.035
hinge['axis']='Local X. Rotation X = -opening_degrees * pi/180. Base remains stationary.'
hinge['default_open_degrees']=105.0;hinge['min_open_degrees']=0;hinge['max_open_degrees']=130
bpy.context.view_layer.update()
metal=p.mat('enclosure_aluminium','BDC0C3',1,.29)
edge=p.mat('machined_aluminium','CFD1D4',1,.20)
black=p.mat('bezel_polymer','060709',0,.24)
seal=p.mat('elastomer_seals','141619',0,.6)
keymat=p.mat('keycaps','111214',0,.42)
keymat.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.22
inside=p.mat('port_interior','050608',0,.65)
contact=p.mat('connector_contacts','B6A983',1,.27)
logo=p.mat('logo_inlay','111316',1,.14)
trackmat=p.mat('trackpad_glass','A5A8AB',0,.43)
legend=p.mat('key_legends','FFFFFF',0,.42)
legend.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.22
tex=legend.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(p.out/'key-legends.jpg'));tex.image.pack();legend.node_tree.links.new(tex.outputs['Color'],legend.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

def lid(o):
 o.parent=hinge;o.matrix_parent_inverse=hinge.matrix_world.inverted();return o

def fixed(o):o.parent=base;return o

def slab(name,w,h,r,d,loc,mat=metal,group='01_body',bevel=.1,rot=None,n=12):
 return fixed(p.slab(name,w,h,r,d,loc,mat,group,bevel,rot,n))

def disc(name,r,d,loc,mat,group='06_ports',rot=None,n=12):
 return fixed(p.disc(name,r,d,loc,mat,group,bevel=min(d*.15,.04),rot=rot,n=n))
# Rounded aluminium tub, with a broad soft lower edge and crisp deck lip.
# Apple side silhouette has a roughly 6 mm lower roll, not a square 2 mm lip.
LOWER_ROLL=6.0
profile=[(LOWER_ROLL*(1-cos(i*pi/24)),LOWER_ROLL*(1-sin(i*pi/24))) for i in range(13)]+[(10.75,0),(11.1,.16)]
frame=fixed(p.loft('base_enclosure',[(rounded(312.6-2*i,221.2-2*i,8.8-i,20),z) for z,i in profile],metal))
p.frame=frame
# Shallow keyboard recess; black keyboard bed and keycaps are below the closed panel.
p.cut(frame,slab('tool_keyboard',275.1,114.0,4.5,3,(0,39.0,11.55),None,n=12))
slab('keyboard_bed',274.8,113.7,4.3,.35,(0,39,10.14),black,'04_keyboard',n=12)
# Trackpad's machined recess and narrow shadow line.
p.cut(frame,slab('tool_trackpad',131.6,82.3,3.1,2,(0,-59.0,11.8),None))
slab('trackpad_seam',131.45,82.15,3.0,.13,(0,-59,10.86),seal,'05_trackpad')
slab('trackpad',131.0,81.7,2.85,.13,(0,-59,10.98),trackmat,'05_trackpad',bevel=.045)
# Front finger scoop is real recessed geometry; its width is calibrated from AV3.
p.cut(frame,slab('tool_finger_scoop',54.0,12,5.1,4.4,(0,-111.9,11.0),None,bevel=.9,n=20))
# Remove the rear centre under the display heel so the hinge can swing freely.
p.cut(frame,slab('tool_hinge_clearance',304.4,11.0,1.0,16,(0,110.0,14.6),None,bevel=.1,n=8))
# Seven physical ports. x rotation then z rotation maps local XY into the side YZ plane.
from mathutils import Euler
side_rot=(pi/2,0,pi/2)
def side_port(name,side,y,w,h,r,z=6.1):
 inset=LOWER_ROLL-math.sqrt(max(0,LOWER_ROLL**2-(LOWER_ROLL-z)**2)) if z<LOWER_ROLL else 0
 x=side*(156.3-inset)
 cutter=slab('tool_'+name,w,h,r,4,(x,y,z),None,'06_ports',bevel=.10,rot=side_rot,n=16);p.cut(frame,cutter)
 slab(name+'_well',w-.08,h-.08,max(.1,r-.04),.06,(x-side*1.72,y,z),inside,'06_ports',rot=side_rot,n=16)
 return x
for side,y,name in [(-1,64.3,'thunderbolt_left_rear'),(-1,49.5,'thunderbolt_left_front'),(1,64.3,'thunderbolt_right')]:
 x=side_port(name,side,y,8.35,2.58,1.18)
 slab(name+'_tongue',6.35,.62,.23,.75,(x-side*.99,y,6.1),black,'06_ports',rot=side_rot,n=8)
 # Visible contacts without thousands of separate mesh objects.
 for k in range(8):slab(name+'_contact_'+str(k),.21,.07,.02,.44,(x-side*.82,y-2.38+k*.68,6.48),contact,'06_ports',rot=side_rot,n=2)
x=side_port('magsafe',-1,82.85,17.1,3.1,1.50)
slab('magsafe_insert',13.7,1.3,.6,.15,(x+.50,82.85,6.1),black,'06_ports',rot=side_rot,n=10)
for k in range(5):disc('magsafe_pin_'+str(k),.34,.10,(x+.38,82.85-4+k*2,6.1),contact,rot=(0,pi/2,0),n=8)
side_port('headphone_jack',-1,36.5,3.55,3.55,1.775)
# HDMI's trapezoidal bottom corners, not another generic USB rectangle.
# The Boolean cutter must wind counter-clockwise with outward-facing normals.
poly=list(reversed([(-6.95,2.05),(6.95,2.05),(6.95,-.7),(4.9,-2.45),(-4.9,-2.45),(-6.95,-.7)]))
tool=p.loft('tool_hdmi',[(poly,-2),(poly,2)],None,'06_ports',True,(156.3,82.8,6.25),side_rot);p.cut(frame,tool)
slab('hdmi_well',13.65,4.0,.7,.05,(154.55,82.8,6.25),inside,'06_ports',rot=side_rot,n=8)
slab('hdmi_tongue',10.5,.58,.2,.9,(155.2,82.8,6.30),black,'06_ports',rot=side_rot,n=8)
for k in range(10):slab('hdmi_contact_'+str(k),.17,.08,.015,.5,(155.55,78.5+k*.95,6.64),contact,'06_ports',rot=side_rot,n=2)
side_port('sdxc',1,39.8,26.0,2.2,1.02)
# Lower side intake slots calibrated to the bottom case reference.
for side in [-1,1]:
 side_port('intake_'+('left' if side<0 else 'right'),side,-25,104,.82,.4,z=1.65)
# Rear dark vent, slats and the two hinge bearings.
slab('rear_vent',266.0,3.0,1.1,2.6,(0,106.3,5.0),inside,'08_hinges')
for k in range(53):slab('rear_vent_fin_'+str(k),1.0,3.2,.4,2.75,(-130+k*5,106.3,5.0),black,'08_hinges',n=3)
for x,side in [(-111,'left'),(111,'right')]:
 slab('hinge_'+side+'_mount',20,7.2,1.0,1.8,(x,106.0,8.6),edge,'08_hinges',n=8)
 lid(slab('hinge_'+side+'_cover',18,5.8,1.0,1.2,(x,107.4,10.7),black,'08_hinges',n=8))
# Baseplate seam, elastomer feet and the eight pentalobe screw heads.
slab('bottom_case_seam',300.5,209.1,2.75,.11,(0,0,.08),seal,'09_underside',bevel=.01,n=20)
slab('bottom_case',300.2,208.8,2.6,.16,(0,0,.05),metal,'09_underside',bevel=.045,n=20)
for x in [-129,129]:
 for y in [-83,83]:
  foot_profile=[(8.5,-1.51),(8.8,-1.38),(9.5,-.5),(9.95,-.06),(9.95,.01)]
  fixed(p.loft(f'foot_{x}_{y}',[(rounded(2*r,2*r,r,16),z) for r,z in foot_profile],seal,'09_underside',True,(x,y,0)))
for x in [-146,-51,51,146]:
 for y in [-102,102]:
  disc(f'screw_head_{x}_{y}',1.1,.07,(x,y,-.055),edge,'09_underside',n=10)
  pts=[]
  for j in range(10):
   a=j*pi/5;rr=.44 if j%2==0 else .21;pts.append((x+rr*cos(a),y+rr*sin(a),-.094))
  fixed(p.mesh(f'screw_recess_{x}_{y}',pts,[tuple(reversed(range(10)))],inside,'09_underside'))
# Two speaker grilles: compact real geometry, each aperture just eight triangles.
vs=[];fs=[]
for side in [-1,1]:
 for row in range(93):
  for col in range(8):
   x=side*(141.1+col*.93);y=-11.5+row*1.13
   k=len(vs);vs.append((x,y,11.113))
   vs += [(x+.235*cos(j*pi/4),y+.235*sin(j*pi/4),11.113) for j in range(8)]
   fs += [(k,k+1+j,k+1+(j+1)%8) for j in range(8)]
fixed(p.mesh('speaker_grilles',vs,fs,inside,'04_keyboard'))
# ANSI 78-key arrangement, full-height F-row and inverted-T arrows.
labels=json.loads((p.out/'key-labels.json').read_text());keys=[];pitch=18.85;keyindex=0
rows=[([1.5]+[1]*13,86.2),([1]*13+[1.5],67.35),([1.5]+[1]*13,48.5),([1.75]+[1]*11+[1.75],29.65),([2.25]+[1]*10+[2.25],10.8)]
def key(width,x,y,hh=16.5):
 global keyindex
 name='key_'+str(keyindex).zfill(2)+'_'+(''.join(c for c in labels[keyindex].lower() if c.isalnum()) or 'symbol')
 o=slab(name,width,hh,1.95,.90,(x,y,10.79),keymat,'04_keyboard',bevel=.22,n=4)
 o.data.materials.append(legend)
 uv=o.data.uv_layers.new(name='key_legend_uv');cellx=keyindex%16;celly=keyindex//16
 for face in o.data.polygons:
  if face.normal.z>.99:
   face.material_index=1
   for li in face.loop_indices:
    co=o.data.vertices[o.data.loops[li].vertex_index].co
    # Limit the glyph patch to the inner portion of its padded atlas cell.
    u=.12+.76*(co.x/(width*.001)+.5);v=.12+.76*(co.y/(hh*.001)+.5)
    uv.data[li].uv=((cellx*128+u*128)/2048,1-(celly*192+(1-v)*192)/1024)
 keys.append(o);keyindex+=1
for units,y in rows:
 x=-14.5*pitch/2
 for u in units:
  key(u*pitch-2.35,x+u*pitch/2,y);x+=u*pitch
x=-14.5*pitch/2;y=-8.05
for u in [1,1,1,1.25,5,1.25,1]:
 key(u*pitch-2.35,x+u*pitch/2,y);x+=u*pitch
key(pitch-2.35,x+pitch/2,y-4.6,7.3);x+=pitch
key(pitch-2.35,x+pitch/2,y-4.6,7.3)
key(pitch-2.35,x+pitch/2,y+4.6,7.3);x+=pitch
key(pitch-2.35,x+pitch/2,y-4.6,7.3)
assert keyindex==78
# Touch ID round sensor set into the last F-row key.
disc('touch_id_rim',6.0,.02,(keys[13].location.x/MM,86.2,11.255),black,'04_keyboard',n=16)
disc('touch_id_sensor',5.55,.026,(keys[13].location.x/MM,86.2,11.271),keymat,'04_keyboard',n=16)
# Display closed: 4 mm shell. At 90 degrees its front normal points toward -Y.
lid(slab('lid_aluminium',312.6,221.2,8.8,3.72,(0,0,13.64),metal,'03_lid',bevel=.36,n=24))
lid(slab('lid_perimeter_gasket',311.3,219.9,8.2,.25,(0,0,11.65),seal,'03_lid',bevel=.07,n=24))
bezel=slab('display_bezel',310.6,219.2,7.8,.16,(0,0,11.515),black,'03_lid',bevel=.04,n=24)
# A real bezel surrounds the panel: it must not put a nearly coplanar black
# triangle fan immediately behind the video and cause depth-buffer interference.
p.cut(bezel,slab('tool_panel_aperture',302.0,196.0,4.4,1.0,(0,-7.4,11.515),None,'03_lid',n=24))
for face in bezel.data.polygons:face.material_index=0
bezel.data.materials.clear();bezel.data.materials.append(black);lid(bezel)
# Exactly 254 ppi = 0.1 mm/pixel; active rectangle 302.4 x 196.4 mm.
# Top two corners rounded, bottom square, as Apple specifies.
sw,sh=302.4,196.4;sy=-7.40;r=4.6
# Compact welded cells keep the display robust in software MSAA rasterizers.
vs=[];fs=[];lookup={};a=sw/2-r;ymin=sy-sh/2;ymax=sy+sh/2
xs=[-sw/2]+[-a+2*a*j/12 for j in range(13)]+[sw/2]
ys=[ymin+r+(sh-r)*j/8 for j in range(9)]
def vertex(x,y):
 key=(round(x,8),round(y,8))
 if key not in lookup:lookup[key]=len(vs);vs.append((key[0],key[1],11.42))
 return lookup[key]
def quad(x0,y0,x1,y1):fs.append(tuple(reversed((vertex(x0,y0),vertex(x1,y0),vertex(x1,y1),vertex(x0,y1)))))
for i in range(len(xs)-1):
 for j in range(len(ys)-1):quad(xs[i],ys[j],xs[i+1],ys[j+1])
for i in range(1,len(xs)-2):quad(xs[i],ymin,xs[i+1],ymin+r)
for cx,angle in [(a,-pi/2),(-a,pi)]:
 cy=ymin+r;c=vertex(cx,cy);arc=[vertex(cx+r*cos(angle+j*pi/48),cy+r*sin(angle+j*pi/48)) for j in range(25)]
 fs.extend((c,arc[j+1],arc[j]) for j in range(24))
o=lid(p.mesh('screen',vs,fs,None,'02_video'))
uv=o.data.uv_layers.new(name='UV_VIDEO_0_1')
for loop in o.data.loops:
 co=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x/(sw*MM)+.5,.5-(co.y/MM-sy)/sh)
o['native_pixels']=[3024,1964];o['active_mm']=[sw,sh];o['replace']='MAT_SCREEN_VIDEO > REPLACE_MEDIA';o['front_normal_closed']='-Z'
m=bpy.data.materials.new('MAT_SCREEN_VIDEO');m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links
bsdf=nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=.18;bsdf.inputs['Specular IOR Level'].default_value=.15
tex=nodes.new('ShaderNodeTexImage');tex.name='REPLACE_MEDIA';tex.image=bpy.data.images.load(str(p.out/'screen-demo.png'));tex.image.pack();tex.image_user.use_auto_refresh=True;tex.image_user.frame_duration=180
links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);links.new(tex.outputs['Color'],bsdf.inputs['Emission Color']);bsdf.inputs['Emission Strength'].default_value=.45;o.data.materials.append(m)
# 37 x 5.7 mm notch attached to the moving display; front-facing blue-black optics.
lid(slab('camera_cutout',37.0,6.4,1.65,.022,(0,sy-sh/2+2.7,11.385),black,'03_lid',bevel=.004,n=16))
optical=p.mat('camera_optics','102230',0,.1,.3)
lid(disc('camera_lens',.91,.015,(0,sy-sh/2+2.6,11.365),optical,'03_lid',n=12))
lid(disc('camera_pupil',.39,.008,(0,sy-sh/2+2.6,11.354),inside,'03_lid',n=8))
lid(disc('ambient_light_sensor',.47,.008,(-6.6,sy-sh/2+2.6,11.365),black,'03_lid',n=8))
# An 80-micron surface offset keeps the inlay stable in browser depth buffers.
# Apple logo contour from the manufacturer's dimensional-drawing vector path.
paths=json.loads((p.out/'references/apple-logo-contours.json').read_text());allpts=[q for pts in paths.values() for q in pts];minx=min(q[0] for q in allpts);maxx=max(q[0] for q in allpts);miny=min(q[1] for q in allpts);maxy=max(q[1] for q in allpts)
for name,coords in paths.items():
 sc=37.7/(maxx-minx);vs=[(-(x-(minx+maxx)/2)*sc,(y-(miny+maxy)/2)*sc,15.58) for x,y in coords]
 lid(p.mesh('brand_apple_'+('leaf' if 'leaf' in name else 'body'),vs,[tuple(reversed(range(len(vs))))],logo,'07_branding'))
# Underbody model name is an inlay; no fake serial number.
curve=bpy.data.curves.new('bottom_marking','FONT');curve.body='MacBook Pro';curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.006;curve.resolution_u=3
text=bpy.data.objects.new('bottom_marking',curve);p.collections['09_underside'].objects.link(text);text.parent=base;text.location=(0,0,-.000075);text.rotation_euler=(pi,0,0);curve.materials.append(edge)
bpy.context.view_layer.objects.active=text;text.select_set(True);bpy.ops.object.convert(target='MESH');text.select_set(False)
# Normals and realistic microbevels around machined openings.
import bmesh
for o in p.asset.all_objects:
 if o.type=='MESH' and o.name!='screen' and not o.name.startswith('brand_') and o.name!='speaker_grilles':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
for face in frame.data.polygons:face.material_index=0
frame.data.materials.clear();frame.data.materials.append(metal)
mod=frame.modifiers.new('machined_edge_radius','BEVEL');mod.width=.00004;mod.segments=3;mod.limit_method='ANGLE';mod.angle_limit=.7
mod=frame.modifiers.new('weighted_flat_normals','WEIGHTED_NORMAL');mod.keep_sharp=True
# Driver in the master; the web export retains the physical pivot with a static default pose.
fcurve=hinge.driver_add('rotation_euler',0);driver=fcurve.driver;driver.type='SCRIPTED';var=driver.variables.new();var.name='opening';var.type='SINGLE_PROP';var.targets[0].id=p.root;var.targets[0].data_path='["lid_open_degrees"]';driver.expression='-min(130,max(0,opening))*pi/180'
s=p.scene;s['device']=p.name;s['closed_enclosure_mm']=[312.6,221.2,15.5];s['native_pixels']=[3024,1964]
s.frame_start=1;s.frame_end=180;s.render.fps=30
# Keyframe a reusable opening/closing action on the user control.
for frame_no,angle in [(1,0),(15,0),(75,105),(115,105),(165,0),(180,0)]:
 p.root['lid_open_degrees']=angle;p.root.keyframe_insert(data_path='["lid_open_degrees"]',frame=frame_no)
p.root.animation_data.action.name='Lid_Open_Close__0_to_105_degrees'
s.frame_set(90)
s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=True;s.cycles.max_bounces=6
s.render.resolution_x=1600;s.render.resolution_y=1200;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.film_transparent=False
s.world=bpy.data.worlds.new('Studio_World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.13,.16,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.35
s.view_settings.view_transform='AgX'
studio=bpy.data.collections.new('90_STUDIO');s.collection.children.link(studio)
p.area('Key_Softbox',(-.35,-.30,.65),20,.55,(.90,.96,1),studio,.30)
p.area('Rim_Strip',(.30,.38,.52),24,.45,(1,.94,.86),studio,.11)
p.area('Front_Fill',(.25,-.40,.20),6,.40,(.92,.96,1),studio,.35)
p.area('Back_Fill',(-.35,.40,.20),8,.40,(.86,.93,1),studio,.24)
# Camera basis uses Z-up for this laptop, unlike the earlier phone authoring convention.
for name,pos,target,scale in [('CAMERA_Hero',(.52,-.78,.47),(0,0,.105),.62),('CAMERA_Back',(-.36,.45,.34),(0,.03,.08),.48),('CAMERA_Keyboard',(.18,-.24,.49),(0,-.008,.01),.39),('CAMERA_Hinge',(.20,.40,.18),(.06,.100,.03),.25)]:
 p.camera(name,pos,target,scale,studio,up=(0,0,1))
# Product presentation uses a photographic perspective; audit cameras stay orthographic.
hero=bpy.data.objects['CAMERA_Hero'];hero.data.type='PERSP';hero.data.lens=65;hero.data.sensor_width=36
front=p.camera('CAMERA_Product_Front',(0,-.85,.29),(0,0,.105),.62,studio,up=(0,0,1));front.data.type='PERSP';front.data.lens=65;front.data.clip_end=100
s.camera=hero
# Neutral floor belongs only to the studio collection, never the web model.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.0016));floor=bpy.context.object;floor.name='studio_floor'
for c in list(floor.users_collection):c.objects.unlink(floor)
studio.objects.link(floor);floor.data.materials.append(p.mat('studio_floor_material','202B34',0,.6))
start=bpy.data.texts.new('START_HERE.txt');start.write('MACBOOK PRO 14 M4 / SILVER\n\nSelect LAPTOP_ROOT__animate_this. Custom Properties > lid_open_degrees controls the physical hinge. The example action on this property opens and closes over frames 1–180. To pose manually, mute/delete that action, then change the property. lid_hinge rotates around local X; its children include the display, notch, camera and lid shell.\n\nReplace the packed image on MAT_SCREEN_VIDEO > REPLACE_MEDIA with an image or movie; UV_VIDEO_0_1 is upright and fills 3024 × 1964. Auto Refresh is enabled. No glass plane obscures the media.\n\nClosed enclosure 312.6 × 221.2 × 15.5 mm; rubber feet add 1.5 mm. Public Apple specs and repair images, not certified factory CAD. See references.json for measured/estimated details.\n')
bpy.ops.object.select_all(action='DESELECT');p.root.select_set(True);bpy.context.view_layer.objects.active=p.root
for scr in bpy.data.screens:
 for area in scr.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.clip_start=.0001
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(p.out/(ID+'-studio.blend')),compress=True)
print('MACBOOK_STUDIO_SAVED',flush=True)
