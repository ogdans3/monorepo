"""Exercise real yt-dlp selection/download with deterministic HTTP responses."""
import copy
import io
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import download as importer
from yt_dlp import YoutubeDL
from yt_dlp.extractor.instagram import InstagramIE
from yt_dlp.networking import Response

URL = 'https://www.instagram.com/reel/Test123/'
MEDIA = (Path(__file__).resolve().parents[2]/'scripts/fixtures/social-video.mp4').read_bytes()


class ImportTests(unittest.TestCase):
    def info(self, **extra):
        return dict(id='Test123', title='Design and packaging', description='A brand process',
                    duration=12, uploader='Test author', tags=['design'],
                    formats=[dict(url='https://cdn.example/video.mp4', format_id='http',
                                  ext='mp4', vcodec='h264', acodec='aac', width=1080, height=1920)], **extra)

    def download(self, info=None, maximum=1_000_000):
        events = []
        def response(ydl, request):
            self.assertEqual(request.url, 'https://cdn.example/video.mp4')
            return Response(io.BytesIO(MEDIA), request.url, {'Content-Length': str(len(MEDIA))})
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(InstagramIE, '_real_initialize', return_value=None), \
                patch.object(InstagramIE, '_real_extract', return_value=copy.deepcopy(info or self.info())), \
                patch.object(YoutubeDL, 'urlopen', response):
            result = importer.download(URL, directory, maximum, events.append)
            self.assertEqual(Path(directory, result['file_name']).read_bytes(), MEDIA)
        return result, events

    def test_real_progressive_download(self):
        result, events = self.download()
        self.assertEqual(result['extractor'], 'Instagram')
        self.assertEqual(result['uploader'], 'Test author')
        self.assertEqual(result['height'], 240)  # measured from video, not guessed from source metadata
        self.assertEqual(result['mime'], 'video/mp4')
        self.assertFalse(result['has_audio'])
        self.assertTrue(any(e['type'] == 'progress' and e['downloaded'] == len(MEDIA) for e in events))
        self.assertEqual(events[-1]['type'], 'result')

    def test_instagram_iso5_brand_is_still_valid_video(self):
        header=bytes.fromhex('000000206674797069736f350000000169736f3564736d736d73697864617368')
        with patch(__name__+'.MEDIA',header+MEDIA[32:]):
            result,_=self.download()
        self.assertEqual(result['mime'],'video/mp4')

    def test_reject_non_video_file(self):
        with patch(__name__+'.MEDIA',b'<html>This is not a video</html>'), self.assertRaises(Exception):
            self.download()

    def test_reject_live_album_duration_hls_and_oversize(self):
        for info in (self.info(is_live=True), self.info() | {'duration':1801},
                     {'_type':'playlist','id':'album','title':'Album','entries':[]},
                     self.info() | {'formats':[dict(url='https://cdn.example/stream.m3u8',ext='mp4',protocol='m3u8_native')]}):
            with self.subTest(info=info), self.assertRaises(Exception):
                self.download(info)
        with self.assertRaises(Exception):
            self.download(maximum=10)

    def test_urls_and_share_shapes(self):
        self.assertEqual(importer.supported_url(URL+'?utm_source=test'), URL)
        for value in ('https://instagram.com/user/', 'http://www.instagram.com/reel/x/',
                      'https://www.instagram.com.evil.test/reel/x/', 'https://127.0.0.1/reel/x/',
                      'https://a@www.instagram.com/reel/x/', 'https://www.instagram.com:444/reel/x/',
                      'https://www.snapchat.com/add/person', 'file:///tmp/video.mp4'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                importer.supported_url(value)
        for value in ('https://vm.tiktok.com/123Ab/', 'https://www.tiktok.com/@user/video/1234',
                      'https://www.snapchat.com/spotlight/ABC_123', 'https://www.snapchat.com/t/abc'):
            self.assertTrue(importer.supported_url(value).startswith('https://'))

    def test_private_mixed_and_rebinding_destinations(self):
        for value in ('127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.2', '::1',
                      'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::a00:1', '2002:7f00:1::', '224.1.1.1', '0.0.0.0'):
            self.assertFalse(importer.public_address(value), value)
        record = lambda ip: (socket.AF_INET,socket.SOCK_STREAM,6,'',(ip,443))
        with socket.socket() as sock:
            with patch.object(socket, 'getaddrinfo', return_value=[record('8.8.8.8')]) as dns:
                self.assertEqual(importer.safe_target(sock, ('cdn.example',443)), ('8.8.8.8',443))
                dns.assert_called_once()  # connect will receive a pinned numeric address
            with patch.object(socket, 'getaddrinfo', return_value=[record('8.8.8.8'),record('127.0.0.1')]):
                with self.assertRaises(OSError):
                    importer.safe_target(sock, ('cdn.example',443))
            with self.assertRaises(OSError):
                importer.safe_target(sock, ('cdn.example',22))

    def test_share_redirect_revalidated(self):
        for destination in ('http://127.0.0.1/admin', 'https://instagram.com/user/', 'file:///etc/passwd'):
            with tempfile.TemporaryDirectory() as directory, \
                    patch.object(YoutubeDL, 'urlopen', return_value=Response(io.BytesIO(),destination,{})), \
                    self.assertRaises(ValueError):
                importer.download('https://www.snapchat.com/t/abc',directory,1000,lambda event:None)


if __name__ == '__main__':
    unittest.main()
