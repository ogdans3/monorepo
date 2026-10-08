import type {ScenePair, VideoContext, ExportFormat} from "../core/types";
import {
    default as FrameStepperRecorder,
    type RecorderCallbacks as NativeRecorderCallbacks,
    type RecorderOptions,
    UserCancelledRendering,
} from "../VideoRecorder";

/**
 * A thin adapter around FrameStepperRecorder making it instance-based,
 * with pause/resume/stop and optional reattach to an in-flight recorder.
 */
export class SingleVideoRecorder {
    private recorder: FrameStepperRecorder | null = null;

    constructor(
        private scenes: ScenePair,
        private videoCtx: VideoContext,
        private fps: number,
        private format: ExportFormat,
        private options: RecorderOptions = {}
    ) {
    }

    setFormat(format: ExportFormat) {
        this.format = format;
    }

    get isActive() {
        return !!this.recorder;
    }

    pause() {
        this.recorder?.pause();
    }

    resume() {
        this.recorder?.resume();
    }

    stop() {
        this.recorder?.stop();
    }

    teardown() {
        this.recorder?.teardown();
        this.recorder = null;
        FrameStepperRecorder.reset();
    }

    /**
     * Reattach to an existing in-flight native recorder and update callbacks.
     * Returns true if reattached.
     */
    reattach(callbacks: NativeRecorderCallbacks): boolean {
        if (FrameStepperRecorder.hasInstance()) {
            FrameStepperRecorder.instance!.setCallbacks(callbacks);
            this.recorder = FrameStepperRecorder.instance!;
            return true;
        }
        return false;
    }

    /**
     * Records from 0 to videoCtx.getEndTimeSec(), reports progress via callbacks,
     * and resolves with the final Blob when done, or null when cancelled. A
     * failure rejects, so the caller can say so instead of "finished".
     */
    async recordToBlob(
        abortSignal: AbortSignal,
        callbacks: NativeRecorderCallbacks
    ): Promise<Blob | null> {
        const native = FrameStepperRecorder.getInstance(
            this.scenes.renderer.animateFrame,
            this.videoCtx.getVideoEl(),
            this.scenes.renderer.getRenderer(),
            this.fps,
            callbacks,
            this.scenes.preview.animateFrame,
            this.format,
            this.options
        );

        this.recorder = native;

        try {
            const duration = this.videoCtx.getEndTimeSec();
            const result = await native.record(duration, abortSignal);
            // onDone will be called; return for convenience as well.
            return result;
        } catch (e) {
            if (e instanceof UserCancelledRendering) {
                return null;
            }
            callbacks.onError?.(e);
            throw e;
        } finally {
            // Do not teardown here; caller may want to restart or inspect.
            // Stop instance ownership to prevent leaks; new record can re-init.
            this.recorder?.stop();
            FrameStepperRecorder.reset();
            this.recorder = null;
        }
    }
}