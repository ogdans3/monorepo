"""Contact sheets from actual Blender and app renders, plus conservative output checks."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
import json,hashlib,sys
id=sys.argv[1];root=Path(__file__).resolve().parents[3];base=root/'assets/models'/id;out=base/'qa/app'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def cell(canvas,p,x,y,label,w=192,h=280):
 im=Image.open(p).convert('RGBA');im.thumbnail((w,h-28),Image.Resampling.LANCZOS);tile=Image.new('RGBA',(w,h),(29,33,40,255));tile.alpha_composite(im,((w-im.width)//2,25));ImageDraw.Draw(tile).text((6,3),label,fill='white',font=font);canvas.paste(tile.convert('RGB'),(x,y))
folders=sorted((out/'presets').iterdir())
for batch in range(2):
 selected=folders[batch*6:batch*6+6];board=Image.new('RGB',(192*5,280*len(selected)),(29,33,40))
 for row,folder in enumerate(selected):
  files=sorted(folder.glob('*.png'),key=lambda p:float(p.stem));end=float(files[-1].stem)
  for col,f in enumerate([0,.25,.5,.75,1]):
   p=min(files,key=lambda p:abs(float(p.stem)-end*f));cell(board,p,col*192,row*280,folder.name.replace('group-','')[:18]+' '+str(round(float(p.stem),2)))
 board.save(out/f'all-presets-{batch+1}.jpg',quality=90)
files=sorted((out/'presets/group-six-side-glide-showcase').glob('*.png'),key=lambda p:float(p.stem));board=Image.new('RGB',(720,640),(29,33,40))
for i,(title,t) in enumerate([('FRONT',1.3),('LEFT',2.7),('BACK',4.1),('RIGHT',5.5),('TOP',8.3),('BOTTOM',6.9)]):
 p=min(files,key=lambda p:abs(float(p.stem)-t));cell(board,p,i%3*240,i//3*320,title,240,320)
board.save(out/'six-sides-web.jpg',quality=94)
front=Image.open(out/'front.png').convert('RGB');col=Image.open(out/'recolour.png').convert('RGB');rect=(150,210,450,730)
diff=ImageChops.difference(front.crop(rect),col.crop(rect));changed=sum(any(c for c in pixel) for pixel in diff.getdata())
checks={'screen_156000_pixels_unchanged_by_case_colour':changed==0,'screen_changed_pixels_with_msaa':changed,'screen_unchanged_fraction_with_msaa':1-changed/156000,'portrait_4k_pixels':Image.open(out/'front-4k.png').size}
checks['screen_check_passed']=changed==0
if (out/'front-no-msaa.png').exists() and (out/'recolour-no-msaa.png').exists():
 a=Image.open(out/'front-no-msaa.png').convert('RGB');b=Image.open(out/'recolour-no-msaa.png').convert('RGB')
 manifest=json.loads((out/'no-msaa-check.json').read_text())
 checks['no_msaa_hash_matches']=manifest['glb_sha256']==hashlib.sha256((root/'client/static'/(id+'.glb')).read_bytes()).hexdigest() and all(manifest['images'][n]==hashlib.sha256((out/n).read_bytes()).hexdigest() for n in ['front-no-msaa.png','recolour-no-msaa.png'])
 checks['screen_without_msaa_exact']=ImageChops.difference(a.crop(rect),b.crop(rect)).getbbox() is None and checks['no_msaa_hash_matches']
 checks['screen_check_passed']=checks['screen_without_msaa_exact'] and changed<=1
 checks['msaa_tolerance_note']='SwiftShader MSAA may show one isolated pixel of an occluded rear ring. Strict comparison without MSAA must be exact; MSAA permits at most 1/156000 differing pixels. This is reported, not silently treated as pixel equality.'
report=json.loads((out/'report.json').read_text());checks['glb_hash_matches']=report['glbSha256']==hashlib.sha256((root/'client/static'/(id+'.glb')).read_bytes()).hexdigest();checks['no_renderer_errors']=not report['errors']
checks['render_count']=len(report['renders']);checks['preset_count']=len(folders);checks['preset_frames']=sum(x['kind']=='preset' for x in report['renders'])
assert all(checks[k] for k in ['screen_check_passed','glb_hash_matches','no_renderer_errors'])
(out/'pixel-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
# Uniform scale in the portrait orthographic views.
board=Image.new('RGB',(1500,1050),'#e8e8e8');d=ImageDraw.Draw(board)
for i,k in enumerate(['front','back','left','right']):
 im=Image.open(base/'qa'/(k+'.png'));im=im.resize((round(im.width*650/im.height),650),Image.Resampling.LANCZOS);board.paste(im,(i*375+(375-im.width)//2,45),im);d.text((i*375+16,18),k.upper(),font=font,fill='black')
for i,k in enumerate(['top','bottom']):
 im=Image.open(base/'qa'/(k+'.png'));im.thumbnail((720,300));board.paste(im,(i*750+15,745),im);d.text((i*750+16,718),k.upper(),font=font,fill='black')
board.save(base/'qa/six-views.jpg',quality=94)
print(json.dumps(checks),flush=True)
