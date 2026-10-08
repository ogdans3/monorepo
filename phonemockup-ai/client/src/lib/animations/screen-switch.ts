import type { Track } from "$lib/components/mock-video/Project";

export type ScreenCutCue = {
  id: string;
  track: string;
  start: number;
  end: number;
  at: number;
};

/** Derive cues from the saved clips so moving/scaling a clip also moves its cut. */
export function screenCutCues(tracks: Track[]): ScreenCutCue[] {
  return tracks
    .flatMap((track) =>
      track.animations.flatMap((clip) => {
        if (
          !clip.screenCut ||
          !Number.isFinite(clip.start) ||
          !Number.isFinite(clip.end) ||
          clip.end <= clip.start
        )
          return [];
        const a = clip.startKeyframe,
          b = clip.endKeyframe;
        for (const kind of ["position", "rotation"] as const) {
          for (const axis of ["x", "y", "z"] as const) {
            if (
              !Number.isFinite(a[kind][axis]) ||
              !Number.isFinite(b[kind][axis]) ||
              Math.abs(a[kind][axis] - b[kind][axis]) > 1e-6
            )
              return [];
          }
        }
        // Audited phones face +Z at rest. Do not advertise a hidden cut after
        // the user edits this hold to show the front, or adds another rotation.
        const facing =
          Math.cos((a.rotation.x * Math.PI) / 180) *
          Math.cos((a.rotation.y * Math.PI) / 180);
        if (facing > -0.95) return [];
        const at = Math.ceil(((clip.start + clip.end) / 2) * 30 - 1e-9) / 30;
        if (at >= clip.end) return [];
        return [
          {
            id: clip.id,
            track: track.phoneName,
            start: clip.start,
            end: clip.end,
            at,
          },
        ];
      }),
    )
    .sort((a, b) => a.at - b.at);
}

/** Make ordinary screen media, so playback, every export format and saved
 * projects use the existing media path without a second rendering pipeline. */
export async function createScreenSwitchVideo(
  before: File,
  after: File,
  options: {
    at: number;
    duration: number;
    signal?: AbortSignal;
    onProgress?: (value: number) => void;
  },
): Promise<File> {
  if (!(
    options.at > 0 &&
    options.at < options.duration &&
    options.duration <= 60
  )) {
    throw new Error("Choose a cut inside a timeline of 60 seconds or less.");
  }
  if (!before.type.startsWith("image/") || !after.type.startsWith("image/"))
    throw new Error("Choose two images for the screen switch.");
  if (typeof VideoEncoder === "undefined")
    throw new Error(
      "Screen switches need a browser with video encoding support. Try a current Chrome, Edge or Safari.",
    );
  const { getFirstEncodableVideoCodec } = await import("mediabunny");
  const { default: Mux } =
    await import("$lib/components/mock-video/recording/ChromeWebMMuxer");
  let first: ImageBitmap | undefined, second: ImageBitmap | undefined;
  let mux: InstanceType<typeof Mux> | undefined;
  try {
    options.signal?.throwIfAborted();
    first = await createImageBitmap(before);
    second = await createImageBitmap(after);
    const scale = Math.min(1, 1920 / Math.max(first.width, first.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, 2 * Math.round((first.width * scale) / 2));
    canvas.height = Math.max(2, 2 * Math.round((first.height * scale) / 2));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the screen images.");
    const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
      width: canvas.width,
      height: canvas.height,
      bitrate: 6_000_000,
    });
    if (codec !== "avc" && codec !== "vp9" && codec !== "vp8")
      throw new Error(
        "This browser cannot encode the screen video. Try Chrome, Edge or Safari.",
      );
    const container = codec === "avc" ? "mp4" : "webm";
    const fps = 30,
      frameCount = Math.ceil(options.duration * fps);
    mux = new Mux({ canvas, fps, codec, container, bitrate: 6_000_000 });
    await mux.init();
    let previous: ImageBitmap | undefined;
    for (let frame = 0; frame < frameCount; frame++) {
      options.signal?.throwIfAborted();
      const picture = frame / fps + 1e-9 >= options.at ? second : first;
      if (picture !== previous) {
        const fill = Math.max(
          canvas.width / picture.width,
          canvas.height / picture.height,
        );
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          picture,
          (canvas.width - picture.width * fill) / 2,
          (canvas.height - picture.height * fill) / 2,
          picture.width * fill,
          picture.height * fill,
        );
        previous = picture;
      }
      await mux.addFrame(frame / fps, 1 / fps);
      if (frame % 15 === 0) {
        options.onProgress?.(frame / frameCount);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const blob = await mux.finalize();
    options.signal?.throwIfAborted();
    options.onProgress?.(1);
    return new File(
      [blob],
      `screen-switch-${options.at.toFixed(2)}s.${container}`,
      { type: blob.type },
    );
  } finally {
    first?.close();
    second?.close();
    await mux?.cancel();
  }
}
