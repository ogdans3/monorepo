"""Render the actual exported no-island GLB from six orthographic views and two hero views."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'client/static/pixel-9-pro-full-screen.glb'))
s=bpy.context.scene
screen=bpy.data.objects['screen'];mat=screen.active_material;nodes=mat.node_tree.nodes
tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'screen-demo.png'))
p=nodes.get('Principled BSDF');mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.35
# The GLB UVs already span the complete display, with no mask or hole.
def aim(o):o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,pos,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;aim(o)
area('Key',(-.15,-.23,.20),1.8,.20);area('Rim',(.17,-.10,.06),1.0,.17);area('Back',(-.1,.2,.12),1.5,.18)
w=bpy.data.worlds.new('Studio');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.2,1);w.node_tree.nodes['Background'].inputs[1].default_value=.5;s.world=w
cd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',cd);s.collection.objects.link(cam);s.camera=cam;cd.clip_start=.001;cd.clip_end=100
s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
s.view_settings.view_transform='AgX'
cd.type='ORTHO';cd.ortho_scale=.168;s.render.resolution_x=720;s.render.resolution_y=1200;s.render.resolution_percentage=100
for name,pos in [('front',(0,-.4,0)),('back',(0,.4,0)),('left',(-.4,0,0)),('right',(.4,0,0)),('top',(0,0,.4)),('bottom',(0,0,-.4))]:
 cam.location=pos;aim(cam);s.render.filepath=str(OUT/'qa'/f'{name}.png');bpy.ops.render.render(write_still=True)
cd.type='PERSP';cd.lens=65;s.render.resolution_x=1200;s.render.resolution_y=1500
for name,pos in [('front',(.105,-.36,.065)),('back',(-.105,.36,.065))]:
 cam.location=pos;aim(cam);s.render.filepath=str(OUT/'previews'/f'{name}.png');bpy.ops.render.render(write_still=True)
print('FULL_SCREEN_RENDERS_COMPLETE',flush=True)
