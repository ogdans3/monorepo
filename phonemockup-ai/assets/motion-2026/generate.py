"""Original motion direction and demo artwork. No third-party templates or footage."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'client/src/lib/animations/presets'
OUT.mkdir(parents=True,exist_ok=True)
# time, position (fractions of frame; model-relative depth), Euler degrees.
specs=[
 ('soft-orbit','Soft Orbit','A slow, floating orbit. Let the work breathe.','Cinematic','iphone-16-pro','#DDE7D5',6,True,False,[
 (0,(-.025,0,-.65),(-8,-22,-7)),(3,(.025,.018,-.45),(7,22,7)),(6,(-.025,0,-.65),(-8,-22,-7))]),
 ('edge-reveal','Edge Reveal','From a sliver of light to the whole story.','Reveal','iphone-16-pro','#E2DEF0',5.4,True,False,[
 (0,(0,0,-.5),(3,-78,-5)),(1.8,(0,0,-.45),(-3,9,2)),(3.5,(0,.01,-.35),(-3,-4,0)),(5.4,(0,0,-.5),(3,-78,-5))]),
 ('lift-off','Lift Off','A rising entrance with a soft landing.','Reveal','pixel-9-pro','#F1DFD1',5,True,False,[
 (0,(0,-.52,-1.7),(22,-24,-12)),(1.7,(0,.025,-.55),(-5,12,3)),(2.3,(0,0,-.5),(0,8,0)),(3.5,(0,0,-.5),(0,8,0)),(5,(0,-.52,-1.7),(22,-24,-12))]),
 ('slow-spin','Slow Spin','One measured turn. Every detail gets its moment.','Cinematic','galaxy-s24-ultra','#D8E5E9',6,True,False,[
 (0,(0,0,-.7),(8,-20,-3)),(1,(0,0,-.7),(8,-20,-3)),(5,(0,0,-.7),(8,340,-3)),(6,(0,0,-.7),(8,340,-3))]),
 ('detail-study','Detail Study','Move in close, glide across, pull back.','Detail','pixel-9-pro','#E9E3D9',6,True,True,[
 (0,(0,-.23,1.25),(-5,-12,-4)),(1.8,(0,.22,1.25),(5,12,4)),(3.4,(0,0,-.6),(-6,15,-5)),(4.4,(0,0,-.6),(-6,15,-5)),(6,(0,-.23,1.25),(-5,-12,-4))]),
 ('side-step','Side Step','A lateral glide with a little attitude.','Loop','galaxy-s24-ultra','#DFE7EE',5.6,True,False,[
 (0,(-.1,-.01,-.95),(8,-28,-8)),(2.8,(.1,.01,-.95),(-8,28,8)),(5.6,(-.1,-.01,-.95),(8,-28,-8))]),
 ('snap-in','Snap In','A quick entrance. A confident finish.','Reveal','iphone-16-pro','#E8DED9',4.4,True,False,[
 (0,(.42,-.1,-1.4),(10,52,-22)),(.85,(-.022,.016,-.55),(-3,-8,4)),(1.3,(0,0,-.5),(0,0,0)),(3,(0,0,-.5),(0,0,0)),(4.4,(.42,-.1,-1.4),(10,52,-22))]),
 ('top-down','Top Down','An overhead study, opening into a hero angle.','Cinematic','macbook-pro-14-m4','#DDE1F0',6,True,False,[
 (0,(0,0,-.5),(30,-22,-8)),(3,(0,.015,-.2),(-3,18,4)),(6,(0,0,-.5),(30,-22,-8))]),
]
for i,(id,name,desc,category,model,color,duration,loop,detail,keys) in enumerate(specs):
 def key(index,p,r):return {'id':f'{id}-key-{index}','position':dict(zip('xyz',p)),'rotation':dict(zip('xyz',r)),'opacity':1}
 clips=[]
 for n,(left,right) in enumerate(zip(keys,keys[1:])):
  t,p,r=left;end,p2,r2=right
  clips.append({'id':f'{id}-clip-{n}','name':name if len(keys)==2 else f'{name} · {n+1}', 'start':t,'end':end,'curve':'CubicOut' if id in ['lift-off','snap-in'] and n==0 else 'SineInOut', 'startKeyframe':key(n,p,r),'endKeyframe':key(n+1,p2,r2)})
 d={'id':id,'name':name,'description':desc,'preview':f'motion-2026/{id}.mp4','poster':f'motion-2026/{id}.webp','isOfficial':True,'isCommunity':False,'favorited':False,'priority':100-i,'categories':[category], 'loop':loop,'framing':'detail' if detail else 'full','previewModelId':model,'previewBackground':[int(color[n:n+2],16) for n in (1,3,5)]+[1],'demoMediaId':'workspace' if 'macbook' in model else 'focus','animations':clips}
 (OUT/(id+'.json')).write_text(json.dumps(d,indent=2)+'\n')
# Small, original screen designs used by both the published previews and the editor.
media=ROOT/'client/static/media/studio';media.mkdir(parents=True,exist_ok=True)
fontdir=Path('/usr/share/fonts/truetype/dejavu')
def font(size,bold=False):return ImageFont.truetype(str(fontdir/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size)
im=Image.new('RGB',(1206,2622),'#14271F');d=ImageDraw.Draw(im)
def text(x,y,s,size=40,fill='#F1F3E8',bold=False):d.text((x,y),s,font=font(size,bold),fill=fill)
text(84,66,'9:41',34, bold=True);d.rounded_rectangle((1030,79,1110,110),radius=9,outline='#F1F3E8',width=3);d.rounded_rectangle((1037,85,1090,104),radius=4,fill='#C7F27A')
text(84,233,'FORMA',42,bold=True);text(84,329,'A LITTLE MORE SPACE FOR YOU',24,fill='#9CAF9A')
text(77,447,'Make',148,bold=True);text(77,605,'room.',148,bold=True)
d.ellipse((173,936,1033,1796),outline='#31483B',width=10);d.arc((173,936,1033,1796),-90,200,fill='#C7F27A',width=24)
d.ellipse((207,970,999,1762),fill='#1D3428');text(356,1175,'25:00',116,fill='#D1F293');text(360,1348,'DEEP FOCUS',32,fill='#A7BEA1');text(444,1490,'SESSION 04',26)
d.rounded_rectangle((84,1900,1122,2190),radius=44,fill='#253D2E');text(124,1947,"Today's rhythm",33,fill='#A7BEA1');text(124,2020,'2h 40m',70,bold=True)
for i,h in enumerate([42,75,64,100,82,124,111]):d.rounded_rectangle((720+i*43,2135-h,748+i*43,2135),radius=9,fill='#C7F27A' if i==6 else '#799866')
d.rounded_rectangle((84,2287,1122,2429),radius=71,fill='#C7F27A');text(302,2328,'Start a session  →',43,fill='#14271F',bold=True)
d.rounded_rectangle((423,2537,783,2548),radius=6,fill='#DBE5D5')
im.save(media/'focus.png',optimize=True)
im=Image.new('RGB',(1920,1248),'#EDEFE5');d=ImageDraw.Draw(im)
def text(x,y,s,size=30,fill='#17251B',bold=False):d.text((x,y),s,font=font(size,bold),fill=fill)
d.rectangle((0,0,324,1248),fill='#182B20');text(55,60,'FORMA',35,'#E5F4C8',True)
for n,label in enumerate(['Overview','My space','Sessions','Collections']):text(55,217+n*78,label,24,'#DDE6D2' if n==0 else '#90A38F')
text(410,66,'YOUR PERSONAL SPACE',19,'#5C715C');text(410,128,'Good things take focus.',60,bold=True);text(410,223,'Make a little room for what matters.',25,'#5C715C')
for x,w,fill in [(410,824,'#C7F27A'),(1270,560,'#DFE4D5')]:d.rounded_rectangle((x,334,x+w,926),radius=32,fill=fill)
text(458,383,'NEXT SESSION',19);text(458,448,'Clear the noise.',52,bold=True);text(458,541,'One thing. Your full attention.',24)
d.ellipse((857,573,1167,883),outline='#496D37',width=4);text(901,686,'25:00',53)
d.rounded_rectangle((456,798,758,871),radius=36,fill='#182B20');text(501,820,'Start focusing  →',22,'#EDF4DA')
text(1310,382,'THIS WEEK',20);text(1310,450,'12h 45m',51,bold=True)
for i,h in enumerate([75,100,60,140,180,130,203]):d.rounded_rectangle((1310+i*64,839-h,1350+i*64,839),radius=10,fill='#758F63' if i<6 else '#213D29')
text(416,1010,'YOUR COLLECTIONS',20,'#5C715C')
for i,label in enumerate(['Deep work','A fresh start','Space to think']):
 x=410+i*480;d.rounded_rectangle((x,1064,x+450,1170),radius=20,fill='#E0E5D7');text(x+30,1100,label,25,bold=True)
im.save(media/'workspace.png',optimize=True)
print('Generated',len(specs),'presets and 2 original demo screens')
