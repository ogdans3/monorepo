/** Render the exact editor timelines into mobile-friendly H.264 previews. */
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import ffmpeg from "ffmpeg-static";
import { RenderSession } from "../dist/renderer.js";
const root = resolve(import.meta.dirname, "../..");
const screenSwitchDemo = process.argv.includes("--screen-switch-demo");
const out = resolve(
  root,
  screenSwitchDemo
    ? "assets/motion-2026/screen-switch-demos"
    : "client/static/previews/motion-2026",
);
const qa = resolve(
  root,
  screenSwitchDemo
    ? "assets/motion-2026/qa/screen-switch-demos"
    : "assets/motion-2026/qa",
);
await mkdir(out, { recursive: true });
await mkdir(qa, { recursive: true });
const presets = [];
for (const name of await readdir(
  resolve(root, "client/src/lib/animations/presets"),
))
  presets.push(
    JSON.parse(
      await readFile(
        resolve(root, "client/src/lib/animations/presets", name),
        "utf8",
      ),
    ),
  );
presets.sort((a, b) => b.priority - a.priority);
const selected = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const groups = presets.filter(
  (p) =>
    (!selected.length || selected.includes(p.id)) &&
    (!screenSwitchDemo || p.screenCut),
);
const posterTime = {
  "soft-orbit": 1,
  "edge-reveal": 2.2,
  "lift-off": 2.5,
  "slow-spin": 0.5,
  "detail-study": 3.8,
  "side-step": 1,
  "snap-in": 1.8,
  "top-down": 2.5,
  "macro-rush": 0.4,
  "pull-focus": 2.6,
  "orbit-dive": 1,
  "double-spin": 0.3,
  "barrel-roll": 0.3,
  "flip-cut": 0.3,
  "tumble-cut": 0.3,
  "whip-switch": 0.3,
};
let previous = [];
try {
  previous = JSON.parse(
    await readFile(resolve(qa, "render-report.json"), "utf8"),
  ).previews;
} catch {}
const report = {
  renderer: "Shared SceneRenderer via public RenderSession",
  fps: 24,
  width: 640,
  height: 800,
  previews: selected.length
    ? previous.filter((p) => !selected.includes(p.id))
    : [],
};
const session = await RenderSession.launch();
async function encode(args, frames) {
  const proc = spawn(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let errors = "";
  proc.stderr.on("data", (d) => (errors += d));
  const done = new Promise((res, rej) => {
    proc.on("error", rej);
    proc.on("close", (code) => (code === 0 ? res() : rej(new Error(errors))));
  });
  for await (const bytes of frames)
    if (!proc.stdin.write(bytes)) await once(proc.stdin, "drain");
  proc.stdin.end();
  await done;
}
try {
  for (const group of groups) {
    const start = Date.now();
    const duration = Math.max(...group.animations.map((a) => a.end));
    const count = Math.round(duration * 24);
    await session.initScene({
      modelId: group.previewModelId,
      width: 640,
      height: 800,
      background: group.previewBackground,
      glassReflections: false,
      antialias: true,
    });
    await session.setScreenSource(
      resolve(root, `client/static/media/studio/${group.demoMediaId}.png`),
    );
    const poster = await session.renderFrame(
      group.id,
      posterTime[group.id],
      "image/png",
    );
    await encode(
      [
        "-f",
        "image2pipe",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        "88",
        resolve(out, `${group.id}.webp`),
      ],
      [poster],
    );
    const checkpoints = new Set([
      0,
      Math.round(count * 0.25),
      Math.round(count * 0.5),
      Math.round(count * 0.75),
      count - 1,
      ...(group.screenCut ? [Math.round(group.screenCut.at * 24)] : []),
    ]);
    async function* frames() {
      let switched = false;
      for (let i = 0; i < count; i++) {
        if (screenSwitchDemo && !switched && i / 24 >= group.screenCut.at) {
          await session.setScreenSource(
            resolve(root, "client/static/media/studio/focus-complete.png"),
          );
          switched = true;
        }
        const bytes = await session.renderFrame(
          group.id,
          i / 24,
          "image/jpeg",
          0.96,
        );
        if (checkpoints.has(i))
          await writeFile(
            resolve(qa, `${group.id}-${String(i).padStart(3, "0")}.jpg`),
            bytes,
          );
        if (i % 48 === 0) console.log(`${group.id}: ${i}/${count}`);
        yield bytes;
      }
    }
    const path = resolve(out, `${group.id}.mp4`);
    await encode(
      [
        "-f",
        "image2pipe",
        "-framerate",
        "24",
        "-vcodec",
        "mjpeg",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        path,
      ],
      frames(),
    );
    report.previews.push({
      id: group.id,
      model: group.previewModelId,
      frames: count,
      duration: count / 24,
      bytes: (await stat(path)).size,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
      renderSeconds: (Date.now() - start) / 1000,
    });
    await writeFile(
      resolve(qa, "render-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `DONE ${group.id}: ${report.previews.at(-1).bytes} bytes, ${report.previews.at(-1).renderSeconds}s`,
    );
  }
} finally {
  await session.close();
}
