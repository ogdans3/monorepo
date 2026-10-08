import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=bpy.data.objects['LAPTOP_ROOT__animate_this'];root.animation_data_clear();hinge=bpy.data.objects['lid_hinge']
lidparts=[bpy.data.objects[n] for n in ['lid_aluminium','display_bezel','screen','camera_cutout']]
baseparts=[bpy.data.objects[n] for n in ['base_enclosure','keyboard_bed','trackpad']]+[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('key_')]
def tree(obj):
 dg=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(dg);mesh=ev.to_mesh();points=[ev.matrix_world@v.co for v in mesh.vertices];faces=[p.vertices[:] for p in mesh.polygons];bvh=BVHTree.FromPolygons(points,faces,epsilon=0);ev.to_mesh_clear();return bvh
fixed=[(o.name,tree(o)) for o in baseparts];results=[]
for a in range(0,131,5):
 root['lid_open_degrees']=a;root.update_tag();bpy.context.view_layer.update();hits=[]
 for o in lidparts:
  t=tree(o)
  for name,b in fixed:
   n=len(t.overlap(b))
   if n:hits.append([o.name,name,n])
 results.append({'angle':a,'surface_intersections':hits})
print(json.dumps(results),flush=True)
Path(__file__).with_name('qa').mkdir(exist_ok=True)
(Path(__file__).parent/'qa/hinge-collision.json').write_text(json.dumps(results,indent=2))
