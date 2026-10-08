"""Arrange actual renders and original manufacturer images for human QA."""
from PIL import Image,ImageDraw,ImageFont,ImageOps
from pathlib import Path
import json
p=Path(__file__).parent;f='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=lambda s:ImageFont.truetype(f,s)
def board(items,name,cols=3,w=620,h=490):
 rows=(len(items)+cols-1)//cols;im=Image.new('RGB',(cols*w,rows*h+100),'#17212a');d=ImageDraw.Draw(im)
 d.text((25,22),'MACBOOK PRO 14 M4  /  GEOMETRY CHECK',font=font(26),fill='#eef3f6')
 d.text((25,62),'Actual model renders · See references.json for source measurements and tolerances',font=font(17),fill='#9aafbf')
 for i,(label,path) in enumerate(items):
  x=(i%cols)*w;y=(i//cols)*h+100;src=Image.open(path).convert('RGB');src.thumbnail((w-24,h-66),Image.Resampling.LANCZOS)
  im.paste(src,(x+(w-src.width)//2,y+45+(h-66-src.height)//2));d.text((x+18,y+12),label,font=font(19),fill='#e6eef3')
 im.save(p/name,quality=94)
board([(x.title()+' / '+a,p/'qa'/f'{x}.png') for x,a in [('front','90°'),('back','90°'),('left','105°'),('right','105°'),('top','105°'),('bottom','closed')]],'qa/six-views.jpg')
board([(str(a)+'° opening',p/'qa'/f'hinge_{a:03}.png') for a in [0,15,30,60,90,105,120,130]],'qa/hinge-angles.jpg',4,w=500,h=390)
# Crops contain the original source pixels. The source is compared at the same
# physical body width, not warped to match the render's thickness.
ref_left=Image.open(p/'references/ports-2.png').convert('RGB').crop((21,96,978,189))
ref_right=Image.open(p/'references/ports-1.png').convert('RGB').crop((21,96,978,189))
for side,ref in [('left',ref_left),('right',ref_right)]:
 ref.save(p/'qa'/f'reference-{side}-crop.png')
 model=Image.open(p/'qa'/f'closed_{side}.png').convert('RGB').crop((92,53,1508,188));model.save(p/'qa'/f'model-{side}-crop.png')
board([('Apple / left side',p/'qa/reference-left-crop.png'),('Model / left side',p/'qa/model-left-crop.png'),('Apple / right side',p/'qa/reference-right-crop.png'),('Model / right side',p/'qa/model-right-crop.png')],'qa/reference-comparison.jpg',2,w=900,h=230)
report=json.loads((p/'references.json').read_text())
measures=report['port_calibration']['measurements'];data={'all_passed':all(x['error_mm']<=.65 for x in measures),'reference':'Apple charging / expansion side elevations','scale_mm_per_pixel':221.2/956,'tolerance_mm':.65,'measurements':measures}
(p/'qa/reference-measurements.json').write_text(json.dumps(data,indent=2)+'\n')

app=p/'qa/app';report=json.loads((app/'report.json').read_text());groups={}
for r in report['renders']:
 if r['kind']=='preset':groups.setdefault(r['animationId'],[]).append(r)
items=[]
for name,rows in groups.items():
 r=rows[len(rows)//2];items.append((name.replace('group-',''),app/r['file']))
board(items,'qa/app/preset-overview.jpg',4,w=360,h=540)
board([(str(a)+'° / browser',app/f'lid-{a:03}.png') for a in [0,15,30,60,90,105,120,130]],'qa/app/hinge-browser-views.jpg',4,w=500,h=390)
