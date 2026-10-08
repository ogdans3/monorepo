"""Measure actual saved Blender geometry against nominal specs and annotated reference pixels."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
id=sys.argv[sys.argv.index('--')+1];out=Path(__file__).resolve().parents[1]/id
s=bpy.data.scenes['01_MOCKUP_'+id];bpy.context.window.scene=s;dg=bpy.context.evaluated_depsgraph_get()
ref=json.loads((out/'references.json').read_text());w,h,t=s['body_mm']
def bounds(name):
 if isinstance(name,list):
  bs=[bounds(n) for n in name];return [min(a[i] for a,z in bs) for i in range(3)],[max(z[i] for a,z in bs) for i in range(3)]
 o=bpy.data.objects[name];e=o.evaluated_get(dg);m=e.to_mesh();ps=[o.matrix_world@v.co*1000 for v in m.vertices];e.to_mesh_clear()
 return [min(p[i] for p in ps) for i in range(3)],[max(p[i] for p in ps) for i in range(3)]
def value(name,kind):
 lo,hi=bounds(name);center=[(a+b)/2 for a,b in zip(lo,hi)]
 return {'width':hi[0]-lo[0],'height':hi[1]-lo[1],'depth':hi[2]-lo[2],'rear_x_from_left':w/2-center[0],'front_x_from_left':w/2+center[0],'top_to_center':h/2-center[1],'rear_projection':-lo[2]-t/2}[kind]
checks=[]
for c in ref['geometry_checks']:
 actual=value(c['object'],c['measurement']);error=actual-c['reference_mm'];checks.append({**c,'actual_mm':actual,'signed_error_mm':error,'passed':abs(error)<=c['tolerance_mm']})
result={'device':id,'method':'Measure evaluated Blender vertices; compare to manufacturer nominal dimensions and separately annotated source pixels. Raster-derived tolerances are NOT factory manufacturing tolerances.','all_passed':all(c['passed'] for c in checks),'checks':checks}
(out/'qa/dimensional-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
if not result['all_passed']:raise RuntimeError('Reference comparison exceeds declared raster tolerance')
