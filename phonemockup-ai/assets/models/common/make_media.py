from pathlib import Path
import sys,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
out=Path(sys.argv[1]);w,h=map(int,sys.argv[2:4]);theme=sys.argv[4] if len(sys.argv)>4 else 'jade'
y,x=np.mgrid[0:h,0:w].astype(float);x/=w;y/=h
r=np.sqrt(((x-.90)*1.28)**2+((y-.66)*.94)**2)
wave=(.5+.5*np.cos(34*r+4*x))**12;glow=np.exp(-((r-.5)/.37)**2)
a=.022+.32*glow+.29*wave*glow
a*=.48+.52*np.clip(y*3,0,1)
color=[.65,1.0,.86] if theme=='jade' else [.74,.79,1.16]
im=Image.fromarray(np.uint8(np.clip(np.stack([a*k for k in color],-1),0,1)*255));d=ImageDraw.Draw(im)
reg='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def text(x,y,s,size,strong=False,anchor='mm',fill='#edf3ef'):
 d.text((w*x,h*y),s,font=ImageFont.truetype(bold if strong else reg,int(size*w/1280)),anchor=anchor,fill=fill)
text(.5,.115,'Thursday, October 1',38)
text(.5,.168,'9:41',205)
text(.08,.694,'MAKE IT',103,True,'lt');text(.08,.741,'MOVE.',152,True,'lt')
text(.085,.826,'Your screen. Your story.',36,False,'lt')
text(.5,.938,'PHONEMOCKUP / '+('002' if theme=='jade' else '003'),26)
d.rounded_rectangle((w*.35,h*.975,w*.65,h*.981),radius=w*.01,fill='#e2eae5')
im.save(out/'screen-demo.png',optimize=True)
im=Image.new('RGB',(w,h),'#102938');d=ImageDraw.Draw(im)
for i in range(8):
 for j in range(18):
  d.rectangle((i*w/8,j*h/18,(i+1)*w/8,(j+1)*h/18),fill=('#23475b' if (i+j)%2 else '#162e3d'),outline='#659dae',width=2)
  d.text((i*w/8+10,j*h/18+12),f'{i},{j}',font=ImageFont.truetype(reg,26),fill='white')
for pos,col in [((0,0,w/2,h/5),'#146dac'),((w/2,0,w,h/5),'#a02c40'),((0,h*4/5,w/2,h),'#27966b'),((w/2,h*4/5,w,h),'#b88627')]:d.rectangle(pos,fill=col)
def lab(y,s,size):d.text((w/2,h*y),s,font=ImageFont.truetype(bold,size),anchor='mm',fill='white')
lab(.10,'TOPP',90);lab(.50,f'{w} x {h}',68);lab(.90,'BUNN',90)
d.line((w/2,0,w/2,h),fill='white',width=4);d.line((0,h/2,w,h/2),fill='white',width=4)
im.save(out/'screen-alignment.png',optimize=True)
