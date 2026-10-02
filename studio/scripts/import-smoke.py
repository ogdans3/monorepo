"""Try supplied public video URLs in the isolated studio_media_test API only."""
import http.cookiejar
import json
import sys
import time
import urllib.request

origin = 'http://localhost:18089'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path, data=None):
    req=urllib.request.Request(origin+'/api'+path,json.dumps(data).encode() if data is not None else None,
                               headers={'Content-Type':'application/json','Origin':origin})
    with client.open(req,timeout=30) as response:
        return json.load(response)

if not sys.argv[1:]:
    raise SystemExit('Usage: python3 scripts/import-smoke.py <public-video-url> [...]')
if api('/auth/status')['setup']:
    api('/auth/bootstrap',{'name':'Media tester','email':'media@example.test','password':'test-media-password','token':'test-media-setup'})
else:
    api('/auth/login',{'email':'media@example.test','password':'test-media-password'})
product=api('/products')[0]['id']
ids=[api('/imports',{'product_id':product,'url':url})['id'] for url in sys.argv[1:]]
pending=set(ids)
deadline=time.monotonic()+600
while pending and time.monotonic()<deadline:
    for row in api('/imports?product='+product):
        if row['id'] not in pending:
            continue
        if row['status'] in ('failed','cancelled') or (row['status']=='completed' and row.get('media_status') not in ('queued','running')):
            print(json.dumps({key:row.get(key) for key in ('platform','status','stage','error_code','media_status','classification','warnings')},ensure_ascii=False),flush=True)
            pending.remove(row['id'])
    if pending:time.sleep(2)
if pending:raise SystemExit('Timed out waiting for test imports')
