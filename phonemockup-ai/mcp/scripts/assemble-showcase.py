"""Compose a silent 26s / 1080p presentation from the shared-renderer passes.

Usage: python3 mcp/scripts/assemble-showcase.py OUTPUT_DIR [--samples]
Requires Pillow; FFmpeg comes from the project's MCP dependencies.
"""
from pathlib import Path
from functools import lru_cache
import argparse, json, math, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageColor

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('output_dir', type=Path)
parser.add_argument('--samples', action='store_true')
args = parser.parse_args()
OUT = args.output_dir.resolve()
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS, DURATION = 1920, 1080, 24, 26
FFMPEG = ROOT/'mcp/node_modules/ffmpeg-static/ffmpeg'
FONT = Path('/usr/share/fonts/opentype/urw-base35')

def clamp(x): return max(0, min(1, x))
def ease(x):
    x = clamp(x)
    return 1-(1-x)**3

@lru_cache(maxsize=40)
def font(size, bold=True):
    return ImageFont.truetype(str(FONT/('NimbusSans-Bold.otf' if bold else 'NimbusSans-Regular.otf')), size)

SCENES = [
    dict(id='intro', start=0, length=3, bg='#153b2d', fg='#f4f2e8', accent='#c8ef79',
         model='iPhone 16 Pro', label='YOUR WORK. IN MOTION.', title=['Make it','move.'], size=172,
         sub='From your screen to the spotlight.'),
    dict(id='flip', start=3, length=4, bg='#f2efe5', fg='#163b2d', accent='#bedf85',
         model='iPhone 16 Pro', label='A NEW LOOK. IN ONE MOVE.', title=['One flip.','New story.'], size=142,
         sub='Change the screen. Keep the flow.'),
    dict(id='pixel', start=7, length=4, bg='#d8ccf2', fg='#282039', accent='#bca7e2',
         model='Google Pixel 9 Pro', label='MAKE EVERY ANGLE COUNT.', title=['Every angle.','All yours.'], size=137,
         sub='Roll. Zoom. Make it your own.'),
    dict(id='samsung', start=11, length=4, bg='#151b21', fg='#f4f2e8', accent='#c8ef79',
         model='Samsung Galaxy S24 Ultra', label='TURN UP THE MOVEMENT.', title=['Go full','circle.'], size=169,
         sub='Two full spins. Zero ordinary frames.'),
    dict(id='macbook', start=15, length=5, bg='#dce6e8', fg='#20363b', accent='#a2c8c8',
         model='MacBook Pro 14-inch M4', label='MORE ROOM FOR YOUR IDEAS.', title=['Open up.','Stand out.'], size=142,
         sub='A real hinge. A bigger canvas.'),
    dict(id='outro', start=20, length=6, bg='#d0ed9e', fg='#173b2c', accent='#a5cc72',
         model='', label='', title=[], size=140, sub=''),
]

@lru_cache(maxsize=6)
def backdrop(id):
    s = next(s for s in SCENES if s['id']==id)
    im = Image.new('RGBA',(W,H), s['bg'])
    glow = Image.new('RGBA',(W,H))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((830,-180,2100,1170),fill=(*ImageColor.getrgb(s['accent']),45))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(170)))
    return im

@lru_cache(maxsize=20)
def device(id, frame):
    p = OUT/id/f'{frame:04d}.png'
    if not p.exists() and args.samples:
        candidates=list((OUT/id).glob('*.png'))
        p=min(candidates,key=lambda p:abs(int(p.stem)-frame))
    with Image.open(p) as im:
        return im.convert('RGBA')

def put_device(im, id, seconds, x, y, scale=1):
    maximum = 119 if id=='macbook' else 71 if id=='intro' else 95
    frame = max(0,min(maximum,round(seconds*FPS)))
    layer=device(id,frame)
    if scale!=1:
        layer=layer.resize((round(layer.width*scale),round(layer.height*scale)),Image.Resampling.LANCZOS)
    im.alpha_composite(layer,(round(x),round(y)))

@lru_cache(maxsize=4)
def shadow(width,height,alpha):
    im=Image.new('RGBA',(width+200,height+200))
    ImageDraw.Draw(im).ellipse((100,100,width+100,height+100),fill=(6,22,14,alpha))
    return im.filter(ImageFilter.GaussianBlur(38))

def text(draw, xy, value, size, color, alpha=255, bold=True):
    fill=(*ImageColor.getrgb(color),round(clamp(alpha/255)*255))
    draw.text(xy,value,font=font(size,bold),fill=fill,anchor='lt')

def centered(draw,y,value,size,color,alpha=255):
    tw=draw.textlength(value,font=font(size))
    text(draw,((W-tw)/2,y),value,size,color,alpha)

def compose(s,t,global_t):
    im=backdrop(s['id']).copy()
    entry=ease(t/.55)
    fg=s['fg']; accent=s['accent']
    decor=Image.new('RGBA',(W,H)); dd=ImageDraw.Draw(decor)
    if s['id']!='outro':
        # Slow contour movement gives the stage depth without covering the model.
        drift=35*math.sin(t*.65)
        for inset in (0,54):
            dd.ellipse((980+inset+drift,205+inset,1815-inset+drift,1030-inset),
                       outline=(*ImageColor.getrgb(fg),15),width=2)
        im.alpha_composite(decor)
        if s['id']=='macbook':
            im.alpha_composite(shadow(730,65,34),(1030,845))
            put_device(im,'macbook',t,785+70*(1-entry),92+8*math.sin(t),.94)
        elif s['id']=='intro':
            im.alpha_composite(shadow(360,45,48),(1195,920))
            put_device(im,'intro',t,875,0,1.125)
        else:
            im.alpha_composite(shadow(350,45,34),(1220,925))
            put_device(im,s['id'],t,930+85*(1-entry)+18*math.sin(t*.9),50+12*math.sin(t*1.2))
    else:
        # The four real models remain in motion together for the closing card.
        for n,(id,x,y,scale,at) in enumerate([
            ('intro',92,515,.57,1.8+.95*(.5+.5*math.sin(t*.8))),
            ('pixel',490,525,.56,3.45+.45*(.5+.5*math.sin(t*.75))),
            ('samsung',874,526,.56,.18+.42*(.5+.5*math.sin(t*.9))),
            ('macbook',1240,570,.52,3.4+1.5*(.5+.5*math.sin(t*.7))),
        ]):
            stagger=ease((t-n*.09)/.7)
            put_device(im,id,at,x,y+110*(1-stagger)+13*math.sin(t*1.3+n),scale)

    overlay=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(overlay)
    # Persistent, quiet brand and progress navigation.
    d.rounded_rectangle((92,65,144,117),radius=14,fill=fg)
    text(d,(101,81),'pm',25,s['bg'])
    text(d,(162,80),'PhoneMockup',31,fg)
    top='3D MOCKUPS / IN MOTION' if s['id']!='outro' else 'YOUR NEXT GREAT PRESENTATION'
    text(d,(W-92-d.textlength(top,font=font(19,False)),83),top,19,fg,bold=False)
    if s['id']!='outro':
        text(d,(100+30*(1-entry),260),s['label'],20,fg,220*entry)
        for n,line in enumerate(s['title']):
            p=ease((t-.08*n)/.55)
            text(d,(91-70*(1-p),328+n*155+45*(1-p)),line,s['size'],fg,255*p)
        p=ease((t-.28)/.6)
        text(d,(101,690+22*(1-p)),s['sub'],31,fg,220*p,False)
        if s['id']=='flip':
            value='SCREEN B' if t>=2.05 else 'SCREEN A'
            d.rounded_rectangle((101,771,294,823),radius=26,fill=accent)
            text(d,(127,787),value,22,fg)
            for i in range(16):
                x=324+i*21
                d.line((x,786,x,808),fill=(*ImageColor.getrgb(fg),220 if i<16*t/4 else 35),width=4)
        elif s['id']=='samsung':
            # Graphic accent: a full 720-degree move, as actually rendered.
            text(d,(100,772),'720°',70,accent)
            text(d,(291,792),'FULL ROTATION',20,fg,200,False)
        elif s['id']=='macbook':
            p=ease(t/2.5)
            d.line((104,808,104+int(370*p),808),fill=fg,width=5)
            text(d,(102,835),'CLOSED  →  OPEN',19,fg,190,False)
        else:
            d.line((103,789,340,789),fill=accent,width=5)
        number={'intro':'01','flip':'01','pixel':'02','samsung':'03','macbook':'04'}[s['id']]
        text(d,(103,975),number+' / 04',20,fg,190,False)
        text(d,(255,972),s['model'],27,fg)
    else:
        if t<3:
            p=ease(t/.65)
            centered(d,204+30*(1-p),'Your screen.',136,fg,255*p)
            centered(d,345+30*(1-p),'Made cinematic.',136,fg,255*p)
            centered(d,505,'iPhone  ·  Pixel  ·  Galaxy  ·  MacBook',27,fg,220*p)
        else:
            p=ease((t-3)/.4)
            centered(d,244+20*(1-p),'PhoneMockup',159,fg,255*p)
            centered(d,431,'Ideas in motion.',43,fg,235*p)
            centered(d,510,'phonemockup-ai.freelunch.no',27,fg,200*p)
    d.rectangle((0,H-5,round(W*global_t/DURATION),H),fill=fg)
    im.alpha_composite(overlay)
    return im

def frame(t):
    index=max(i for i,s in enumerate(SCENES) if t>=s['start'])
    s=SCENES[index]; local=t-s['start']
    im=compose(s,local,t)
    if index>0 and local<.25:
        previous=SCENES[index-1]
        old=compose(previous,previous['length']-1/FPS,t)
        edge=-280+(W+560)*ease(local/.25)
        mask=Image.new('L',(W,H))
        ImageDraw.Draw(mask).polygon(((0,0),(edge+200,0),(edge-200,H),(0,H)),fill=255)
        im=Image.composite(im,old,mask)
    return im.convert('RGB')

samples=[.8,2.4,3.8,5,6.6,8,9.4,10.7,12,13.4,14.7,15.2,16.6,18.3,19.7,21.5,24.5,25.8]
if args.samples:
    for t in samples:
        frame(t).save(OUT/f'preview-{t:04.1f}.jpg',quality=92)
    print('Saved composition checkpoints',flush=True)
else:
    target=OUT/'phonemockup-showcase-26s-1080p.mp4'
    command=[str(FFMPEG),'-hide_banner','-loglevel','error','-y',
      '-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}',
      '-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','slow',
      '-crf','18','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.2',
      '-movflags','+faststart','-threads','4',str(target)]
    with open(OUT/'encode.log','w') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            for i in range(FPS*DURATION):
                im=frame(i/FPS)
                process.stdin.write(im.tobytes())
                if i%48==0: print(f'Composited {i}/{FPS*DURATION} frames',flush=True)
                if i in {round(t*FPS) for t in samples}:
                    im.save(OUT/f'preview-{i/FPS:04.1f}.jpg',quality=92)
        finally: process.stdin.close()
        if process.wait()!=0: raise RuntimeError('Encoding failed; see encode.log')
    subprocess.run([str(FFMPEG),'-hide_banner','-loglevel','error','-i',str(target),'-f','null','-'],check=True)
    (OUT/'video-manifest.json').write_text(json.dumps(dict(file=target.name,width=W,height=H,
      fps=FPS,frames=FPS*DURATION,duration=DURATION,audio=False,bytes=target.stat().st_size,
      scenes=[dict(id=s['id'],start=s['start'],duration=s['length'],model=s['model']) for s in SCENES]),indent=2)+'\n')
    print('Ready:',target,target.stat().st_size,'bytes',flush=True)
