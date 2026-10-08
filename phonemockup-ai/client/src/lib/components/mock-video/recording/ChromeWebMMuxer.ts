// ChromeMediabunnyMux.ts
import {
    Output,
    BufferTarget,
    WebMOutputFormat,
    Mp4OutputFormat,
    CanvasSource,
} from "mediabunny";

export function hasWebCodecs(): boolean {
    return (
        typeof window !== "undefined" &&
        "VideoEncoder" in window &&
        "VideoFrame" in window
    );
}

export type Container = "webm" | "mp4";

export type ChromeMediabunnyMuxOptions = {
    canvas: HTMLCanvasElement;
    fps: number;
    codec?: "av1" | "vp8" | "vp9" | "avc" | "hevc";
    bitrate?: number;
    rotation?: 0 | 90 | 180 | 270;
    frameRate?: number;
    container?: Container;
    // MP4-only (ignored for WebM). See mediabunny docs for details.
    fastStart?: false | "in-memory" | "fragmented";
    /** "keep" encodes the canvas' transparency; only WebM can carry it. */
    alpha?: "keep" | "discard";
};

export default class ChromeMediabunnyMux {
    private canvas: HTMLCanvasElement;
    private fps: number;
    private codec: NonNullable<ChromeMediabunnyMuxOptions["codec"]>;
    private bitrate: number;
    private container: Container;
    private fastStart: ChromeMediabunnyMuxOptions["fastStart"];
    private alpha: "keep" | "discard";

    private output: Output | null = null;
    private videoSource: CanvasSource | null = null;
    private started = false;

    constructor(opts: ChromeMediabunnyMuxOptions) {
        this.canvas = opts.canvas;
        this.fps = opts.fps;
        this.container = opts.container ?? "webm";
        // Sensible defaults per container
        this.codec =
            opts.codec ??
            (this.container === "mp4" ? ("avc" as const) : ("vp9" as const));
        this.bitrate = opts.bitrate ?? 8_000_000;
        this.fastStart = opts.fastStart ?? "in-memory";
        this.alpha = this.container === "webm" ? opts.alpha ?? "discard" : "discard";
    }

    async init(): Promise<void> {
        // Pick container
        const format =
            this.container === "mp4"
                ? new Mp4OutputFormat({
                    // 'in-memory' produces a standard fast-start MP4 blob
                    fastStart: this.fastStart,
                })
                : new WebMOutputFormat();

        const output = new Output({
            format,
            target: new BufferTarget(),
        });

        // Drive video from the canvas using WebCodecs
        const videoSource = new CanvasSource(this.canvas, {
            codec: this.codec, // 'avc' for MP4, 'vp9' for WebM by default
            bitrate: this.bitrate,
            alpha: this.alpha,
        });

        // Snap timestamps to fps
        output.addVideoTrack(videoSource, {frameRate: this.fps});

        await output.start();

        this.output = output;
        this.videoSource = videoSource;
        this.started = true;
    }

    async addFrame(tSec: number, durationSec: number): Promise<void> {
        if (!this.started || !this.videoSource) {
            throw new Error("Mux not initialized. Call init() first.");
        }
        await this.videoSource.add(tSec, durationSec);
    }

    async finalize(): Promise<Blob> {
        if (!this.output) throw new Error("Mux not initialized.");

        await this.output.finalize();

        const buffer = (this.output.target as BufferTarget).buffer;
        if (!buffer) throw new Error("No buffer produced by BufferTarget");

        const mime = this.output.format.mimeType || this.guessMime();
        const blob = new Blob([new Uint8Array(buffer)], {type: mime});

        // Cleanup
        this.videoSource = null;
        this.output = null;
        this.started = false;

        return blob;
    }

    async cancel(): Promise<void> {
        if (!this.output) return;
        await this.output.cancel();
        this.videoSource = null;
        this.output = null;
        this.started = false;
    }

    private guessMime(): string {
        return this.container === "mp4" ? "video/mp4" : "video/webm";
    }
}