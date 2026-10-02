"""Download one public social video. JSONL on stdout, no credentials or shell.

Only progressive HTTP(S) video is accepted; yt-dlp never invokes an external
network downloader. The socket guard applies to redirects and media/CDN requests
as well as initial pages, pins resolved addresses, and rejects private networks.
"""
import ipaddress
import json
import os
from pathlib import Path
import re
import resource
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit, urlunsplit

MAX_BYTES = 512 * 1024 * 1024
EXTRACTORS = {"Instagram", "TikTok", "TikTokVM", "SnapchatSpotlight"}
_original_connect = socket.socket.connect
_original_connect_ex = socket.socket.connect_ex


def public_address(value):
    ip = ipaddress.ip_address(value.split('%')[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if isinstance(ip, ipaddress.IPv6Address) and (ip.sixtofour or ip.teredo or ip in ipaddress.ip_network('64:ff9b::/96')):
        return False
    return ip.is_global and not ip.is_multicast and not ip.is_unspecified and not ip.is_reserved


def safe_target(sock, address):
    if sock.family not in (socket.AF_INET, socket.AF_INET6) or not isinstance(address, tuple):
        raise OSError('Unsupported network destination')
    host, port = address[:2]
    if port not in (80, 443):
        raise OSError('Only public web ports are allowed')
    records = socket.getaddrinfo(host, port, family=sock.family, type=socket.SOCK_STREAM)
    if not records or any(not public_address(row[4][0]) for row in records):
        raise OSError('Private network access is blocked')
    return records[0][4]  # numeric IP: the subsequent connect performs no DNS lookup


def install_network_guard():
    socket.socket.connect = lambda self, address: _original_connect(self, safe_target(self, address))
    socket.socket.connect_ex = lambda self, address: _original_connect_ex(self, safe_target(self, address))


def supported_url(value):
    u = urlsplit(value)
    if u.scheme != 'https' or u.username or u.password or u.port not in (None, 443) or len(value) > 2048:
        raise ValueError('unsupported')
    host, path = (u.hostname or '').lower(), u.path.rstrip('/')
    if host in ('instagram.com', 'www.instagram.com') and re.fullmatch(r'/(?:p|reels?|tv)/[A-Za-z0-9_-]+', path):
        return urlunsplit(('https', 'www.instagram.com', path+'/', '', ''))
    if host in ('tiktok.com', 'www.tiktok.com', 'm.tiktok.com') and (re.fullmatch(r'/@[^/]+/video/[0-9]+', path) or re.fullmatch(r'/t/[A-Za-z0-9]+', path)):
        return urlunsplit(('https', 'www.tiktok.com', path, '', ''))
    if host in ('vm.tiktok.com', 'vt.tiktok.com') and re.fullmatch(r'/[A-Za-z0-9]+', path):
        return urlunsplit(('https', host, path+'/', '', ''))
    if host in ('snapchat.com', 'www.snapchat.com') and re.fullmatch(r'/(?:spotlight|t)/[A-Za-z0-9_-]+', path):
        return urlunsplit(('https', 'www.snapchat.com', path, '', ''))
    raise ValueError('unsupported')


def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def probe_video(path):
    # Instagram also uses valid ISO5/DASH MP4 brands that Go's MIME sniff misses.
    # Inspect actual tracks without allowing ffprobe to open network references.
    result = subprocess.run(['ffprobe','-v','error','-protocol_whitelist','file,pipe',
        '-show_entries','format=format_name,duration:stream=codec_type,width,height',
        '-of','json',str(path)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
    info = json.loads(result.stdout)
    videos = [s for s in info.get('streams',[]) if s.get('codec_type')=='video']
    if not videos:
        raise ValueError('unsupported: missing video track')
    duration = float(info.get('format',{}).get('duration') or 0)
    if duration>1800:
        raise ValueError('too_large')
    formats = info.get('format',{}).get('format_name','').split(',')
    mime = 'video/mp4' if 'mp4' in formats else 'video/webm' if 'webm' in formats else None
    if not mime:
        raise ValueError('unsupported video container')
    return {'mime':mime,'duration':duration,'width':videos[0].get('width',0),'height':videos[0].get('height',0),
            'has_audio':any(s.get('codec_type')=='audio' for s in info.get('streams',[]))}


def error_code(error):
    text = str(error).lower()
    if 'private network' in text or 'unsupported network' in text:
        return 'unsupported'
    if any(w in text for w in ('login', 'log in', 'sign in', 'private', 'cookies', 'authentication')):
        return 'login_required'
    if any(w in text for w in ('too_large', 'file too large', 'exceeds maximum', 'max_filesize')):
        return 'too_large'
    if any(w in text for w in ('404', 'not available', 'unavailable', 'not found', 'removed', 'deleted')):
        return 'unavailable'
    if any(w in text for w in ('403', '429', 'blocked', 'challenge', 'captcha', 'rate limit')):
        return 'platform_blocked'
    if 'timed out' in text or 'timeout' in text:
        return 'timeout'
    if 'unsupported' in text or 'format is not available' in text:
        return 'unsupported'
    return 'download_failed'


class QuietLogger:
    def debug(self, message): pass
    def warning(self, message): pass
    def error(self, message): pass


def download(url, directory, max_bytes, output=emit):
    from yt_dlp import YoutubeDL
    from yt_dlp.extractor.instagram import InstagramIE
    from yt_dlp.extractor.tiktok import TikTokIE, TikTokVMIE
    from yt_dlp.extractor.snapchat import SnapchatSpotlightIE
    from yt_dlp.networking import Request

    url = supported_url(url)
    last = 0.0
    def progress(data):
        nonlocal last
        received = int(data.get('downloaded_bytes') or 0)
        total = int(data.get('total_bytes') or data.get('total_bytes_estimate') or 0)
        if received > max_bytes or total > max_bytes:
            raise ValueError('too_large')
        if time.monotonic()-last >= .5 or data.get('status') == 'finished':
            output({'type':'progress','downloaded':received,'total':total})
            last = time.monotonic()

    # One directly downloadable video, including audio when the source provides it.
    def select_format(context):
        formats = [f for f in context['formats'] if f.get('protocol') in ('http','https')
                   and f.get('vcodec') != 'none' and not f.get('has_drm')
                   and min(f.get('height') or 0, f.get('width') or 0) <= 1080
                   and max(f.get('height') or 0, f.get('width') or 0) <= 1920
                   and (f.get('filesize') or 0) <= max_bytes]
        if not formats:
            raise ValueError('unsupported video format')
        with_audio = [f for f in formats if f.get('acodec') != 'none']
        yield (with_audio or formats)[-1]

    opts = {'quiet':True,'no_warnings':True,'logger':QuietLogger(), 'noplaylist':True,
            'extract_flat':False,'playlist_items':'1','retries':0,
            'fragment_retries':0,'extractor_retries':0,'socket_timeout':20,
            'cachedir':False,'proxy':'','enable_file_urls':False,'geo_bypass':False,
            'format':select_format,'max_filesize':max_bytes,'continuedl':False,
            'outtmpl':str(Path(directory)/'media.%(ext)s'), 'overwrites':False,
            'progress_hooks':[progress], 'postprocessors':[], 'nopart':False,
            'skip_unavailable_fragments':False,'allowed_extractors':list(EXTRACTORS)}

    class SafeDL(YoutubeDL):
        def urlopen(self, request):
            value = request if isinstance(request, str) else request.url
            parsed = urlsplit(value)
            if parsed.scheme not in ('http','https') or parsed.username or parsed.password or parsed.port not in (None,80,443):
                raise ValueError('unsupported request')
            return super().urlopen(request)

    with SafeDL(opts, auto_init=False) as ydl:
        for cls in (InstagramIE,TikTokIE,TikTokVMIE,SnapchatSpotlightIE):
            ydl.add_info_extractor(cls())
        # Share links redirect to the same supported, single-video URL shapes.
        path = urlsplit(url).path
        if '/t/' in path:
            with ydl.urlopen(Request(url)) as response:
                url = supported_url(response.url)
            if '/t/' in urlsplit(url).path:
                raise ValueError('unsupported share link')
        info = ydl.extract_info(url, download=False)
        # Album/profile imports must never silently pull a collection or its first video.
        if not info or info.get('_type','video') != 'video' or info.get('is_live') or info.get('live_status') == 'is_live':
            raise ValueError('unsupported: use a link to one video')
        if info.get('duration',0) and info['duration'] > 1800:
            raise ValueError('too_large')
        if info.get('has_drm') or info.get('extractor_key') not in EXTRACTORS:
            raise ValueError('unsupported')
        # process_info uses only the already selected HTTP format, never re-extracts a playlist.
        ydl.process_info(info)
        path = Path(ydl.prepare_filename(info))
        if not path.is_file() or path.is_symlink() or path.parent.resolve() != Path(directory).resolve():
            raise ValueError('download_failed')
        if path.stat().st_size <= 0 or path.stat().st_size > max_bytes:
            raise ValueError('too_large')
        measured = probe_video(path)
        result = {'type':'result','file_name':path.name,
                  'title':str(info.get('title') or 'Importert video')[:300],
                  'description':str(info.get('description') or '')[:12000],
                  'uploader':str(info.get('uploader') or info.get('channel') or '')[:200],
                  'external_id':str(info.get('id') or '')[:200], 'source_url':url,
                  'duration':info.get('duration') or 0,'width':info.get('width') or 0,
                  'height':info.get('height') or 0,'extractor':info.get('extractor_key'),
                  'tags':[str(t)[:80] for t in (info.get('tags') or [])[:20]]}
        result.update(measured)
        output(result)
        return result


def main():
    resource.setrlimit(resource.RLIMIT_FSIZE,(MAX_BYTES,MAX_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU,(180,180))
    install_network_guard()
    try:
        download(sys.argv[1],sys.argv[2],min(MAX_BYTES,int(sys.argv[3])))
    except Exception as error:
        emit({'type':'error','code':error_code(error)})
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
