"""Small deterministic demo artwork and keyboard legend atlas, no baked device lighting."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import math,json
p=Path(__file__).parent
p.mkdir(exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
w,h=1512,982
im=Image.new('RGB',(w,h));pix=im.load()
for y in range(h):
 for x in range(w):
  a=x/w;b=y/h;d=abs(b-.57-.23*math.sin(a*5.6-.7));glow=math.exp(-d*d*36);fine=math.exp(-d*d*1500)
  pix[x,y]=(int(8+glow*(18+50*a)+fine*20),int(15+glow*(80-55*a)+fine*40),int(24+glow*(95+25*a)+fine*48))
d=ImageDraw.Draw(im)
d.text((90,85),'PHONEMOCKUP   /   STUDIO',font=ImageFont.truetype(font,19),fill='#b8c9d0')
d.text((82,255),'Room to',font=ImageFont.truetype(bold,104),fill='#f2f4f5')
d.text((82,370),'create.',font=ImageFont.truetype(bold,104),fill='#f2f4f5')
d.text((90,820),'Your work. In focus.',font=ImageFont.truetype(font,27),fill='#cddae0')
d.text((90,890),'MACBOOK PRO 14  /  3024 × 1964',font=ImageFont.truetype(font,16),fill='#7f99a8')
im.save(p/'screen-demo.png',optimize=True)
# The same opaque atlas supplies just the flat tops of all 78 keycaps.
# Each key retains its own bevel geometry; UV cells have padding.
labels=['esc']+[f'F{i}' for i in range(1,13)]+['']
labels += ['~\n`','!\n1','@\n2','#\n3','$\n4','%\n5','^\n6','&\n7','*\n8','(\n9',')\n0','_\n-','+\n=','delete']
labels += ['tab']+list('QWERTYUIOP')+['{\n[','}\n]','|\n\\']
labels += ['caps lock']+list('ASDFGHJKL')+[':\n;','"\n\'','return']
labels += ['shift']+list('ZXCVBNM')+['<\n,','>\n.','?\n/','shift']
labels += ['fn','control','option','command','','command','option','◀','▼','▲','▶']
assert len(labels)==78
atlas=Image.new('RGB',(2048,1024),'#111214')
units=[1.5]+[1]*13+[1]*13+[1.5]+[1.5]+[1]*13+[1.75]+[1]*11+[1.75]+[2.25]+[1]*10+[2.25]+[1,1,1,1.25,5,1.25,1,1,1,1,1]
assert len(units)==78
for i,label in enumerate(labels):
    kw=units[i]*18.85-2.35;kh=7.3 if i>=74 else 16.5
    scale=16
    patch=Image.new('RGB',(round(kw/.76*scale),round(kh/.76*scale)),'#111214');q=ImageDraw.Draw(patch);cx=patch.width/2;cy=patch.height/2
    size=2.7 if len(label)==1 else 1.65 if len(label)>3 else 2.4
    if '\n' in label:size=2.55
    f=ImageFont.truetype(font,round(size*scale))
    if 1<=i<=12:
        ff=ImageFont.truetype(font,round(1.20*scale));q.text((cx+kw*.27*scale,cy+kh*.24*scale),label,font=ff,fill='#cfd1d4',anchor='mm')
        rr=1.75*scale;yy=cy-.9*scale;stroke=3
        if i in [1,2]:
            q.ellipse((cx-rr*.65,yy-rr*.65,cx+rr*.65,yy+rr*.65),outline='#cfd1d4',width=stroke)
            for j in range(8):
                a=j*math.pi/4;q.line((cx+rr*.95*math.cos(a),yy+rr*.95*math.sin(a),cx+rr*1.32*math.cos(a),yy+rr*1.32*math.sin(a)),fill='#cfd1d4',width=stroke)
        elif i==3:
            for dx,dy in [(-1,-1),(1,-1),(-1,1),(1,1)]:q.rectangle((cx+dx*rr-rr*.72,yy+dy*rr-rr*.48,cx+dx*rr+rr*.72,yy+dy*rr+rr*.48),outline='#cfd1d4',width=stroke)
        elif i==4:
            q.ellipse((cx-rr,yy-rr,cx+rr*.5,yy+rr*.5),outline='#cfd1d4',width=stroke);q.line((cx+rr*.3,yy+rr*.3,cx+rr,yy+rr),fill='#cfd1d4',width=stroke)
        elif i==5:
            q.rounded_rectangle((cx-rr*.32,yy-rr,cx+rr*.32,yy+rr*.25),radius=rr*.3,outline='#cfd1d4',width=stroke);q.arc((cx-rr*.6,yy-rr*.5,cx+rr*.6,yy+rr*.65),0,180,fill='#cfd1d4',width=stroke);q.line((cx,yy+rr*.6,cx,yy+rr),fill='#cfd1d4',width=stroke)
        elif i==6:
            q.ellipse((cx-rr,yy-rr,cx+rr,yy+rr),fill='#cfd1d4');q.ellipse((cx-rr*.2,yy-rr*1.25,cx+rr*1.4,yy+rr*.4),fill='#111214')
        elif i in [7,8,9]:
            for off in ([-.6,.6] if i!=8 else [0]):
                sign=-1 if i==7 else 1;xx=cx+off*rr;q.polygon([(xx+sign*rr*.48,yy),(xx-sign*rr*.42,yy-rr*.7),(xx-sign*rr*.42,yy+rr*.7)],fill='#cfd1d4')
        else:
            q.polygon([(cx-rr*.7,yy-rr*.28),(cx-rr*.25,yy-rr*.28),(cx+rr*.35,yy-rr*.8),(cx+rr*.35,yy+rr*.8),(cx-rr*.25,yy+rr*.28),(cx-rr*.7,yy+rr*.28)],fill='#cfd1d4')
            if i==10:q.line((cx-rr,yy-rr,cx+rr,yy+rr),fill='#cfd1d4',width=stroke)
            if i>=11:q.arc((cx,yy-rr*.65,cx+rr*1.3,yy+rr*.65),-65,65,fill='#cfd1d4',width=stroke)
            if i==12:q.arc((cx-rr*.1,yy-rr,cx+rr*1.9,yy+rr),-65,65,fill='#cfd1d4',width=stroke)
    else:
        box=q.multiline_textbbox((0,0),label,font=f,spacing=scale*.8,align='center')
        q.multiline_text((cx-(box[2]-box[0])/2,cy-(box[3]-box[1])/2-box[1]),label,font=f,spacing=round(scale*.8),align='center',fill='#cfd1d4')
    atlas.paste(patch.resize((128,192),Image.Resampling.LANCZOS),((i%16)*128,(i//16)*192))
atlas.save(p/'key-legends.jpg',quality=96,subsampling=0)
(p/'key-labels.json').write_text(json.dumps(labels))
