# Ad preview fixture

`ad-render.mp4` is a synthetic, silent, two-second 180×320 H.264 test pattern.
It contains no user media. The ad browser tests upload it through the real MCP
and chunk APIs and wait for actual FFmpeg thumbnail/proxy generation.

Regenerate from the Studio directory after building its API image:

```sh
docker run --rm --network none --user "$(id -u):$(id -g)" \
  -v "$PWD/web/tests/fixtures:/fixtures" --entrypoint ffmpeg studio-api \
  -v error -f lavfi -i 'testsrc2=size=180x320:rate=12:duration=2' \
  -c:v libx264 -threads 1 -pix_fmt yuv420p -movflags +faststart \
  -y /fixtures/ad-render.mp4
```
