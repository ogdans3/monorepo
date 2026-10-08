import ChromeMediabunnyMux from "$lib/components/mock-video/recording/ChromeWebMMuxer";
import type {IFrameEncoder} from "./RecordingTypes";

type WebMEncoderOptions = {
    canvas: HTMLCanvasElement;
    fps: number;
    codec?: "vp9" | "vp8" | "av1";
    bitrate?: number;
    alpha?: "keep" | "discard";
};

export class WebMEncoder implements IFrameEncoder {
    private muxer: ChromeMediabunnyMux;

    constructor(private opts: WebMEncoderOptions) {
        this.muxer = new ChromeMediabunnyMux({
            canvas: opts.canvas,
            fps: opts.fps,
            codec: opts.codec ?? "vp9",
            bitrate: opts.bitrate ?? 8_000_000,
            alpha: opts.alpha ?? "discard",
        });
    }

    async init() {
        await this.muxer.init();
    }

    async addFrame(tSec: number, dtSec: number) {
        await this.muxer.addFrame(tSec, dtSec);
    }

    async finalize() {
        return await this.muxer.finalize();
    }

    async cancel() {
        await this.muxer.cancel();
    }
}