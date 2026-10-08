"""Samsung Galaxy S24 Ultra Titanium Gray, international SM-S928B/DS.
Manufacturer nominal dimensions; raster-derived secondary dimensions in references.json.
"""
import sys,math,re,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'common'))
from phone_asset import Phone,rounded,MM,bpy,Vector,pi,cos,sin
p=Phone('galaxy-s24-ultra','Samsung Galaxy S24 Ultra — Titanium Gray',(79,162.3,8.6),(1440,3120))
metal=p.mat('frame_metal','A6A49B',1,.30)
edge=p.mat('polished_edges','CBC9BD',1,.17)
back=p.mat('back_glass_material','A5A297',0,.35,.18)
black=p.mat('bezel_polymer','040507',0,.23)
seals=p.mat('seals','343633',0,.5)
ports=p.mat('port_interior','020304',0,.68)
p.mat('port_polymer','24282A',0,.35);p.mat('contacts','C9AA66',1,.26)
p.mat('antenna_inserts','94958D',0,.50)
optics=p.mat('optical_barrels','0B0F14',1,.23)
coated=p.mat('optical_elements','03070D',0,.065,.65)
coated.node_tree.nodes['Principled BSDF'].inputs['Thin Film Thickness'].default_value=330
flash=p.mat('flash_diffuser','DEDCCE',0,.35)
logo=p.mat('logo_inlay','838279',0,.38)
# The Ultra has curved side rails and flat end rails; it is not a rounded Pixel body.
# Each tuple is depth Z, side inset X, end inset Y, outline corner radius.
profile=[(-4.10,1.18,.08,.94),(-3.97,.85,.015,.85),(-3.65,.50,0,.82),(-3.15,.29,0,.81),(-2.3,.12,0,.80),(0,0,0,.80),(2.3,.12,0,.80),(3.15,.29,0,.81),(3.65,.50,0,.82),(3.97,.85,.015,.85),(4.10,1.18,.08,.94)]
p.radius=.8
p.frame=p.loft('frame',[(rounded(p.w-2*ix,p.h-2*iy,r,20),z) for z,ix,iy,r in profile],metal)
p.slab('rear_gasket',76.9,162.10,.98,.20,(0,0,-4.09),seals,bevel=.045,n=20)
p.slab('front_gasket',76.9,162.10,.98,.20,(0,0,4.09),seals,bevel=.045,n=20)
p.slab('back_glass',76.60,161.99,.93,.30,(0,0,-4.15),back,bevel=.055,n=24)
p.slab('bezel',76.60,161.99,.93,.30,(0,0,4.09),black,bevel=.055,n=24)
p.display(172.5/math.sqrt(1+(3120/1440)**2),.88,p.out/'screen-demo.png',1.60,6.03,black)
# Compact, welded tessellation: long triangle fans around near-square corners can
# expose individual background pixels in SwiftShader. Use rectangular strips
# and short, local corner fans instead.
def retessellate_display():
 w,h=p.screen_mm;r=.88;z=p.t/2;vs=[];fs=[];lookup={}
 def v(x,y):
  key=(round(x,9),round(y,9))
  if key not in lookup:lookup[key]=len(vs);vs.append((key[0]*MM,key[1]*MM,z*MM))
  return lookup[key]
 def rect(x0,y0,x1,y1):fs.append((v(x0,y0),v(x1,y0),v(x1,y1),v(x0,y1)))
 a=w/2-r;b=h/2-r
 rect(-a,-b,a,b);rect(-a,b,a,h/2);rect(-a,-h/2,a,-b);rect(-w/2,-b,-a,b);rect(a,-b,w/2,b)
 for cx,cy,angle in [(a,b,0),(-a,b,pi/2),(-a,-b,pi),(a,-b,3*pi/2)]:
  c=v(cx,cy);arc=[v(cx+r*cos(angle+j*pi/32),cy+r*sin(angle+j*pi/32)) for j in range(17)]
  fs.extend((c,arc[j],arc[j+1]) for j in range(16))
 for name,offset in [('screen',0),('front_reflection_coating',.003*MM)]:
  o=bpy.data.objects[name];mats=list(o.data.materials);me=bpy.data.meshes.new(name+'_surface');me.from_pydata([(x,y,z+offset) for x,y,z in vs],[],fs);me.update();o.data=me
  for m in mats:me.materials.append(m)
  if name=='screen':
   uv=me.uv_layers.new(name='UV_SCREEN_0_1')
   for loop in me.loops:
    co=me.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x/(w*MM)+.5,co.y/(h*MM)+.5)
retessellate_display()

p.disc('front_lens',.99,.006,(0,p.h/2-6.03,4.402),coated,'03_front_optics',bevel=.001,n=24)
p.disc('front_lens_pupil',.48,.004,(0,p.h/2-6.03,4.408),ports,'03_front_optics',bevel=.001,n=20)
p.slab('earpiece',16.0,.19,.09,.01,(0,p.h/2-.31,4.249),ports,'03_front_optics',bevel=.001,n=20)
# Three equal large rings at rear left; laser AF and 3x camera at rear right.
# Large centres: 15.0 mm from left; 14.0 / 32.35 / 50.75 mm from top.
for label,rx,top,r,projection,glass_r in [('ultrawide',15.0,14.0,7.60,2.0,6.52),('wide',15.0,32.35,7.60,2.0,6.52),('telephoto_5x',15.0,50.75,7.60,2.0,6.52),('telephoto_3x',31.70,32.35,4.55,1.25,3.78),('laser_af',31.70,14.0,4.55,1.25,3.78)]:
 x=p.w/2-rx;y=p.h/2-top;face=-p.t/2-projection
 p.disc('camera_'+label+'_seal',r+.12,.07,(x,y,-4.33),seals,bevel=.015,n=32)
 # Hollow machined annulus avoids hidden, grazing-angle cap triangles bleeding
 # through the screen in the SwiftShader depth buffer.
 sections=[(r-.12,-4.33),(r-.04,-4.45),(r,face+.16),(r-.12,face+.04),(glass_r,face+.04),(glass_r-.02,-4.33),(r-.12,-4.33)]
 rings=[([(rr*cos(j*2*pi/96),rr*sin(j*2*pi/96)) for j in range(96)],zz) for rr,zz in sections]
 ring=p.loft('camera_'+label+'_ring',rings,edge,'04_rear_cameras',False,(x,y,0))
 for f in ring.data.polygons[3*96:4*96]:f.use_smooth=False
 p.disc('camera_'+label+'_window',glass_r,.035,(x,y,face+.028),black,bevel=.008,n=32)
 # Keep optical elements close to the protective surface; concentric outlines are subtle.
 if label!='laser_af':
  lr=3.12 if label=='ultrawide' else 3.15 if label=='wide' else 2.18 if label=='telephoto_3x' else 3.45
  p.ring('lens_'+label+'_baffle',lr+.26,lr,-.012,.012,(x,y,face+.006),optics,n=96)
  if label=='telephoto_5x':
   p.slab('lens_'+label+'_glass',4.50,5.6,.9,.009,(x,y,face-.012),coated,'04_rear_cameras',bevel=.002,n=24)
   p.slab('lens_'+label+'_pupil',2.60,2.9,.5,.007,(x,y,face-.021),ports,'04_rear_cameras',bevel=.001,n=20)
  else:
   # Smooth convex optical surface gives real curved reflections.
   vs=[];fs=[];segments=96
   for rr,sag in [(lr,0),(lr*.82,.015),(lr*.58,.029),(lr*.30,.039),(lr*.001,.043)]:
    vs += [(x+rr*cos(j*2*pi/segments),y+rr*sin(j*2*pi/segments),face-.012-sag) for j in range(segments)]
   for k in range(4):
    for j in range(segments):fs.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
   p.mesh('lens_'+label+'_glass',vs,fs,coated,'04_rear_cameras',True)
   p.disc('lens_'+label+'_pupil',lr*.40,.007,(x,y,face-.059),ports,bevel=.001,n=24)
 if label=='laser_af':
  for j,(dx,dy) in enumerate([(-1.05,.90),(1.05,-.90)]):p.disc('laser_af_aperture_'+str(j),.79,.006,(x+dx,y+dy,face-.012),coated,bevel=.001,n=24)
 p.coat_plane('optical_reflection_'+label,glass_r*2,glass_r*2,glass_r,(x,y,face-.07))
x=p.w/2-31.70;y=p.h/2-23.3
p.disc('flash_rim',1.88,.035,(x,y,-4.322),edge,bevel=.005,n=28)
p.disc('flash',1.70,.025,(x,y,-4.354),flash,bevel=.003,n=28)
for j in range(3):p.ring('flash_diffuser_ring_'+str(j),.45+j*.42,.41+j*.42,-.002,.002,(x,y,-4.371),flash,n=64)
p.disc('rear_microphone',.23,.009,(p.w/2-22.32,p.h/2-14.0,-6.235),ports,bevel=.001,n=20)
p.button('volume_rocker',41.10,21.15)
p.button('power_button',66.60,11.25)
# Rails have a different cross-section from Pixel; antenna bands must follow it exactly.
for side in [-1,1]:
 for top in [14.0,149.8]:
  vs=[(side*(p.w/2-ix+.007),p.h/2-top+d,z) for z,ix,iy,r in profile for d in [-.35,.35]]
  fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)]
  if side<0:fs=[tuple(reversed(f)) for f in fs]
  p.mesh(f'antenna_{"right" if side>0 else "left"}_{int(top*10)}',vs,fs,p.materials['antenna_inserts'],'06_ports_and_antennas',True)
for name,x,sgn in [('top_antenna',-9.8,1),('bottom_antenna_right',24.4,-1),('bottom_antenna_left',-26.0,-1)]:
 vs=[(x+d,sgn*(p.h/2-iy+.007),z) for z,ix,iy,r in profile for d in [-.34,.34]]
 fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)]
 if sgn>0:fs=[tuple(reversed(f)) for f in fs]
 p.mesh(name,vs,fs,p.materials['antenna_inserts'],'06_ports_and_antennas',True)
p.end_opening('top_microphone',14.0,.92,.92,.46,True)
p.end_opening('top_air_vent',20.1,.92,.92,.46,True)
p.usb()
p.end_opening('bottom_speaker',-17.5,8.8,.98,.49)
p.end_opening('bottom_microphone',7.8,.90,.90,.45)
rot=(pi/2,0,0);g='06_ports_and_antennas';b=-p.h/2
p.slab('sim_tray_seam',13.90,2.45,1.20,.02,(17.4,b-.013,0),seals,g,bevel=.004,rot=rot,n=24)
p.slab('sim_tray',13.63,2.18,1.06,.025,(17.4,b-.036,0),metal,g,bevel=.004,rot=rot,n=24)
p.disc('sim_eject_hole',.43,.01,(11.77,b-.057,0),ports,g,bevel=.001,rot=rot,n=24)
# Stowed S Pen: flush click-cap, rounded rectangle, independent semantic mesh.
p.slab('s_pen_cap_seam',6.8,4.8,1.90,.02,(-33.85,b-.015,0),seals,g,bevel=.003,rot=rot,n=28)
p.slab('s_pen_cap',6.24,4.28,1.67,.075,(-33.85,b-.040,0),metal,g,bevel=.026,rot=rot,n=28)
# Manufacturer wordmark paths, sampled from Samsung's own website SVG (not a substitute font).
tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',(p.out/'references/samsung-wordmark-path.txt').read_text())
i=0;cmd=None;cur=(0.,0.);start=cur;prev=None;ctrl=cur;paths=[];pts=[]
def add(q):
 global cur
 cur=q;pts.append(q)
while i<len(tokens):
 if tokens[i].isalpha():cmd=tokens[i];i+=1
 relative=cmd.islower();c=cmd.upper()
 if c=='Z':
  if pts:paths.append(pts);pts=[]
  cur=start;prev='Z';cmd=None;continue
 n={'M':2,'L':2,'H':1,'V':1,'C':6,'S':4}[c];v=list(map(float,tokens[i:i+n]));i+=n;origin=cur
 def xy(a,b):return (a+origin[0],b+origin[1]) if relative else (a,b)
 if c in ['M','L']:
  q=xy(*v)
  if c=='M':
   if pts:paths.append(pts)
   pts=[];start=q;cmd='l' if relative else 'L'
  add(q)
 elif c=='H':add((v[0]+cur[0] if relative else v[0],cur[1]))
 elif c=='V':add((cur[0],v[0]+cur[1] if relative else v[0]))
 else:
  a=xy(v[0],v[1]) if c=='C' else ((2*cur[0]-ctrl[0],2*cur[1]-ctrl[1]) if prev in ['C','S'] else cur)
  b1=xy(v[2],v[3]) if c=='C' else xy(v[0],v[1]);end=xy(v[4],v[5]) if c=='C' else xy(v[2],v[3])
  for j in range(1,9):
   f=j/8;add(tuple((1-f)**3*origin[k]+3*(1-f)**2*f*a[k]+3*(1-f)*f*f*b1[k]+f**3*end[k] for k in [0,1]))
  ctrl=b1
 prev=c
if pts:paths.append(pts)
vs=[];fs=[];scale=24.0/105
for path in paths:
 k=len(vs);vs += [(-(x-61.5)*scale,p.h/2-131.6-(y-16)*scale,-4.355) for x,y in path];fs.append(tuple(range(k,len(vs))))
p.mesh('brand_samsung',vs,fs,logo,'07_branding')
p.normals();p.studio();p.area('bottom_fill',(.02,-.24,.09),.65,.15,(.94,.97,1),bpy.data.collections['90_STUDIO'],.12);p.save();print('SAMSUNG_BUILD_COMPLETE',flush=True)
