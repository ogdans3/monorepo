import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
p=Path(__file__).parent;s=bpy.context.scene;mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'draft'
root=bpy.data.objects['LAPTOP_ROOT__animate_this'];root.animation_data_clear()
def angle(value):
 root['lid_open_degrees']=value;root.update_tag();bpy.context.view_layer.update()
def render(name,res,samples):
 s.render.resolution_x,s.render.resolution_y=res;s.cycles.samples=samples;s.render.filepath=str(p/name);bpy.ops.render.render(write_still=True);print('RENDERED',name,flush=True)
if mode in ['draft','final']:
 angle(105);s.camera=bpy.data.objects['CAMERA_Hero'];render('previews/'+('draft.png' if mode=='draft' else 'macbook-pro-14-m4_studio.png'),(1000,750) if mode=='draft' else (1800,1350),24 if mode=='draft' else 64)
 if mode=='final':
  for label,cam,a in [('back','CAMERA_Back',105),('keyboard','CAMERA_Keyboard',110),('hinge','CAMERA_Hinge',115),('closed','CAMERA_Hero',0)]:
   angle(a);s.camera=bpy.data.objects[cam];render('previews/macbook-pro-14-m4_'+label+'.png',(1400,1050),48)
if mode=='audit':
 bpy.data.objects['studio_floor'].hide_render=True
 cam=bpy.data.objects['CAMERA_Hero'];s.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=.37
 def position(pos,target,up):
  cam.location=pos;f=(Vector(target)-cam.location).normalized();r=f.cross(Vector(up)).normalized();u=r.cross(f);cam.rotation_euler=Matrix((r,u,-f)).transposed().to_euler()
 for label,pos,target,up,a,res,scale in [
 ('front',(0,-1,.12),(0,0,.12),(0,0,1),90,(1100,825),.35),
 ('back',(0,1,.12),(0,0,.12),(0,0,1),90,(1100,825),.35),
 ('left_90',(-1,0,.12),(0,0,.12),(0,0,1),90,(1100,825),.35),
 ('right_90',(1,0,.12),(0,0,.12),(0,0,1),90,(1100,825),.35),
 ('left',(-1,0,.12),(0,0,.12),(0,0,1),105,(1100,825),.35),
 ('right',(1,0,.12),(0,0,.12),(0,0,1),105,(1100,825),.35),
 ('top',(0,.030,1),(0,.030,0),(0,1,0),105,(1100,825),.42),
 ('bottom',(0,0,-1),(0,0,0),(0,-1,0),0,(1100,825),.35),
 ('closed_top',(0,0,1),(0,0,0),(0,1,0),0,(1100,825),.35),
 ('closed_front',(0,-1,.007),(0,0,.007),(0,0,1),0,(1600,240),.35),
 ('closed_left',(-1,0,.007),(0,0,.007),(0,0,1),0,(1600,240),.25),
 ('closed_right',(1,0,.007),(0,0,.007),(0,0,1),0,(1600,240),.25)]:
  angle(a);position(pos,target,up);cam.data.ortho_scale=scale;render('qa/'+label+'.png',res,16)
 for a in [0,15,30,60,90,105,120,130]:
  angle(a);position((1,0,.12),(0,0,.12),(0,0,1));cam.data.ortho_scale=.38;render(f'qa/hinge_{a:03}.png',(800,600),12)
if mode=='animation':
 s.camera=bpy.data.objects['CAMERA_Hero'];s.render.resolution_x=960;s.render.resolution_y=720;s.cycles.samples=16
 # 60 exact geometric poses; no AI image interpolation.
 for i in range(60):
  f=i/59;v=105*(.5-.5*math.cos(2*math.pi*f));angle(v);render(f'previews/animation/frame_{i:03}.png',(960,720),16)

if mode=='logo_details':
 for label,cam,a in [('back','CAMERA_Back',105),('hinge','CAMERA_Hinge',115),('closed','CAMERA_Hero',0)]:
  angle(a);s.camera=bpy.data.objects[cam];render('previews/macbook-pro-14-m4_'+label+'.png',(1400,1050),48)
if mode=='hero_final':
 angle(105);s.camera=bpy.data.objects['CAMERA_Hero'];render('previews/macbook-pro-14-m4_studio.png',(1800,1350),64)

if mode=='product_front':
 angle(105);s.camera=bpy.data.objects['CAMERA_Product_Front'];render('previews/macbook-pro-14-m4_front-perspective.png',(1600,1200),48)
