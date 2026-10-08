"""Pixel 9 Pro Porcelain. Nominal dimensions: Google; secondary measurements: references.json.
Run from repository: blender -b -noaudio --python assets/models/common/blender_batch.py -- assets/models/pixel-9-pro/build.py
"""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'common'))
from phone_asset import Phone,rounded,MM,bpy,Vector,pi,cos,sin
p=Phone('pixel-9-pro','Google Pixel 9 Pro — Porcelain',(72.0,152.8,8.5),(1280,2856))
metal=p.mat('frame_metal','D4D1C8',1,.19)
edge=p.mat('polished_edges','E3E1D9',1,.13)
back=p.mat('back_glass_material','E3DFD4',0,.32,.24)
bar=p.mat('camera_bar_satin','D4D1C7',1,.34)
black=p.mat('bezel_polymer','050507',0,.17)
seals=p.mat('seals','343735',0,.46)
ports=p.mat('port_interior','020305',0,.68)
p.mat('port_polymer','26282A',0,.35)
p.mat('contacts','C9AA66',1,.26)
p.mat('antenna_inserts','B1B0AA',0,.44)
optics=p.mat('optical_barrels','101318',1,.24)
coated=p.mat('optical_elements','0E182B',0,.10,.8)
coated.node_tree.nodes['Principled BSDF'].inputs['Thin Film Thickness'].default_value=310
flash=p.mat('flash_diffuser','EBECE4',0,.3)
temp=p.mat('temperature_window','292D31',0,.2)
logo=p.mat('logo_inlay','B2ADA2',1,.33)
p.body(12.5,metal,back,black,seals)
p.display(65.80,9.45,p.out/'screen-demo.png',2.22,8.12,black)
p.disc('front_lens',1.24,.007,(0,p.h/2-8.12,p.t/2+.102),coated,'03_front_optics',bevel=.001)
p.disc('front_lens_pupil',.59,.004,(0,p.h/2-8.12,p.t/2+.108),ports,'03_front_optics',bevel=.001)
p.slab('earpiece',26.2,.32,.16,.012,(0,p.h/2-.92,4.204),ports,'03_front_optics',bevel=.001,n=20)
# Dual-finish pill: polished vertical wall and satin rear face. Projection 3.50 mm.
y=p.h/2-24.30
p.slab('camera_bar_seal',65.5,21.4,10.7,.16,(0,y,-4.27),seals,'04_rear_cameras',bevel=.04)
p.slab('camera_bar',65.5,21.4,10.7,3.40,(0,y,-5.95),metal,'04_rear_cameras',bevel=.16,n=40)
p.slab('camera_bar_rear_face',65.0,20.9,10.45,.04,(0,y,-7.67),bar,'04_rear_cameras',bevel=.012,n=40)
p.slab('camera_window_rim',50.0,19.1,9.55,.075,(6.15,y,-7.701),edge,'04_rear_cameras',bevel=.018,n=40)
p.slab('camera_window',49.45,18.57,9.285,.035,(6.15,y,-7.735),black,'04_rear_cameras',bevel=.005,n=40)
# Lens centres taken from the scaled rear product elevation, then checked against the Google hardware drawing.
# Rear view from left: ultrawide, main, folded 5x telephoto.
for label,x,r in [('ultrawide',22.73,3.58),('wide',6.45,4.87)]:
    p.disc('lens_'+label+'_mount',r,.020,(x,y-.1,-7.762),optics,bevel=.003,n=32)
    p.ring('lens_'+label+'_outer_ring',r*.92,r*.84,-.003,.003,(x,y-.1,-7.778),optics)
    p.disc('lens_'+label+'_glass',r*.78,.014,(x,y-.1,-7.784),coated,bevel=.002,n=32)
    p.ring('lens_'+label+'_inner_baffle',r*.63,r*.55,-.003,.003,(x,y-.1,-7.798),optics)
    p.disc('lens_'+label+'_pupil',r*.42,.005,(x,y-.1,-7.807),ports,bevel=.001,n=24)
# Rectangular entrance of the folded 5x lens, not an invented third circular lens.
p.slab('lens_telephoto_mount',6.0,7.4,1.20,.018,(-6.16,y-.1,-7.761),optics,'04_rear_cameras',bevel=.003,n=20)
p.slab('lens_telephoto_glass',5.0,6.45,.92,.012,(-6.16,y-.1,-7.781),coated,'04_rear_cameras',bevel=.002,n=20)
p.slab('lens_telephoto_pupil',3.65,4.4,.50,.005,(-6.16,y-.1,-7.795),ports,'04_rear_cameras',bevel=.001,n=20)
p.coat_plane('rear_optical_reflection',49.3,18.4,9.2,(6.15,y,-7.82))
for label,x,yy,r,m in [('flash',-23.3,y+4.35,2.65,flash),('temperature_sensor',-23.3,y-4.23,2.72,temp)]:
    p.disc(label+'_rim',r+.16,.035,(x,yy,-7.71),edge,bevel=.006,n=32)
    p.disc(label,r,.023,(x,yy,-7.745),m,bevel=.004,n=32)
# The LED diffuser has concentric moulding, not a second camera.
for j in range(4):p.ring(f'flash_diffuser_ring_{j}',.7+j*.44,.66+j*.44,-.002,.002,(-23.3,y+4.35,-7.76),flash,n=64)
p.disc('rear_microphone',.36,.015,(-13.6,y-.02,-7.76),ports,bevel=.002,n=20)
for j,x in enumerate([13.0,10.6]):p.disc(f'laser_autofocus_window_{j}',.64,.007,(x,y-6.1,-7.762),temp,bevel=.001,n=20)
p.button('power_button',47.55,12.25)
p.button('volume_rocker',71.65,22.0)
for side in [-1,1]:
    for top in [24.0,136.8]:p.antenna(side,p.h/2-top,.85)
# Dense strips keep corner-wrapping inlays on the curved frame surface.
# A single n-gon/fan would cut a chord through the frame and hide half the tray.
def end_inlay(name,cx,w,h,r,clearance,mat,top):
    n=112;vs=[]
    for i in range(n+1):
        x=-w/2+w*i/n;dx=max(0,abs(x)-(w/2-r));edge=h/2-r+math.sqrt(max(0,r*r-dx*dx))
        xx=cx+x;corner=max(0,abs(xx)-(p.w/2-12.5));bend=12.5-math.sqrt(max(0,12.5**2-corner**2))
        yy=(1 if top else -1)*(p.h/2-bend+clearance)
        for z in [-edge,0,edge]:vs.append((xx,yy,z))
    faces=[(i*3+j,(i+1)*3+j,(i+1)*3+j+1,i*3+j+1) for i in range(n) for j in range(2)]
    if top:faces=[tuple(reversed(f)) for f in faces]
    return p.mesh(name,vs,faces,mat,'06_ports_and_antennas',True)
end_inlay('mmwave_cover_seam',-22.0,19.72,3.77,1.81,.018,seals,True)
end_inlay('mmwave_cover',-22.0,19.5,3.55,1.70,.048,p.materials['antenna_inserts'],True)
# End antenna breaks wrap the full metal section.
for name,x,sgn in [('top_antenna',-7.4,1),('bottom_antenna',8.1,-1)]:
    profile=[(-4.05,.42),(-3.93,.15),(-3.60,0),(3.60,0),(3.93,.15),(4.05,.42)]
    vs=[(x+d,sgn*(p.h/2-ins+.009),z) for z,ins in profile for d in [-.45,.45]]
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(profile)-1)]
    if sgn>0:faces=[tuple(reversed(f)) for f in faces]
    p.mesh(name,vs,faces,p.materials['antenna_inserts'],'06_ports_and_antennas',True)
p.end_opening('top_microphone' ,23.2,1.0,1.0,.5,top=True)
p.usb()
p.end_opening('bottom_speaker',-18.1,13.5,1.72,.86)
p.end_opening('bottom_microphone',11.1,1.1,1.1,.55)
# SIM tray to the right in a front-facing coordinate system; a short outer edge follows the corner.
rot=(pi/2,0,0);g='06_ports_and_antennas'
end_inlay('sim_tray_seam',22.0,16.3,3.03,1.48,.024,seals,False)
end_inlay('sim_tray',22.0,16.03,2.76,1.34,.060,metal,False)
p.disc('sim_eject_hole',.43,.014,(16.0,-p.h/2-.077,0),ports,g,bevel=.001,rot=rot,n=20)
# Rear Google G inlay; one flat non-convex polygon, rear-facing.
r,ri=6.05,3.92
pts=[(r*cos(math.radians(45+i*315/128)),r*sin(math.radians(45+i*315/128))) for i in range(129)]
pts += [(r,1.08),(0,1.08),(0,-1.08),(math.sqrt(ri*ri-1.08**2),-1.08)]
a=math.degrees(math.asin(-1.08/ri))+360
pts += [(ri*cos(math.radians(a-i*(a-45)/128)),ri*sin(math.radians(a-i*(a-45)/128))) for i in range(129)]
# Rear image x is mirrored relative to the studio front coordinates.
p.mesh('brand_google_g',[(-x,y,-4.305) for x,y in pts],[tuple(range(len(pts)))],logo,'07_branding')
p.normals();p.studio();p.save()
print('PIXEL_BUILD_COMPLETE',flush=True)
