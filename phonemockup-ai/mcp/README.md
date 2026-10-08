# phonemockup MCP

A local MCP server that renders 3D phone mockups. An agent hands it a
screenshot or a screen recording and gets back a PNG, MP4, WebM or GIF of that
content running on a phone.

It runs the **same three.js scene as [phonemockup.app](https://phonemockup.app)**
— the shared code lives in `client/src/lib/render/scene-renderer.ts` and is used
by both the in-browser editor and this server, so there is one renderer, not
two that drift apart.

## No backend

Everything happens on the machine running the server:

- headless Chromium (via Playwright) executes the scene and rasterises frames
- ffmpeg encodes them
- results are written to a path you choose

Nothing is uploaded, no API is called, and no HTTP server is started — not even
a local one. The render page lives at a synthetic origin
(`https://phonemockup.local`) whose every request is answered from disk by a
Playwright route handler. The only network access in the whole system is
Playwright downloading a Chromium build the first time you install.

## Install

The harness is built from the client's source, so install both:

```bash
cd client && npm install
cd ../mcp && npm install   # also fetches Chromium and the ffmpeg binary
npm run build              # builds the render harness, then the server
```

Register it with your MCP client:

```json
{
  "mcpServers": {
    "phonemockup": {
      "command": "node",
      "args": ["/absolute/path/to/phonemockup-ai/mcp/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_phone_models` | Model ids to pass as `model`, flagging any whose asset is missing. |
| `list_animations` | Animation preset ids and their natural durations. |
| `render_mockup_image` | A still PNG/JPEG. Optionally posed at a moment from an animation. |
| `render_mockup_video` | An animated MP4, WebM or GIF, from a screenshot or a screen recording. |

Both render tools accept the same scene options: `model`, `preset` or
`width`/`height`, `background`, `glassReflections`, `caseColor` and
`antialias`. Backgrounds are `"transparent"`, `"#RRGGBB"` or `"#RRGGBBAA"`.

```jsonc
// A 6-second TikTok-shaped clip of your app spinning, on a Pixel 10
{
  "screenRecording": "/tmp/app-demo.mp4",
  "animation": "group-ball-turn",
  "output": "/tmp/promo.mp4",
  "width": 1080, "height": 1920,
  "fps": 30,
  "background": "#0b1020"
}
```

## Performance

Frames are rasterised in software (SwiftShader), because that is the only thing
guaranteed to work on a headless machine. Measured at 540x960 on this repo's
dev box:

| Setting | ms per frame |
| --- | --- |
| `antialias: true` (default) | ~1960 |
| `antialias: false` | ~615 |
| `antialias: false`, `glassReflections: false` | ~495 |

So antialiasing costs roughly 3x. For a long clip or a draft, turn it off.
Cost scales with pixel count, so resolution is the other big lever: a 3s clip
at 30fps is 90 frames, which is minutes, not seconds.

Two things follow from that:

- **Give the server a long timeout.** `render_mockup_video` emits
  `notifications/progress` per frame, so clients that reset their timeout on
  progress will stay connected. Clients that don't should be configured with a
  generous request timeout.
- **Set `PHONEMOCKUP_GPU=1`** on a machine with a usable GPU to let Chromium
  pick hardware rendering instead of SwiftShader.

## Configuration

| Variable | Meaning |
| --- | --- |
| `PHONEMOCKUP_STATIC_DIR` | Where the phone `.glb` files live. Defaults to `../client/static`. |
| `PHONEMOCKUP_GPU` | `1` to use hardware GL instead of SwiftShader. |
| `FFMPEG_PATH` | Override the bundled ffmpeg binary. |

The `.glb` models total ~85 MB and are read from the client's static directory
rather than copied in here. Publishing this package standalone would mean
bundling them or fetching them on demand.

## Scene notes

Every preset renders on every model. Keyframe depth is scaled by how far each
model rests from the camera, so zooms behave the same on the tiny Pixel models
as on the iPhones (see the "Models are centred" note in the repo's CLAUDE.md).
