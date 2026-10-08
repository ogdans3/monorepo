"""Check the delivered GLB against the original, including all decoded attributes."""
import json, struct, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent

def load(path):
 data=path.read_bytes();length,kind=struct.unpack_from('<II',data,12);assert kind==0x4E4F534A
 doc=json.loads(data[20:20+length]);blen,bkind=struct.unpack_from('<II',data,20+length);assert bkind==0x004E4942
 return doc,data[28+length:28+length+blen]

def attribute(doc,blob,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
 components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 width={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*components
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width)
 raw=b''.join(blob[offset+i*stride:offset+i*stride+width] for i in range(a['count']))
 return a['type'],a['componentType'],a['count'],raw

def meshes(path):
 doc,blob=load(path);result={}
 for node in doc['nodes']:
  if 'mesh' not in node:continue
  parts=[]
  for p in doc['meshes'][node['mesh']]['primitives']:
   parts.append({'attributes':{k:attribute(doc,blob,v) for k,v in p['attributes'].items()},
    'indices':attribute(doc,blob,p['indices']), 'material':doc['materials'][p['material']], 'mode':p.get('mode',4)})
  result[node['name']]={'primitives':parts,'transform':{k:node[k] for k in ['matrix','translation','rotation','scale'] if k in node}}
 return result
original=meshes(ROOT/'client/static/iphone-16-pro.glb')
variant=meshes(ROOT/'client/static/iphone-16-pro-full-screen.glb')
removed={'camera_cutout','front_camera_optical_lens','front_camera_pupil'}
assert set(original)-set(variant)==removed
assert not set(variant)-set(original)
assert all(original[name]==variant[name] for name in variant), 'An unrelated exported mesh or material differs'
report={'passed':True,'removed_meshes':sorted(removed),'identical_remaining_meshes':len(variant),
 'compared':['positions','normals','UVs','indices','material properties','node transforms'],
 'screen_included_and_identical':'screen' in variant,'glb_bytes':(ROOT/'client/static/iphone-16-pro-full-screen.glb').stat().st_size}
(OUT/'qa/glb-comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
