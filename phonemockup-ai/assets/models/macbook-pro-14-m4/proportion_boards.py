"""Compare original Apple photographs with actual, uniformly scaled orthographic renders."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
p=Path(__file__).parent
font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
report=json.loads((p/'qa/profile-revision.json').read_text())
canvas=Image.new('RGB',(1680,1240),'#edf0f2');d=ImageDraw.Draw(canvas)
d.text((40,20),'MacBook Pro 14 M4 — proporsjonskontroll',font=font(29),fill='#15232e')
d.text((40,63),'Apple-referanse og revidert modell i samme målestokk. Lokket er åpnet 90°.',font=font(20),fill='#41596b')
def aligned(path,crop,ratio,anchor,bg):
 im=Image.open(path).convert('RGB').crop(crop);im=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS)
 out=Image.new('RGB',(760,740),bg)
 # Align chassis front and bottom datums; never stretch width/height independently.
 out.paste(im,(round(40-(anchor[0]-crop[0])*ratio),round(700-(anchor[1]-crop[1])*ratio)))
 return out
left=aligned(p/'references/product-1.jpg',(115,348,558,794),3*221.2/415,(123,781),'white')
right=aligned(p/'qa/right_90.png',(187,54,952,809),3/(1100/350),(202.4,789.642857),'#30373e')
for x,label,im in [(40,'Apple / sidebilde',left),(880,'Modell / ortografisk render',right)]:
 d.text((x,108),label,font=font(22),fill='#203541');canvas.paste(im,(x,145))
 d.line((x+40,865,x+40+221.2*3,865),fill='#007e83',width=2)
 d.text((x+250,863),'221,2 mm',font=font(17),fill='#007e83')
d.text((40,910),'Lukket — samme fysiske skala i begge bilder',font=font(22),fill='#203541')
for x,path,box in [(40,p/'references/ports-1.png',(21,99,978,186)),(880,p/'qa/closed_right.png',(92,53,1508,188))]:
 im=Image.open(path).convert('RGB').crop(box);ratio=720/im.width;im=im.resize((720,round(im.height*ratio)),Image.Resampling.LANCZOS);canvas.paste(im,(x+20,955))
a=report['comparisons']['apple_lower_silhouette'];b=report['comparisons']['apple_front_silhouette']
d.text((40,1060),'Total lukket kabinetthøyde: 15,50 mm. Skjermens overkant ved 90°: 225,00 mm over basens underside.',font=font(20),fill='#203541')
d.text((40,1102),f"Største profilavvik mot kildepiksler: side {a['before']['max_error_mm']:.2f} → {a['after']['max_error_mm']:.2f} mm; front {b['before']['max_error_mm']:.2f} → {b['after']['max_error_mm']:.2f} mm.",font=font(20),fill='#203541')
d.text((40,1147),'Referansebildene har pikselusikkerhet. Dette er en visuell målekontroll, ikke sertifisert produksjons-CAD.',font=font(18),fill='#536b79')
d.text((40,1183),'Kilder: Apple Support 121552 og Apple Store refurb-mbp14-m4-silver-202502_AV1. Se references.json.',font=font(17),fill='#536b79')
canvas.save(p/'qa/proportions-comparison.jpg',quality=95)
