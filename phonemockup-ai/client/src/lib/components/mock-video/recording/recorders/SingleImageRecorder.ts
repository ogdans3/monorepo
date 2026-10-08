import type { ScenePair, VideoContext } from "../core/types";
import { renderAtTime, renderControls, sleep } from "../core/settle";

export interface ImageRecordOptions {
    tSec: number;
    useLiveControls?: boolean;
    type?: "image/png" | "image/jpeg";
    quality?: number;
    preDelayMs?: number;
    postDelayMs?: number;
}

/**
* Deterministic still image capture with robust scene settling.
* Does not download; returns a Blob or null.
*/
export class SingleImageRecorder {
    constructor(
        private scenes: ScenePair,
    private videoCtx: VideoContext
    ) {}

    async record(options: ImageRecordOptions): Promise<Blob | null> {
    const {
    tSec,
    useLiveControls = false,
    type = "image/png",
    quality,
    preDelayMs = 1000,
    postDelayMs = 1000,
} = options;

    // Optional pre delay (helps first-frame texture upload and font/layout)
    if (preDelayMs > 0) await sleep(preDelayMs);

    if (useLiveControls) {
    // Honor the current on-screen transform controls
    await renderControls(tSec, this.scenes, null);
} else {
    await renderAtTime(tSec, this.scenes, this.videoCtx.getVideoEl());
}

    // Optional post delay before capture to ensure stability in some envs
    if (postDelayMs > 0) await sleep(postDelayMs);

    return await this.scenes.renderer.captureImage(type, quality);
}
}