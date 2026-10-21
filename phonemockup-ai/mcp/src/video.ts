import {spawn} from "node:child_process";
import {readdir} from "node:fs/promises";
import {join} from "node:path";
import ffmpegPath from "ffmpeg-static";

export type VideoFormat = "mp4" | "webm" | "gif";

/** FFMPEG_PATH wins, so a platform without a bundled binary can still run. */
function ffmpegBinary(): string {
    const binary = process.env.FFMPEG_PATH || ffmpegPath;
    if (!binary) {
        throw new Error(
            "ffmpeg-static did not provide a binary for this platform. " +
            "Install ffmpeg and set FFMPEG_PATH."
        );
    }
    return binary;
}

/** Runs ffmpeg. Aborting the signal kills it, as when the caller cancels. */
function run(args: string[], signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBinary(), args, {stdio: ["ignore", "ignore", "pipe"], signal});
        let stderr = "";
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
            // ffmpeg is chatty; only the tail matters when something fails
            if (stderr.length > 8000) stderr = stderr.slice(-8000);
        });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr}`));
        });
    });
}

/**
 * Decode a screen recording into a numbered PNG sequence.
 *
 * Videos are decoded up front rather than played inside the browser: headless
 * Chromium's bundled codecs are incomplete (no H.264 in the open-source
 * build), and seeking a `<video>` frame-accurately is unreliable.
 */
export async function extractFrames(
    input: string,
    outDir: string,
    fps: number,
    /** Seconds the render needs; nothing past it is decoded. */
    duration: number,
    signal?: AbortSignal
): Promise<string[]> {
    await run([
        "-y",
        "-i", input,
        "-t", String(duration),
        "-vf", `fps=${fps}`,
        "-start_number", "0",
        join(outDir, "src-%06d.png")
    ], signal);

    const files = (await readdir(outDir))
        .filter((f) => f.startsWith("src-") && f.endsWith(".png"))
        .sort();

    if (!files.length) {
        throw new Error(`ffmpeg produced no frames from ${input}`);
    }
    return files.map((f) => join(outDir, f));
}

export type EncodeOptions = {
    /** printf-style pattern of the rendered frames, e.g. `/tmp/x/out-%06d.png` */
    framePattern: string;
    fps: number;
    format: VideoFormat;
    output: string;
    /** Keep alpha. Ignored for mp4, which has no usable alpha support. */
    transparent: boolean;
    signal?: AbortSignal;
};

/** The colour description the editor's own exports carry. */
const BT709_TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"];

/**
 * Convert the frames to `format` with the BT.709 matrix. The scale does the
 * conversion itself, so the format must follow it; accurate rounding keeps
 * greys grey coming from the JPEG frames.
 */
function toBt709(format: string): string {
    return `scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=${format}`;
}

export async function encodeVideo(opts: EncodeOptions): Promise<void> {
    const input = ["-y", "-framerate", String(opts.fps), "-i", opts.framePattern];

    if (opts.format === "mp4") {
        await run([
            ...input,
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "18",
            // No B-frames, like the editor's own MP4s: Playwright's WebKit
            // showed a colour-tagged file with them as black frames.
            "-bf", "0",
            "-pix_fmt", "yuv420p",
            // H.264 needs even dimensions; pad rather than crop so nothing is
            // lost. Convert with the BT.709 matrix and say so in the file:
            // ffmpeg's default is BT.601, untagged, and players read HD video
            // as BT.709, so saturated colours shifted.
            "-vf", `pad=ceil(iw/2)*2:ceil(ih/2)*2,${toBt709("yuv420p")}`,
            ...BT709_TAGS,
            "-movflags", "+faststart",
            opts.output
        ], opts.signal);
        return;
    }

    if (opts.format === "webm") {
        await run([
            ...input,
            "-c:v", "libvpx-vp9",
            "-crf", "24",
            "-b:v", "0",
            "-pix_fmt", opts.transparent ? "yuva420p" : "yuv420p",
            "-vf", toBt709(opts.transparent ? "yuva420p" : "yuv420p"),
            ...BT709_TAGS,
            opts.output
        ], opts.signal);
        return;
    }

    // GIF: a per-clip palette is the difference between usable and banded.
    await run([
        ...input,
        "-vf",
        "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
        "-loop", "0",
        opts.output
    ], opts.signal);
}
