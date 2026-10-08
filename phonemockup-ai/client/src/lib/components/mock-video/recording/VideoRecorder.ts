// FrameStepperRecorder.ts
import type {WebGLRenderer} from "three";
import {toast} from "svelte-sonner";
import {PauseController} from "$lib/components/mock-video/recording/PauseController";
import {hasWebCodecs} from "$lib/components/mock-video/recording/ChromeWebMMuxer";
import type {IFrameEncoder} from "$lib/components/mock-video/recording/RecordingTypes";
import {WebMEncoder} from "$lib/components/mock-video/recording/WebMEncoder";
import {GifEncoder} from "$lib/components/mock-video/recording/GifEncoder";
import {Mp4Encoder} from "$lib/components/mock-video/recording/Mp4Encoder";
import JSZip from "jszip";

export type StepFn = (tMs: number, dtMs: number) => void;

export type RecorderCallbacks = {
    onStart?: () => void;
    onProgress?: (progress: number, frame: number, total: number, status?: string) => void;
    onStatus?: (msg: string) => void;
    onError?: (err: unknown) => void;
    onDone?: (blob: Blob) => void;
};

export type RecorderOptions = {
    /** The scene has a transparent background: keep it where the format can. */
    transparent?: boolean;
};

const globalKey = "__FrameStepperRecorderSingleton__" as const;

function getGlobalSingleton(): FrameStepperRecorder | null {
    if (typeof window === "undefined") return null;
    return (window as any)[globalKey] ?? null;
}

function setGlobalSingleton(inst: FrameStepperRecorder | null) {
    if (typeof window === "undefined") return;
    (window as any)[globalKey] = inst;
}

export class UserCancelledRendering extends Error {
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
    }
}

type ExportFormat = "webm" | "gif" | "mp4" | "image-sequence";

/**
 * GIF frame delays are whole hundredths of a second, and browsers play any
 * delay under 2 as 10. 25 fps (4 each) is exact and plays at the right speed;
 * 60 fps would round to 50 and run slow.
 */
const GIF_FPS = 25;

/** Longest a seek into the screen recording may take before we render anyway. */
const SEEK_TIMEOUT_MS = 2000;

/**
 * Put the recording at `tSec` and wait until the frame there is decoded, so
 * the texture drawn next shows it. Past the end it holds the last frame.
 */
async function seekVideo(video: HTMLVideoElement, tSec: number) {
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const target = Math.min(Math.max(0, tSec), duration);
    if (!video.seeking && Math.abs(video.currentTime - target) < 1e-4) return;
    await new Promise<void>((resolve) => {
        const done = () => {
            clearTimeout(timer);
            video.removeEventListener("seeked", done);
            resolve();
        };
        const timer = setTimeout(done, SEEK_TIMEOUT_MS);
        video.addEventListener("seeked", done);
        try {
            video.currentTime = target;
        } catch {
            done();
        }
    });
}

export default class FrameStepperRecorder {
    private canvas: HTMLCanvasElement;
    private fps: number;
    private dtSec: number;
    private animateFunction: (tMs: number) => void;
    private previewAnimateFunction: (tMs: number) => void;
    private video: HTMLVideoElement | null;
    private callbacks: RecorderCallbacks;
    private static _instance: FrameStepperRecorder | null = null;
    private blob: Blob | null = null;
    private _pauseController: PauseController = new PauseController();
    private format: ExportFormat;
    private options: RecorderOptions;
    /** Aborted by stop(); a run also ends when the caller's signal aborts. */
    private runAbort: AbortController | null = null;

    // For image-sequence
    private imageFrames:
        | null
        | Array<{
        name: string;
        blob: Blob;
    }> = null;

    static get instance() {
        return this._instance;
    }

    static hasInstance() {
        if (!FrameStepperRecorder.instance && getGlobalSingleton()) {
            FrameStepperRecorder._instance = getGlobalSingleton();
        }
        return !!FrameStepperRecorder.instance;
    }

    static getInstance(
        animateFunction: (tSec: number) => void,
        video: HTMLVideoElement | null,
        renderer: WebGLRenderer,
        fps = 30,
        callbacks: RecorderCallbacks = {},
        previewAnimateFunction: (tSec: number) => void,
        format: ExportFormat = "webm",
        options: RecorderOptions = {}
    ): FrameStepperRecorder {
        if (!FrameStepperRecorder.hasInstance()) {
            FrameStepperRecorder._instance = new FrameStepperRecorder(
                animateFunction,
                video,
                renderer,
                fps,
                callbacks,
                previewAnimateFunction,
                format,
                options
            );
            setGlobalSingleton(FrameStepperRecorder.instance);
        } else {
            FrameStepperRecorder.instance!.updateConfig(
                animateFunction,
                video,
                renderer,
                fps,
                callbacks,
                previewAnimateFunction,
                format,
                options
            );
        }
        return FrameStepperRecorder.instance!;
    }

    constructor(
        animateFunction: (tMs: number) => void,
        video: HTMLVideoElement | null,
        renderer: WebGLRenderer,
        fps = 30,
        callbacks: RecorderCallbacks = {},
        previewAnimateFunction: (tSec: number) => void,
        format: ExportFormat = "webm",
        options: RecorderOptions = {}
    ) {
        this.canvas = renderer.domElement as HTMLCanvasElement;
        this.fps = fps;
        this.dtSec = 1 / fps;
        this.video = video;
        this.animateFunction = animateFunction;
        this.previewAnimateFunction = previewAnimateFunction;
        this.callbacks = callbacks;
        this.format = format;
        this.options = options;
    }

    private updateConfig(
        animateFunction: (tSec: number) => void,
        video: HTMLVideoElement | null,
        renderer: WebGLRenderer,
        fps = 30,
        callbacks: RecorderCallbacks = {},
        previewAnimateFunction: (tSec: number) => void,
        format: ExportFormat = "webm",
        options: RecorderOptions = {}
    ) {
        this.animateFunction = animateFunction;
        this.previewAnimateFunction = previewAnimateFunction;
        if (typeof video !== "undefined") this.video = video ?? null;
        if (renderer) {
            this.canvas = renderer.domElement as HTMLCanvasElement;
        }
        if (fps && fps > 0) {
            this.fps = fps;
            this.dtSec = 1 / fps;
        }
        if (callbacks) {
            this.callbacks = callbacks;
        }
        this.format = format;
        this.options = options;
    }

    public setCallbacks(callbacks: RecorderCallbacks) {
        this.callbacks = callbacks;
        if (this.blob) {
            this.callbacks.onDone?.(this.blob);
        }
    }

    async record(totalTimeSec: number, abortSignal?: AbortSignal): Promise<Blob> {
        const runAbort = new AbortController();
        this.runAbort = runAbort;
        const aborted = () => runAbort.signal.aborted || !!abortSignal?.aborted;

        const fps = this.format === "gif" ? Math.min(this.fps, GIF_FPS) : this.fps;
        const dtSec = 1 / fps;
        const totalFrames = Math.max(1, Math.round(totalTimeSec * fps));
        const encoder = await this.recordingSetup(totalFrames, fps);

        try {
            for (let frame = 0; frame < totalFrames; frame++) {
                if (this._pauseController.paused) {
                    await this._pauseController.wait(abortSignal ?? runAbort.signal);
                }
                if (aborted()) {
                    throw new UserCancelledRendering("");
                }
                await this.recordFrame(frame * dtSec, dtSec, frame, totalFrames, encoder);
                // Let the page breathe between frames.
                await new Promise<void>((r) => setTimeout(r, 0));
            }
            if (aborted()) {
                throw new UserCancelledRendering("");
            }
            return await this.recordingDone(encoder);
        } catch (e) {
            // A half-written file is worth nothing; free the encoder now
            // rather than whenever it is garbage collected.
            await encoder?.cancel?.().catch(() => {});
            throw e;
        } finally {
            if (this.runAbort === runAbort) this.runAbort = null;
        }
    }

    private async recordingSetup(totalFrames: number, fps: number): Promise<IFrameEncoder | null> {
        this.callbacks.onStart?.();
        this.blob = null;

        let encoder;
        if (this.format === "gif") {
            encoder = new GifEncoder({
                canvas: this.canvas,
                fps,
                repeat: 0,
                background: undefined,
                totalFrames,
                transparent: !!this.options.transparent,
            });
        } else if (this.format === "mp4") {
            if (!hasWebCodecs()) {
                toast.error(
                    "This feature requires WebCodecs (Chrome/Edge/Safari). Use a modern browser."
                );
                throw new Error("WebCodecs not supported");
            }
            encoder = new Mp4Encoder({
                canvas: this.canvas,
                fps,
                codec: "avc",
            });
        } else if (this.format === "webm") {
            if (!hasWebCodecs()) {
                toast.error(
                    "This feature requires WebCodecs (Chrome/Edge). Please use a Chromium browser."
                );
                throw new Error("WebCodecs not supported");
            }
            encoder = new WebMEncoder({
                canvas: this.canvas,
                fps,
                codec: "vp9",
                bitrate: 8_000_000,
                alpha: this.options.transparent ? "keep" : "discard",
            });
        } else if (this.format === "image-sequence") {
            // No video encoder, we’ll capture canvas frames into blobs
            this.imageFrames = [];
            return null;
        } else {
            throw new Error(`Unsupported format: ${this.format}`);
        }
        await encoder.init();
        return encoder;
    }

    private canvasToBlob(type: string = "image/png", quality?: number) {
        return new Promise<Blob | null>((resolve) => {
            if (this.canvas.toBlob) {
                this.canvas.toBlob((b) => resolve(b), type, quality);
            } else {
                try {
                    const dataUrl = this.canvas.toDataURL(type, quality);
                    const b64 = dataUrl.split(",")[1] ?? "";
                    const bin = atob(b64);
                    const u8 = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                    resolve(new Blob([u8], {type}));
                } catch {
                    resolve(null);
                }
            }
        });
    }

    private async recordFrame(
        tSec: number,
        dtSec: number,
        i: number,
        totalFrames: number,
        encoder: IFrameEncoder | null
    ) {
        if (this.video) {
            await seekVideo(this.video, tSec);
        }
        this.animateFunction(tSec);
        this.previewAnimateFunction(tSec);

        if (this.format === "image-sequence") {
            // Capture PNG per frame. Pad to the frame count so the names sort
            // in order however long the clip is.
            const blob = await this.canvasToBlob("image/png");
            if (blob && this.imageFrames) {
                const digits = Math.max(3, String(totalFrames).length);
                const name = `frame-${String(i + 1).padStart(digits, "0")}.png`;
                this.imageFrames.push({name, blob});
            }
        } else {
            if (!encoder) throw new Error("Missing encoder for video format");
            await encoder.addFrame(tSec, dtSec);
        }

        const percent = ((i + 1) / totalFrames) * 100;
        this.callbacks.onProgress?.(
            percent,
            i + 1,
            totalFrames,
            this.format === "image-sequence"
                ? `Capturing image ${i + 1} of ${totalFrames}`
                : `Rendering frame ${i + 1} of ${totalFrames} frames`
        );
    }

    private async recordingDone(encoder: IFrameEncoder | null) {
        if (this.format === "image-sequence") {
            // Zip up the images
            const zip = new JSZip();
            for (const f of this.imageFrames ?? []) {
                zip.file(f.name, f.blob);
            }
            const zipBlob = await zip.generateAsync({type: "blob"});
            this.imageFrames = null;
            this.callbacks.onDone?.(zipBlob);
            this.blob = zipBlob;
            return zipBlob;
        } else {
            if (!encoder) throw new Error("Missing encoder");
            const blob = await encoder.finalize();
            this.callbacks.onDone?.(blob);
            this.blob = blob;
            return blob;
        }
    }

    /** End the run in progress, if any; record() rejects with UserCancelledRendering. */
    stop() {
        this.runAbort?.abort();
        this._pauseController.resume();
    }

    teardown() {
        this.stop();
    }

    resume() {
        this._pauseController.resume();
    }

    pause() {
        this._pauseController.pause();
    }

    static reset(): void {
        setGlobalSingleton(null);
        FrameStepperRecorder._instance?.teardown();
        FrameStepperRecorder._instance = null;
    }
}
