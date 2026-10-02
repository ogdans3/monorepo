"""Exercise real local OCR, transcription, previews and search in an isolated DB.
Install espeak in api-test for --video (see README). No external media is used.
"""
import base64, json, time, urllib.request, urllib.error, http.cookiejar, subprocess, sys
origin='http://localhost:18089'
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,data=None,method=None,headers=None):
    body=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(origin+'/api'+path,body,method=method or ('POST' if data is not None else 'GET'),headers={'Content-Type':'application/json','Origin':origin,**(headers or {})})
    with client.open(req,timeout=120) as r:return json.load(r)
for attempt in range(30):
    try:
        status=request('/auth/status'); break
    except (ConnectionError, urllib.error.URLError):
        if attempt==29: raise
        time.sleep(1)
if status['setup']:request('/auth/bootstrap',{'name':'Media tester','email':'media@example.test','password':'test-media-password','token':'test-media-setup'})
else:request('/auth/login',{'email':'media@example.test','password':'test-media-password'})
p=request('/products')[0]['id']
# Generated fixtures carry no personal content and avoid external test media.
code="from PIL import Image,ImageDraw,ImageFont;import io,base64;im=Image.new('RGB',(640,480),'#f7f5ed');d=ImageDraw.Draw(im);d.rectangle((70,70,570,220),fill='#456646');d.text((90,300),'STUDIO TEST',font=ImageFont.load_default(size=48),fill='black');b=io.BytesIO();im.save(b,format='PNG');print(base64.b64encode(b.getvalue()).decode())"
raw=subprocess.check_output(['docker','compose','-f','compose.yml','-f','compose.test.yml','exec','-T','intelligence-test','python','-c',code],text=True)
def upload(data,name,title,body=''):
    session=request('/upload-sessions',{'product_id':p,'file_name':name,'title':title,'body':body,'rights':'owned','size':len(data)})
    for offset in range(0,len(data),8<<20):
        request('/upload-sessions/'+session['id'],data[offset:offset+(8<<20)],'PATCH',{'Upload-Offset':str(offset),'Content-Type':'application/octet-stream'})
    item=request('/upload-sessions/'+session['id']+'/complete',{})
    if item.get('duplicate'):request('/jobs',{'version_id':item['version_id'],'kind':'media'})
    deadline=time.monotonic()+240
    while time.monotonic()<deadline:
        detail=request('/items/'+item['id']);jobs=detail['extra']['jobs'] or []
        if jobs and jobs[0]['status'] in ('completed','failed','limited'):
            assert jobs[0]['status']=='completed',jobs[0]
            return item,detail
        time.sleep(2)
    raise AssertionError('Media processing did not finish')
image=base64.b64decode(raw.strip())
item,detail=upload(image,'smoke.png','Skilt på glatt vinterføre','Bilen trenger lengre avstand for å stoppe på is og snø.')
assert detail['extra']['artifacts'],'missing thumbnail'
assert any('STUDIO' in s['body'].upper() for s in detail['extra']['segments'] or []),'OCR did not find fixture text'
for _ in range(15):
    results=request('/search?q=bremsing%20p%C3%A5%20glatt%20vei&product='+p+'&mode=semantic')
    if any(r['target_id']==item['id'] for r in results):break
    time.sleep(2)
else:raise AssertionError('Semantic result missing')
visual=request('/search/image',{'product_id':p,'item_id':item['id']})
assert any(r['target_id']==item['id'] for r in visual),'Visual result missing'
report={'ocr':True,'semantic_search':True,'image_search':True,'thumbnail':True,'database':'studio_media_test'}

if '--video' in sys.argv:
    docker=['docker','compose','-f','compose.yml','-f','compose.test.yml','exec','-T','api-test']
    subprocess.run(docker+['espeak','-v','en','-s','135','-w','/tmp/studio-smoke.wav','Welcome to the studio. This is a test of automatic speech recognition. Please drive safely on the winter road.'],check=True)
    subprocess.run(docker+['ffmpeg','-v','error','-f','lavfi','-i','testsrc=size=320x240:rate=15','-i','/tmp/studio-smoke.wav','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y','/tmp/studio-smoke.mp4'],check=True)
    video=subprocess.check_output(docker+['cat','/tmp/studio-smoke.mp4'])
    video_item,video_detail=upload(video,'smoke.mp4','Synthetic speech and video fixture')
    kinds={r['kind'] for r in video_detail['extra']['artifacts']}
    assert {'thumbnail','proxy'}.issubset(kinds),kinds
    spoken=' '.join(s['body'] for s in video_detail['extra']['segments'] if s['kind']=='speech')
    assert 'studio' in spoken.lower(),spoken
    with client.open(origin+'/api/previews/'+video_item['version_id']+'?kind=proxy',timeout=30) as response:
        assert response.status==200 and len(response.read())>1000
    report.update({'video_proxy':True,'speech_transcription':True,'transcript':spoken})
print(json.dumps(report))
