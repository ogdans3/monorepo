"""Small, deterministic phone asset primitives. Authoring: X right, Y up, +Z front, metres.
Sources and device-specific measured/estimated dimensions live beside each model.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from math import sin,cos,pi
from mathutils import Vector,Matrix
MM=.001
REPO=Path(__file__).resolve().parents[3]

def rgba(h):
    a=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)+(1,)

def rounded(w,h,r,n=32):
    r=min(r,w/2,h/2);p=[]
    for x,y,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,pi/2),(-w/2+r,-h/2+r,pi),(w/2-r,-h/2+r,3*pi/2)]:
        for i in range(n+1):
            t=a+i*pi/2/n;q=(x+r*cos(t),y+r*sin(t))
            if not p or math.dist(q,p[-1])>1e-9:p.append(q)
    if math.dist(p[-1],p[0])<1e-9:p.pop()
    return p

class Phone:
    def __init__(self,id,name,body,pixels):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.id=id;self.name=name;self.w,self.h,self.t=body;self.pixels=pixels
        self.out=REPO/'assets/models'/id;self.out.mkdir(exist_ok=True)
        for n in ['previews','qa','references']:(self.out/n).mkdir(exist_ok=True)
        self.scene=bpy.context.scene;self.scene.name='01_MOCKUP_'+id
        self.scene.unit_settings.system='METRIC';self.scene.unit_settings.length_unit='MILLIMETERS'
        self.asset=bpy.data.collections.new('PHONE_'+id);self.scene.collection.children.link(self.asset)
        self.collections={}
        for n in ['00_controls','01_body','02_video','03_front_optics','04_rear_cameras','05_buttons','06_ports_and_antennas','07_branding']:
            c=bpy.data.collections.new(n);self.asset.children.link(c);self.collections[n]=c
        self.root=bpy.data.objects.new('PHONE_ROOT__animate_this',None);self.collections['00_controls'].objects.link(self.root)
        self.root['body_mm']=list(body);self.root['native_pixels']=list(pixels)
        self.root['coordinates']='X width, Y top, Z front. 1 unit = 1 metre.'
        self.root['accuracy']='Nominal body dimensions from manufacturer; secondary dimensions derived from cited raster references, not certified mechanical CAD.'
        self.materials={};self.web_omit=[]
    def mat(self,name,color,metal=0,rough=.3,coat=0):
        m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgba(color)
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba(color)
        p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Coat Weight'].default_value=coat
        p.inputs['Coat Roughness'].default_value=.15
        self.materials[name]=m;return m
    def mesh(self,name,vs,fs,mat,group='01_body',smooth=False):
        me=bpy.data.meshes.new(name);me.from_pydata([tuple(v*MM for v in q) for q in vs],[],fs);me.update()
        o=bpy.data.objects.new(name,me);self.collections[group].objects.link(o);o.parent=self.root
        if mat:me.materials.append(mat)
        if smooth:
            for p in me.polygons:p.use_smooth=True
        return o
    def loft(self,name,rings,mat,group='01_body',cap=True,loc=(0,0,0),rot=None):
        n=len(rings[0][0]);assert all(len(p)==n for p,z in rings)
        vs=[(x,y,z) for p,z in rings for x,y in p]
        fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
        sides=len(fs)
        if cap:
            for j,flip in [(0,True),(len(rings)-1,False)]:
                k=len(vs);pts=rings[j][0];vs.append((sum(p[0] for p in pts)/n,sum(p[1] for p in pts)/n,rings[j][1]))
                for i in range(n):fs.append((j*n+(i+1)%n,j*n+i,k) if flip else (j*n+i,j*n+(i+1)%n,k))
        o=self.mesh(name,vs,fs,mat,group,True)
        for p in o.data.polygons[sides:]:p.use_smooth=False
        o.location=Vector(loc)*MM
        if rot:o.rotation_euler=rot
        return o
    def slab(self,name,w,h,r,depth,loc,mat,group='01_body',bevel=.10,rot=None,n=32):
        e=min(bevel,depth*.49,r*.49)
        rings=[(rounded(w-2*i,h-2*i,max(.001,r-i),n),z) for z,i in [(-depth/2,e),(-depth/2+e*.293,e*.293),(-depth/2+e,0),(depth/2-e,0),(depth/2-e*.293,e*.293),(depth/2,e)]]
        return self.loft(name,rings,mat,group,True,loc,rot)
    def disc(self,name,r,depth,loc,mat,group='04_rear_cameras',bevel=.02,rot=None,n=24):
        return self.slab(name,2*r,2*r,r,depth,loc,mat,group,bevel,rot,n)
    def ring(self,name,r1,r2,z1,z2,loc,mat,group='04_rear_cameras',n=96):
        # Closed annulus; face winding is recalculated without smoothing flat faces.
        rings=[([(r*cos(i*2*pi/n),r*sin(i*2*pi/n)) for i in range(n)],z) for r,z in [(r1,z1),(r1,z2),(r2,z2),(r2,z1),(r1,z1)]]
        return self.loft(name,rings,mat,group,False,loc)
    def cut(self,target,tool):
        bpy.context.view_layer.objects.active=target
        mod=target.modifiers.new('machined_opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=tool
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(tool,do_unlink=True)
    def body(self,r,frame,back,bezel,seals):
        w,h,t=self.w,self.h,self.t
        self.radius=r
        self.frame=self.loft('frame',[(rounded(w-2*i,h-2*i,r-i),z) for z,i in [(-t/2+.20,.42),(-t/2+.32,.15),(-t/2+.65,0),(t/2-.65,0),(t/2-.32,.15),(t/2-.20,.42)]],frame)
        self.slab('rear_gasket',w-.8,h-.8,r-.4,.25,(0,0,-t/2+.23),seals,bevel=.04)
        self.slab('front_gasket',w-.8,h-.8,r-.4,.25,(0,0,t/2-.23),seals,bevel=.04)
        self.slab('back_glass',w-1.05,h-1.05,r-.525,.42,(0,0,-t/2+.21),back,bevel=.12)
        self.slab('bezel',w-1.05,h-1.05,r-.525,.42,(0,0,t/2-.27),bezel,bevel=.12)
    def display(self,w,r,media,hole_radius,hole_top,bezel):
        h=w*self.pixels[1]/self.pixels[0];self.screen_mm=(w,h);z=self.t/2
        pts=rounded(w,h,r,48);vs=[(x,y,z) for x,y in pts]+[(0,0,z)];n=len(pts)
        o=self.mesh('screen',vs,[(i,(i+1)%n,n) for i in range(n)],None,'02_video')
        uv=o.data.uv_layers.new(name='UV_SCREEN_0_1')
        for l in o.data.loops:
            p=o.data.vertices[l.vertex_index].co;uv.data[l.index].uv=(p.x/(w*MM)+.5,p.y/(h*MM)+.5)
        o['native_pixels']=self.pixels;o['replace']='MAT_SCREEN_VIDEO > REPLACE_MEDIA';o['active_mm']=[w,h]
        m=bpy.data.materials.new('MAT_SCREEN_VIDEO');m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
        out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=.8
        im=bpy.data.images.load(str(media));im.pack();tex=n.new('ShaderNodeTexImage');tex.name='REPLACE_MEDIA';tex.image=im;tex.extension='EXTEND';tex.image_user.use_auto_refresh=True;tex.image_user.frame_duration=180
        uvn=n.new('ShaderNodeUVMap');uvn.uv_map=uv.name;l.new(uvn.outputs[0],tex.inputs[0]);l.new(tex.outputs['Color'],em.inputs['Color']);l.new(em.outputs[0],out.inputs[0]);o.data.materials.append(m)
        self.screen=o
        self.disc('camera_cutout',hole_radius,.014,(0,self.h/2-hole_top,z+.092),bezel,'03_front_optics',bevel=.001,n=32)
        # Studio coating is explicitly omitted from web export.
        m=bpy.data.materials.new('front_optical_coating');m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
        out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');tr=n.new('ShaderNodeBsdfTransparent');gl=n.new('ShaderNodeBsdfGlossy');gl.inputs['Roughness'].default_value=.075
        fr=n.new('ShaderNodeFresnel');fr.inputs['IOR'].default_value=1.46
        l.new(fr.outputs[0],mix.inputs[0]);l.new(tr.outputs[0],mix.inputs[1]);l.new(gl.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0])
        self.coating=m
        o=self.mesh('front_reflection_coating',[(x,y,z+.003) for x,y in pts]+[(0,0,z+.003)],[(i,(i+1)%len(pts),len(pts)) for i in range(len(pts))],m,'03_front_optics');self.web_omit.append(o.name)
    def coat_plane(self,name,w,h,r,loc):
        pts=rounded(w,h,r,32);vs=[(x,y,0) for x,y in pts]+[(0,0,0)];n=len(pts)
        o=self.mesh(name,vs,[(i,n,(i+1)%n) for i in range(n)],self.coating,'04_rear_cameras');o.location=Vector(loc)*MM;self.web_omit.append(name);return o
    def usb(self,x=0,z=0):
        b=-self.h/2;rot=(pi/2,0,0);g='06_ports_and_antennas'
        cut=self.slab('temporary_usb',9.05,3.18,1.55,3,(x,b,z),None,g,bevel=.08,rot=rot,n=20);self.cut(self.frame,cut)
        self.slab('usb_c_inner_well',8.95,3.1,1.52,.10,(x,b+1.5,z),self.materials['port_interior'],g,rot=rot,n=20)
        self.slab('usb_c_tongue',6.6,.65,.23,1.5,(x,b+.78,z),self.materials['port_polymer'],g,rot=rot,n=16)
        for side in [-1,1]:
            for i in range(12):self.slab(f'usb_c_contact_{"upper" if side>0 else "lower"}_{i:02}',.17,.018,.008,.85,(x-2.75+i*.5,b+.70,z+side*.338),self.materials['contacts'],g,bevel=.002,rot=rot,n=4)
    def end_opening(self,name,x,w,h,r,top=False):
        y=(1 if top else -1)*self.h/2;rot=(-pi/2 if top else pi/2,0,0);g='06_ports_and_antennas'
        cut=self.slab('temporary_'+name,w,h,r,3,(x,y,0),None,g,rot=rot,n=20);self.cut(self.frame,cut)
        inner=y+(-1 if top else 1)*1.2
        self.slab(name+'_interior',w-.04,h-.04,r-.02,.05,(x,inner,0),self.materials['port_interior'],g,rot=rot,n=20)
        if w>5:
            for i in range(int(w/.5)):
                self.slab(name+f'_mesh_{i:02}',.06,h-.18,.02,.06,(x-w/2+.3+i*.5,inner-.05*(1 if not top else -1),0),self.materials['optical_barrels'],g,rot=rot,n=3)
    def antenna(self,side,y,width=.75):
        # Follow the frame cross-section on its straight side.
        t=self.t;profile=[(-t/2+.20,.42),(-t/2+.32,.15),(-t/2+.65,0),(t/2-.65,0),(t/2-.32,.15),(t/2-.20,.42)]
        vs=[(side*(self.w/2-i+.008),y+d,z) for z,i in profile for d in [-width/2,width/2]]
        fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)]
        if side<0:fs=[tuple(reversed(f)) for f in fs]
        return self.mesh(f'antenna_{"right" if side>0 else "left"}_{int(y*10)}'.replace('-','n'),vs,fs,self.materials['antenna_inserts'],'06_ports_and_antennas',True)
    def button(self,name,top,length,z=0):
        y=self.h/2-top;rot=(0,pi/2,0);g='05_buttons'
        self.slab(name+'_gasket',2.35,length+.35,1.1,.16,(self.w/2+.005,y,z),self.materials['seals'],g,bevel=.06,rot=rot,n=20)
        self.slab(name,2.12,length,1.02,.40,(self.w/2+.13,y,z),self.materials['frame_metal'],g,bevel=.12,rot=rot,n=24)
    def normals(self):
        for o in self.asset.all_objects:
            if o.type!='MESH':continue
            bm=bmesh.new();bm.from_mesh(o.data)
            if o.name not in ['screen','front_reflection_coating'] and o.name not in self.web_omit and not o.name.startswith('brand_') and not o.name.startswith('antenna_'):
                bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
            bm.to_mesh(o.data);bm.free()
        mod=self.frame.modifiers.new('port_edge_microbevel','BEVEL');mod.width=.000035;mod.segments=3;mod.limit_method='ANGLE';mod.angle_limit=.65
        mod=self.frame.modifiers.new('machined_flat_normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
    def camera(self,name,loc,target,scale,coll,up=(0,1,0)):
        d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);coll.objects.link(o);o.location=loc
        f=(Vector(target)-o.location).normalized();r=f.cross(Vector(up)).normalized();u=r.cross(f).normalized();o.rotation_euler=Matrix((r,u,-f)).transposed().to_euler()
        d.type='ORTHO';d.ortho_scale=scale;d.clip_start=.0001;d.clip_end=10;return o
    def area(self,name,pos,power,size,color,coll,sy=None):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=sy or size;d.color=color
        o=bpy.data.objects.new(name,d);coll.objects.link(o);o.location=pos;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler();return o
    def settings(self,s):
        s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=True;s.cycles.max_bounces=8
        s.render.resolution_x=1200;s.render.resolution_y=1500;s.render.resolution_percentage=100;s.render.film_transparent=True
        s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='AgX'
        s.render.fps=30;s.frame_end=180
    def studio(self):
        s=self.scene;self.settings(s)
        c=bpy.data.collections.new('90_STUDIO');s.collection.children.link(c)
        world=bpy.data.worlds.new('neutral_studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.19,.23,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;s.world=world
        for name,pos,power,size,color,sy in [('key',(-.18,.15,.24),1.0,.13,(1,.96,.91),.26),('right',(.18,.03,.15),.65,.035,(.9,.94,1),.27),('rim',(0,.23,-.11),1.0,.18,(1,.97,.93),.06),('back',(-.15,.17,-.23),1.0,.1,(1,.98,.95),.24),('back_strip',(.16,-.04,-.15),.65,.03,(.86,.92,1),.22)]:self.area(name,pos,power,size,color,c,sy)
        scale=self.h*MM*1.30
        self.camera('CAMERA_Front_ThreeQuarter',(.15,.085,.47),(0,0,0),scale,c)
        self.camera('CAMERA_Back_ThreeQuarter',(-.17,.12,-.47),(0,0,-.004),scale,c)
        self.camera('CAMERA_Bottom_Detail',(.08,-.30,.12),(0,-self.h*MM*.33,0),.103,c)
        self.camera('CAMERA_Camera_Detail',(-.08,.18,-.40),(0,self.h*MM*.33,-.006),.088,c)
        s.camera=bpy.data.objects['CAMERA_Front_ThreeQuarter']
        p=bpy.data.scenes.new('02_STUDIO_Front_and_Back');self.settings(p);p.render.resolution_x=1600;p.render.resolution_y=1400;p.render.film_transparent=False
        p.world=world.copy();n=p.world.node_tree.nodes;l=p.world.node_tree.links;base=n.get('Background');out=n.get('World Output');mix=n.new('ShaderNodeMixShader');ray=n.new('ShaderNodeLightPath');bg=n.new('ShaderNodeBackground');bg.inputs[0].default_value=(.014,.019,.026,1)
        l.new(ray.outputs['Is Camera Ray'],mix.inputs[0]);l.new(base.outputs[0],mix.inputs[1]);l.new(bg.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0])
        pc=bpy.data.collections.new('91_PAIR_STUDIO');p.collection.children.link(pc)
        spacing=self.w*MM*.66
        for name,pos,ang in [('front',(-spacing,-.006,.005),(9,-16,-8)),('back',(spacing,.011,-.012),(-7,163,8))]:
            o=bpy.data.objects.new('DISPLAY_'+name,None);pc.objects.link(o);o.instance_type='COLLECTION';o.instance_collection=self.asset;o.location=pos;o.rotation_euler=[math.radians(v) for v in ang]
        p.camera=self.camera('CAMERA_Pair',(0,.018,.65),(0,.003,0),self.h*MM*1.48,pc)
        for name,pos,power,size,color,sy in [('pair_key',(-.2,.2,.3),1.3,.16,(1,.97,.94),.3),('pair_right',(.22,.03,.18),1.0,.06,(.9,.94,1),.28),('pair_rim',(0,.22,-.1),1.2,.16,(1,.96,.9),.1),('pair_fill',(-.1,-.15,.25),.3,.18,(1,1,1),.2)]:self.area(name,pos,power,size,color,pc,sy)
        self.pair=p
    def save(self):
        bpy.context.window.scene=self.scene;bpy.context.preferences.filepaths.save_version=0
        bpy.ops.object.select_all(action='DESELECT');self.screen.select_set(True);bpy.context.view_layer.objects.active=self.screen
        self.scene['project']='phonemockup-ai.freelunch.no';self.scene['device']=self.name
        self.scene['web_omit']=json.dumps(self.web_omit)
        self.scene['native_pixels']=list(self.pixels);self.scene['body_mm']=[self.w,self.h,self.t]
        self.asset.asset_mark();self.asset.asset_data.description=self.name+'; dimensions and reference audit included; video-ready screen'
        txt=bpy.data.texts.new('START_HERE.txt');txt.write('Select screen. Material MAT_SCREEN_VIDEO, image node REPLACE_MEDIA. UV is upright 0-1. Animate PHONE_ROOT__animate_this. Authoring Y up, +Z front; web derivation applies X rotation for Blender Z up, -Y front. See references.json for accuracy limits.\n')
        for ui in bpy.data.screens:
            for a in ui.areas:
                if a.type=='VIEW_3D':a.spaces.active.region_3d.view_distance=.24;a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.clip_start=.0001
        bpy.ops.wm.save_as_mainfile(filepath=str(self.out/(self.id+'-studio.blend')),compress=True)
        print('STUDIO_SAVED',self.id,flush=True)
