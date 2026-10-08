import type {WebGLRenderer} from "three";

export type ExportFormat = "webm" | "mp4" | "gif" | "image-sequence";

export interface SceneRendererRef {
    // Renders a frame at a given time
    animateFrame: (tSec: number) => void;

    // Renders overlay/controls at the current state (no time input)
    animateControls: () => void;

    // Returns the underlying renderer (WebGL or similar)
    getRenderer: () => WebGLRenderer;

    // Captures the current canvas to an image blob
    captureImage: (
        type: "image/png" | "image/jpeg",
        quality?: number
    ) => Promise<Blob | null>;
}

export interface ScenePreviewRef {
    animateFrame: (tSec: number) => void;
    animateControls: () => void;
}

export interface ScenePair {
    renderer: SceneRendererRef;
    preview: ScenePreviewRef;
}

export interface VideoContext {
    // The active HTMLVideoElement if any (null for image media)
    getVideoEl: () => HTMLVideoElement | null;

    // Swap media source (image or video). May be async.
    setMediaSource: (file: File | null, isImage: boolean) => Promise<void> | void;

    // Total duration of the current composition in seconds
    getEndTimeSec: () => number;

    // The planned animation playhead time (as opposed to live on-screen state)
    getPlayheadAnimateFromSec: () => number;
}

export interface BulkCallbacks {
    onStart?: (total: number) => void;
    onItemStart?: (index: number, file: File) => void;
    onItemProgress?: (index: number, p: number, msg?: string) => void;
    onItemDone?: (index: number, blob: Blob | null) => void;
    onError?: (index: number, error: unknown) => void;
    onStatus?: (msg: string) => void;
    onDone?: (zip: Blob) => void;
}