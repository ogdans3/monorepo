from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
base=Path(__file__).resolve().parent
src=Image.open(base/'references/google-product-triple-via-phonandroid.jpg').convert('RGB')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
b=Image.new('RGB',(2100,860),'#efede9');d=ImageDraw.Draw(b)
d.text((25,18),'PIXEL 9 PRO | Reference / actual Blender render / cyan silhouette overlay',font=font,fill='#24343a')
for i,(name,crop) in enumerate([('front',(226,36,546,710)),('back',(582,36,899,710)),('right',(935,36,991,710))]):
 ref=src.crop(crop).resize((round((crop[2]-crop[0])*650/(crop[3]-crop[1])),650),Image.Resampling.LANCZOS)
 actual=Image.open(base/'qa'/(name+'.png')).convert('RGBA');box=actual.getchannel('A').getbbox();actual=actual.crop(box)
 # Align the nominal body top/bottom, retaining the model's original projected aspect.
 actual=actual.resize((round(actual.width*650/actual.height),650),Image.Resampling.LANCZOS)
 x=i*700+18;b.paste(ref,(x,92));b.paste(actual,(x+350 if i<2 else x+180,92),actual)
 if i<2:
  overlay=ref.copy().convert('RGBA');a=actual.getchannel('A');edge=a.filter(ImageFilter.FIND_EDGES);edge=edge.point(lambda p:255 if p>25 else 0)
  color=Image.new('RGBA',actual.size,(0,190,220,0));color.putalpha(edge);overlay.alpha_composite(color,((overlay.width-actual.width)//2,0));b.paste(overlay.resize((120,265)),(x+560,515))
 d.text((x,62),name.upper()+' | reference / model',font=font,fill='#24343a')
d.text((25,777),'Reference: Google product rendering reproduced by Phonandroid; source URL and pixel annotations in references.json.',font=font,fill='#34434a')
d.text((25,812),'Secondary measurements are raster estimates (typically ±0.65 mm), not dimensioned factory CAD.',font=font,fill='#34434a')
b.save(base/'qa/reference-comparison.jpg',quality=95)
