"""Render/reference contact sheet using independent source crops, retaining projected aspect."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
b=Path(__file__).resolve().parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
board=Image.new('RGB',(1500,1200),'#e8e8e8');d=ImageDraw.Draw(board)
d.text((24,18),'GALAXY S24 ULTRA | Manufacturer reference / actual Blender geometry',font=font,fill='#24343a')
for i,(name,file,crop) in enumerate([('front','samsung-front-back.jpg',(512,82,852,784)),('back','samsung-rear-via-macbro.png',(329,91,943,1347))]):
 ref=Image.open(b/'references'/file).convert('RGBA').crop(crop);ref=ref.resize((round(ref.width*700/ref.height),700),Image.Resampling.LANCZOS)
 actual=Image.open(b/'qa'/(name+'.png')).convert('RGBA');actual=actual.crop(actual.getchannel('A').getbbox());actual=actual.resize((round(actual.width*700/actual.height),700),Image.Resampling.LANCZOS)
 x=i*750+20;board.paste(ref,(x,94),ref);board.paste(actual,(x+367,94),actual);d.text((x,61),name.upper()+' | reference / model',font=font,fill='black')
# The official side detail is cropped; compare the same 86 mm from the top, horizontally.
ref=Image.open(b/'references/samsung-elevation-3.jpg').crop((263,150,1044,257));ref.thumbnail((715,180));board.paste(ref,(30,872));d.text((30,830),'RIGHT: official cropped side profile',font=font,fill='black')
a=Image.open(b/'qa/right.png').convert('RGBA');a=a.crop(a.getchannel('A').getbbox());a=a.crop((0,0,a.width,round(a.height*86/162.3)));a=a.transpose(Image.Transpose.ROTATE_90);a=a.resize((715,round(a.height*715/a.width)),Image.Resampling.LANCZOS);board.paste(a,(780,872),a);d.text((780,830),'RIGHT: model, matching physical interval',font=font,fill='black')
d.text((25,1060),'Nominal body: 79 x 162.3 x 8.6 mm. Rear calibration: x330..941 / y92..1346 pixels.',font=font,fill='#34434a')
d.text((25,1100),'Secondary dimensions are raster estimates, typically ±0.65 mm; not certified factory CAD.',font=font,fill='#34434a')
d.text((25,1140),'Top and bottom checked against Samsung manual pages12–13 and firsthand photographs.',font=font,fill='#34434a')
board.save(b/'qa/reference-comparison.jpg',quality=95)
# All six geometrical views, with wide end rails fully visible.
board=Image.new('RGB',(1500,1080),'#e8e8e8');d=ImageDraw.Draw(board)
for i,k in enumerate(['front','back','left','right']):
 a=Image.open(b/'qa'/(k+'.png'));a=a.resize((round(a.width*650/a.height),650),Image.Resampling.LANCZOS);board.paste(a,(i*375+(375-a.width)//2,45),a);d.text((i*375+16,18),k.upper(),font=font,fill='black')
for i,k in enumerate(['top','bottom']):
 a=Image.open(b/'qa'/(k+'.png'));a.thumbnail((720,300));board.paste(a,(i*750+15,745),a);d.text((i*750+16,718),k.upper(),font=font,fill='black')
board.save(b/'qa/six-views.jpg',quality=94)
