from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,textwrap
root=Path(__file__).resolve().parents[2]
import argparse
parser=argparse.ArgumentParser(description='Assemble the eight additional motion previews, including real screen transitions.')
parser.add_argument('--output-dir',type=Path,default=root/'assets/motion-2026/showreel')
out=parser.parse_args().output_dir.resolve()
out.mkdir(parents=True,exist_ok=True)
ffmpeg=str(root/'mcp/node_modules/ffmpeg-static/ffmpeg')
fontdir=Path('/usr/share/fonts/truetype/dejavu')
def font(size,bold=False):return ImageFont.truetype(str(fontdir/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size)
report=json.loads((root/'assets/motion-2026/qa/render-report.json').read_text())
ids=['macro-rush','pull-focus','orbit-dive','double-spin','barrel-roll','flip-cut','tumble-cut','whip-switch']
report['previews']=[next(p for p in report['previews'] if p['id']==id) for id in ids]
clips=[]
for i,item in enumerate(report['previews']):
 id=item['id']; group=json.loads((root/f'client/src/lib/animations/presets/{id}.json').read_text())
 im=Image.new('RGB',(1600,1000),'#f7f7f0');d=ImageDraw.Draw(im)
 d.rounded_rectangle((80,80,126,126),radius=12,fill='#20281f');d.text((88,89),'pm',font=font(19,True),fill='#d5e5bc')
 d.text((143,89),'PhoneMockup',font=font(27,True),fill='#20281f')
 d.text((80,240),f'MORE MOTION   /   {i+1:02d} OF 08',font=font(18),fill='#687063')
 d.text((75,300),group['name'],font=font(72,True),fill='#20281f')
 for line,text in enumerate(textwrap.wrap(group['description'],width=42)):
  d.text((80,417+line*38),text,font=font(27),fill='#687063')
 d.line((80,563,730,563),fill='#dddfd3',width=2)
 model={'iphone-16-pro':'iPhone 16 Pro','pixel-9-pro':'Pixel 9 Pro','galaxy-s24-ultra':'Galaxy S24 Ultra','macbook-pro-14-m4':'MacBook Pro 14 M4'}[group['previewModelId']]
 d.text((80,598),model,font=font(23,True),fill='#20281f')
 d.text((80,641),f"{max(a['end'] for a in group['animations']):g} seconds  /  Editable loop",font=font(22),fill='#687063')
 if group.get('screenCut'):
  d.text((80,706),f"Screen switch at {group['screenCut']['at']:.2f}s",font=font(23,True),fill='#33663a')
 d.text((80,884),'YOUR WORK. IN MOTION.',font=font(19,True),fill='#687063')
 card=out/f'{id}-card.png';im.save(card)
 clip=out/f'{id}-presentation.mp4'
 args=[ffmpeg,'-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',str(card),'-i',str(root/(f'assets/motion-2026/screen-switch-demos/{id}.mp4' if group.get('screenCut') else f'client/static/previews/motion-2026/{id}.mp4')),'-filter_complex','[0:v][1:v]overlay=880:100:shortest=1,format=yuv420p[v]','-map','[v]','-an','-c:v','libx264','-preset','fast','-threads','4','-crf','20','-t',str(item['duration']),'-r','24','-movflags','+faststart',str(clip)]
 subprocess.run(args,check=True);clips.append(clip)
 print('Prepared',group['name'],flush=True)
listing=out/'showreel-clips.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in clips))
reel=out/'phonemockup-more-motion.mp4'
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(reel)],check=True)
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(reel),'-f','null','-'],check=True)
print('Showreel ready:',reel,reel.stat().st_size,'bytes',sum(p['duration'] for p in report['previews']),'seconds')
