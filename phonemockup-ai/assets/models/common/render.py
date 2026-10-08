"""Render actual Blender geometry: studio examples and six orthographic audit views."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:];id=args[0];mode=args[1] if len(args)>1 else 'draft'
out=Path(__file__).resolve().parents[1]/id
s=bpy.data.scenes['01_MOCKUP_'+id];bpy.context.window.scene=s
h=s['body_mm'][1]*.001

def render(scene,name,res,samples):
    bpy.context.window.scene=scene;scene.render.resolution_x,scene.render.resolution_y=res;scene.cycles.samples=samples;scene.render.filepath=str(out/name);bpy.ops.render.render(write_still=True);print('RENDERED',name,flush=True)
if mode in ['draft','final']:
    isfinal=mode=='final';samples=96 if isfinal else 20
    render(bpy.data.scenes['02_STUDIO_Front_and_Back'],f'previews/{id}_'+('studio.png' if isfinal else 'draft.png'),(1600,1400) if isfinal else (1000,875),128 if isfinal else 24)
    if isfinal:
        for label,cam,res in [('front','CAMERA_Front_ThreeQuarter',(1200,1500)),('back','CAMERA_Back_ThreeQuarter',(1200,1500)),('bottom_detail','CAMERA_Bottom_Detail',(1200,950)),('camera_detail','CAMERA_Camera_Detail',(1200,1000))]:
            s.camera=bpy.data.objects[cam];render(s,f'previews/{id}_{label}.png',res,samples)
if mode in ['audit','draft']:
    bpy.context.window.scene=s
    d=bpy.data.cameras.new('AUDIT_Camera');cam=bpy.data.objects.new('AUDIT_Camera',d);s.collection.objects.link(cam);d.type='ORTHO';d.clip_start=.0001;s.camera=cam
    # Neutral blank screen avoids confusing wallpaper edges with physical contours.
    mat=bpy.data.objects['screen'].active_material;em=next(n for n in mat.node_tree.nodes if n.type=='EMISSION')
    for link in list(mat.node_tree.links):
        if link.to_node==em:mat.node_tree.links.remove(link)
    em.inputs['Color'].default_value=(.12,.20,.23,1)
    for label,pos,up,scale,res in [('front',(0,0,.5),(0,1,0),h*1.12,(700,1200)),('back',(0,0,-.5),(0,1,0),h*1.12,(700,1200)),('left',(-.5,0,0),(0,1,0),h*1.12,(420,1200)),('right',(.5,0,0),(0,1,0),h*1.12,(420,1200)),('top',(0,.5,0),(0,0,-1),max(.081,s['body_mm'][0]*.001*1.10),(1200,380)),('bottom',(0,-.5,0),(0,0,1),max(.081,s['body_mm'][0]*.001*1.10),(1200,380))]:
        cam.location=pos;f=(-cam.location).normalized();r=f.cross(Vector(up)).normalized();u=r.cross(f).normalized();cam.rotation_euler=Matrix((r,u,-f)).transposed().to_euler();d.ortho_scale=scale
        render(s,'qa/'+label+'.png',res,32)
