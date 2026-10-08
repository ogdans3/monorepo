// Mp4Encoder.ts
import type {IFrameEncoder} from "./RecordingTypes";
import ChromeMediabunnyMux from "./ChromeWebMMuxer";

type Mp4EncoderOptions = {
    canvas: HTMLCanvasElement;
    fps: number;
    codec?: "avc" | "hevc" | "av1";
    bitrate?: number;
    fastStart?: false | "in-memory" | "fragmented";
};

export class Mp4Encoder implements IFrameEncoder {
    private mux: ChromeMediabunnyMux;

    constructor(private opts: Mp4EncoderOptions) {
        this.mux = new ChromeMediabunnyMux({
            canvas: opts.canvas,
            fps: opts.fps,
            container: "mp4",
            codec: opts.codec ?? "avc",
            bitrate: opts.bitrate ?? 8_000_000,
            fastStart: opts.fastStart ?? "in-memory",
        });
    }

    async init(): Promise<void> {
        await this.mux.init();
    }

    async addFrame(tSec: number, dtSec: number): Promise<void> {
        await this.mux.addFrame(tSec, dtSec);
    }

    async finalize(): Promise<Blob> {
        return this.mux.finalize();
    }

    async cancel(): Promise<void> {
        await this.mux.cancel();
    }
}