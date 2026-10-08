// src/lib/components/mock-video/recording/BulkRecorder.ts
import JSZip from "jszip";
import type {
    BulkCallbacks,
    ExportFormat,
    ScenePair,
    VideoContext,
} from "../core/types";
import {SingleImageRecorder} from "./SingleImageRecorder";
import {SingleVideoRecorder} from "./SingleVideoRecorder";
import {renderAtTime} from "../core/settle";
import {extFromBlobType} from "../util/naming";
import {UserCancelledRendering} from "../VideoRecorder";
import {detectIsImage} from "$lib/repo/uploadFile.svelte";

export type BulkMode = "image" | "video";

export interface BulkOptions {
    mode: BulkMode;
    // Time in seconds for preview settle before per-item export. If omitted,
    // uses videoCtx.getPlayheadAnimateFromSec().
    tSec?: number;

    // For image mode: whether to honor current on-screen transform controls
    // (skip seeking video). Defaults to false.
    useLiveControls?: boolean;

    // File naming by index and extension (e.g., "my-project-001.png")
    getFilename: (index: number, ext: string) => string;

    // Report progress and status to UI
    callbacks?: BulkCallbacks;

    // Abort processing early
    abortSignal?: AbortSignal;
}

/**
 * Bulk recorder that composes the single-image and single-video recorders.
 */
export class BulkRecorder {
    constructor(
        private scenes: ScenePair,
        private videoCtx: VideoContext,
        private imageRecorder: SingleImageRecorder,
        private videoRecorder: SingleVideoRecorder
    ) {
    }

    /**
     * Export every file and zip the results. Resolves with null when not one
     * file could be exported, and rejects with UserCancelledRendering when the
     * signal aborts: a cancelled batch leaves nothing to download.
     */
    async recordAll(files: File[], options: BulkOptions): Promise<Blob | null> {
        const {
            mode,
            tSec,
            useLiveControls = false,
            getFilename,
            callbacks,
            abortSignal,
        } = options;

        const zip = new JSZip();
        const total = files.length;
        let exported = 0;

        callbacks?.onStart?.(total);

        for (let i = 0; i < total; i++) {
            if (abortSignal?.aborted) throw new UserCancelledRendering("");

            const file = files[i];
            callbacks?.onItemStart?.(i, file);

            await this.videoCtx.setMediaSource(file, detectIsImage(file));

            // Pre-settle the preview so textures/shaders are ready
            const settleT = Number.isFinite(tSec!)
                ? tSec!
                : this.videoCtx.getPlayheadAnimateFromSec();

            await renderAtTime(settleT, this.scenes, this.videoCtx.getVideoEl());

            let out: Blob | null = null;

            try {
                if (mode === "image") {
                    out = await this.imageRecorder.record({
                        tSec: settleT,
                        useLiveControls,
                        type: "image/png",
                        preDelayMs: 0, // already settled above
                        postDelayMs: 0,
                    });

                    if (out) {
                        const name = getFilename(i, "png");
                        zip.file(name, out);
                        exported++;
                    }
                    callbacks?.onItemProgress?.(i, 100, "Image captured");
                } else {
                    const controller = new AbortController();
                    const signals = [controller.signal, abortSignal].filter(
                        (s): s is AbortSignal => !!s
                    );

                    const compositeSignal = mergeAbortSignals(signals);
                    const blob = await this.videoRecorder.recordToBlob(
                        compositeSignal,
                        {
                            onStart: () =>
                                callbacks?.onItemProgress?.(i, 0, "Initializing…"),
                            onProgress: (p, _frame, _total, msg) =>
                                callbacks?.onItemProgress?.(i, p, msg),
                            onDone: (b) => {
                                const ext = inferExt(b, this.videoRecorder);
                                const name = getFilename(i, ext);
                                zip.file(name, b);
                                exported++;
                                callbacks?.onItemProgress?.(i, 100, "Done");
                            },
                        }
                    );

                    out = blob;
                }
            } catch (e) {
                if (abortSignal?.aborted || e instanceof UserCancelledRendering) {
                    throw new UserCancelledRendering("");
                }
                callbacks?.onError?.(i, e);
                out = null;
            }

            callbacks?.onItemDone?.(i, out);
        }

        if (abortSignal?.aborted) throw new UserCancelledRendering("");
        if (exported === 0) return null;

        callbacks?.onStatus?.("Zipping…");
        const zipBlob = await zip.generateAsync({type: "blob"});
        callbacks?.onDone?.(zipBlob);
        return zipBlob;
    }
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    const onAbort = () => controller.abort();

    signals.forEach((s) => {
        if (s.aborted) controller.abort();
        else s.addEventListener("abort", onAbort, {once: true});
    });

    return controller.signal;
}

function inferExt(blob: Blob, recorder: SingleVideoRecorder): string {
    // image-sequence gets zipped images, map to zip explicitly
    // otherwise derive from blob type.
    // We don't have direct access to format here, but if the blob is a zip,
    // extFromBlobType will yield 'zip'.
    return extFromBlobType(blob.type);
}