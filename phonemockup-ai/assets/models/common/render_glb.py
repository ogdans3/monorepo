import bpy,sys
from pathlib import Path
from mathutils import Vector
id=sys.argv[sys.argv.index('--')+1];ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models'/id
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'client/static'/(id+'.glb')));s=bpy.context.scene
# Render the imported export; no test texture is saved in the delivered GLB.
def aim(o,target=Vector((0,0,0))):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,xyz,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=xyz;aim(o)
area('qa_key',(-.16,-.24,.2),1.5,.22);area('qa_rim',(.18,-.10,.07),1.0,.17);area('qa_back',(-.12,.22,.16),1.5,.22)
world=bpy.data.worlds.new('qa_world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.20,.23,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;s.world=world
data=bpy.data.cameras.new('qa_camera');cam=bpy.data.objects.new('qa_camera',data);s.collection.objects.link(cam);data.type='ORTHO';data.ortho_scale=.175;data.clip_start=.001;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=800;s.render.resolution_y=1500;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True;s.view_settings.view_transform='AgX'
for name,pos in [('front',(0,-.4,0)),('back',(0,.4,0))]:
    cam.location=pos;aim(cam);s.render.filepath=str(OUT/'previews'/f'{id}_web_{name}.png');bpy.ops.render.render(write_still=True)
print('EXPORTED_MODEL_PREVIEWS_COMPLETE',flush=True)
