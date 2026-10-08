"""Package one phone with relative repository layout and no credentials or raw test frames."""
from pathlib import Path
import sys,zipfile,json,hashlib
root=Path(__file__).resolve().parents[3];id=sys.argv[1];out=root.parent/f'phonemockup-ai_{id}.zip';base=root/'assets/models'/id
files=set()
for folder in [base,root/'assets/models/common']:
 for p in folder.rglob('*'):
  rel=p.relative_to(root)
  if not p.is_file() or '__pycache__' in p.parts or p.suffix in ['.pyc','.blend1','.log'] or p.name in ['.gitignore','report-in-progress.json','draft.png'] or '_draft' in p.name:continue
  if p.is_relative_to(base/'previews/animation'):continue
  if 'references' in p.parts and p.suffix not in ['.json','.png','.jpg','.txt']:continue
  if 'references' in p.parts and (p.name.startswith(('gigazine-','Pixel-','google-pixel-','store-')) or p.name=='review-image-links.json'):continue
  if p.is_relative_to(base/'qa/app') and (p.relative_to(base/'qa/app').parts[0] in ['presets','models'] or p.name=='front-4k.png'):continue
  files.add(p)
for p in [root/'client/static'/(id+'.glb'),root/'client/src/lib/models/3d-models'/(id+'.model.json'),root/'docs/models'/(id+'.md')]:files.add(p)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(files):z.write(p,Path('phonemockup-'+id)/p.relative_to(root))
with zipfile.ZipFile(out) as z:assert z.testzip() is None
print(json.dumps({'zip':str(out),'bytes':out.stat().st_size,'files':len(files),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
