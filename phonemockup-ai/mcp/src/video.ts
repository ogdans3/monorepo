import {spawn} from "node:child_process";
import {readdir} from "node:fs/promises";
import {join} from "node:path";
import ffmpegPath from "ffmpeg-static";

export type VideoFormat = "mp4" | "webm" | "gif";

function ffmpegBinary(): string {
    if (!ffmpegPath) {
        throw new Error(
            "ffmpeg-static did not provide a binary for this platform. " +
            "Install ffmpeg and set FFMPEG_PATH."
        );
    }
    return process.env.FFMPEG_PATH || ffmpegPath;
}

function run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBinary(), args, {stdio: ["ignore", "ignore", "pipe"]});
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
    fps: number
): Promise<string[]> {
    await run([
        "-y",
        "-i", input,
        "-vf", `fps=${fps}`,
        "-start_number", "0",
        join(outDir, "src-%06d.png")
    ]);

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
};

export async function encodeVideo(opts: EncodeOptions): Promise<void> {
    const input = ["-y", "-framerate", String(opts.fps), "-i", opts.framePattern];

    if (opts.format === "mp4") {
        await run([
            ...input,
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            // H.264 needs even dimensions; pad rather than crop so nothing is lost
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-movflags", "+faststart",
            opts.output
        ]);
        return;
    }

    if (opts.format === "webm") {
        await run([
            ...input,
            "-c:v", "libvpx-vp9",
            "-crf", "24",
            "-b:v", "0",
            "-pix_fmt", opts.transparent ? "yuva420p" : "yuv420p",
            opts.output
        ]);
        return;
    }

    // GIF: a per-clip palette is the difference between usable and banded.
    await run([
        ...input,
        "-vf",
        "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
        "-loop", "0",
        opts.output
    ]);
}
