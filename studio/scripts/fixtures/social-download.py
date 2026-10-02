"""Only selected by test-api.sh against studio_e2e, never the real API."""
import json
from pathlib import Path
import sys
import time

url, directory, maximum = sys.argv[1:]
if '/reel/e2e_' not in url:
    print(json.dumps({'type':'error','code':'unsupported'}), flush=True)
    sys.exit(1)
if 'e2e_blocked' in url:
    print(json.dumps({'type':'error','code':'login_required'}), flush=True)
    sys.exit(1)
if 'e2e_slow' in url:
    time.sleep(60)  # worker must kill this process on cancellation
data = Path(__file__).with_name('social-video.mp4').read_bytes()
Path(directory, 'media.mp4').write_bytes(data)
print(json.dumps({'type':'progress','downloaded':len(data),'total':len(data)}),flush=True)
print(json.dumps({'type':'result','file_name':'media.mp4','title':'Importtest design',
                  'description':'Typography, logo and packaging design for a new brand.',
                  'uploader':'Test creator','width':160,'height':240,'duration':1,
                  'extractor':'Instagram','external_id':'fixture'}),flush=True)
