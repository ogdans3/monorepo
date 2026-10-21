import {
    writable,
    readable,
    derived,
    get,
    type Readable,
    type Writable,
} from "svelte/store";
import {tick} from "svelte";
import {setTransformControlsFromPlayhead} from "./tracks.svelte";
import {project} from "$lib/stores/project.svelte";
import {detectIsImage} from "$lib/repo/uploadFile.svelte";
import {exportState} from "$lib/components/mock-video/recording/export-state.svelte";

type MediaKind = "video" | "image" | null;

/** Shortest and longest timeline the editor accepts, in seconds. */
export const MIN_END_TIME = 0.1;
export const MAX_END_TIME = 600;

/**
 * How far the screen recording may drift from the playhead during playback
 * before it is pulled back. The two run on separate clocks.
 */
const VIDEO_DRIFT_TOLERANCE = 0.15;

/** Resolves on the element's `success` event, rejects on its `error`. */
function settled(el: HTMLMediaElement | HTMLImageElement, success: "load" | "loadeddata"): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
        const done = (ok: boolean) => () => {
            el.removeEventListener(success, onSuccess);
            el.removeEventListener("error", onError);
            if (ok) resolve();
            else reject(new Error("The browser can't open this file"));
        };
        const onSuccess = done(true);
        const onError = done(false);
        el.addEventListener(success, onSuccess);
        el.addEventListener("error", onError);
    });
    promise.catch(() => {}); // only a bulk export awaits it
    return promise;
}

export class VideoController {
    // Unified src and kind
    public mediaSrc = writable<string | null>(null);
    public mediaKind = writable<MediaKind>(null);

    // Elements
    public _video: Writable<HTMLVideoElement | null> = writable(null);
    public _image: Writable<HTMLImageElement | null> = writable(null);

    // Playback state (applies only to video)
    public playing = writable(false);
    public startTime = writable(0);
    public endTime = $derived(project.timeline.endTime);
    public playheadAnimateFrom = writable<number>(0);

    /** The file behind the current media, or null for a URL such as the demo recording. */
    public currentFile = writable<File | null>(null);
    /** Set when the browser can't decode the current media. */
    public mediaError = writable<string | null>(null);

    private _currentFileUrl: string | null = null;
    /** What setMediaSource was last given, and the last of those that loaded. */
    private source: {src: File | string; isImage: boolean} | null = null;
    private lastGood: {src: File | string; isImage: boolean} | null = null;
    /** Settles when the media last set has loaded, or fails to. */
    private ready: Promise<void> = Promise.resolve();

    constructor() {
    }

    get isVideo() {
        return get(this.mediaKind) === "video" && !!this.video;
    }

    get isPlaying() {
        return get(this.playing);
    }

    get video() {
        return get(this._video);
    }

    get image() {
        return get(this._image);
    }

    /**
     * Re-pose the phone at the current playhead after the clips under it
     * changed. It doesn't seek: while playing the render loop poses every
     * frame anyway, and seeking to where playback started would rewind it.
     */
    refreshPose() {
        if (this.isPlaying) return;
        setTransformControlsFromPlayhead(get(currentPlayheadTime));
    }

    async setPlayheadPosition(time: number) {
        if (time == null) {
            console.warn("Playhead position must be set");
            return;
        }
        if (time === get(this.playheadAnimateFrom)) {
            // Force Svelte update for same-time re-seek cases
            this.playheadAnimateFrom.set(time - 0.001);
            await tick();
        }
        this.playheadAnimateFrom.set(time);

        if (this.video) {
            this.video.currentTime = time;
        }

        setTransformControlsFromPlayhead(time);
    }

    async play() {
        this.playing.set(true);
        await this.playVideo();
    }

    async pause() {
        this.playing.set(false);
        this.video?.pause();
    }

    reset() {
        this.setPlayheadPosition(0);
        this.playVideo();
    }

    /**
     * Start the screen recording, if one is showing. A recording that can't
     * play doesn't stop the timeline: the phone still animates.
     */
    private async playVideo() {
        if (!this.isVideo) return;
        try {
            await this.video!.play();
        } catch (e) {
            console.warn("Video play failed:", e);
        }
    }

    /**
     * The timeline and the recording run on separate clocks, so nudge the
     * recording back when it wanders. Past its end it holds the last frame.
     */
    syncVideo(time: number) {
        if (!this.isVideo) return;
        const video = this.video!;
        if (video.seeking || !Number.isFinite(video.duration) || time >= video.duration) return;
        if (Math.abs(video.currentTime - time) > VIDEO_DRIFT_TOLERANCE) {
            video.currentTime = time;
        }
    }

    playbackEnded() {
        if (project.settings.videoLoop) {
            this.reset();
        } else {
            this.pause();
        }
    }

    setEndTime(time: number) {
        if (!Number.isFinite(time)) return;
        const endTime = Math.min(MAX_END_TIME, Math.max(MIN_END_TIME, time));
        project.timeline.endTime = endTime;
        // Re-emit the playhead so everything drawn against the old length moves.
        this.setPlayheadPosition(Math.min(get(currentPlayheadTime), endTime));
    }

    // Create or reuse correct element based on kind
    private ensureElements(kind: Exclude<MediaKind, null>) {
        if (kind === "video") {
            if (!this.video) {
                const videoElement = document.createElement("video");
                this.setVideo(videoElement);
            } else {
                this.setVideo(this.video);
            }
        } else if (kind === "image") {
            if (!this.image) {
                const imageElement = new Image(); // HTMLImageElement
                this.setImage(imageElement);
            } else {
                this.setImage(this.image);
            }
        }
    }

    /**
     * Put a file or URL on the phone's screen. `isImage` may be left out for a
     * File, which is then sniffed from its type and name.
     */
    public async setMediaSource(
        src: File | string | null,
        isImage?: boolean
    ): Promise<void> {
        const image = isImage ?? (src instanceof File ? detectIsImage(src) : false);
        const kind: MediaKind = src ? (image ? "image" : "video") : null;
        this.source = src ? {src, isImage: image} : null;
        this.mediaError.set(null);
        this.currentFile.set(src instanceof File ? src : null);

        // Revoke previous blob URL
        if (this._currentFileUrl) {
            URL.revokeObjectURL(this._currentFileUrl);
            this._currentFileUrl = null;
        }

        let resolved: string | null = null;
        if (src instanceof File) {
            resolved = URL.createObjectURL(src);
            this._currentFileUrl = resolved;
        } else if (typeof src === "string") {
            resolved = src;
        } else {
            resolved = null;
        }

        this.mediaKind.set(kind);
        this.mediaSrc.set(resolved);

        if (!resolved || !kind) {
            this.ready = Promise.resolve();
            // Clear both elements
            if (this.video) {
                this.video.removeAttribute("src");
                this.video.load();
            }
            if (this.image) {
                this.image.removeAttribute("src");
            }
            this.playing.set(false);
            return;
        }

        // Ensure the correct element exists
        this.ensureElements(kind);

        if (kind === "image" && this.video) {
            // Stop the recording that was showing, or it keeps decoding.
            this.video.pause();
            this.video.removeAttribute("src");
            this.video.load();
        }

        if (kind === "video" && this.video) {
            // Wire up video
            this.video.loop = false;
            this.video.muted = true;
            this.video.autoplay = false;
            this.video.playsInline = true;

            this.ready = settled(this.video, "loadeddata");
            this.video.src = resolved;

            // Load and sync to current timeline
            this.video.load();
            this.video.currentTime = get(currentPlayheadTime);

            if (get(videoPlaying)) {
                await this.playVideo();
            }
        } else if (kind === "image" && this.image) {
            // Wire up image
            this.ready = settled(this.image, "load");
            this.image.src = resolved;
        }
    }

    public setVideo(video: HTMLVideoElement | null) {
        if (video && video !== this.video) {
            video.addEventListener("error", () => {
                if (video.getAttribute("src")) this.reportMediaError();
            });
            video.addEventListener("loadeddata", () => {
                if (video.getAttribute("src") && this.source && !this.source.isImage) this.lastGood = this.source;
            });
        }
        this._video.set(video);
        if (video) {
            video.loop = false;
            video.muted = true;
            video.autoplay = false;
            video.playsInline = true;
        }
    }

    public setImage(image: HTMLImageElement | null) {
        if (image && image !== this.image) {
            image.addEventListener("error", () => {
                if (image.getAttribute("src")) this.reportMediaError();
            });
            image.addEventListener("load", () => {
                if (image.getAttribute("src") && this.source?.isImage) this.lastGood = this.source;
            });
        }
        this._image.set(image);
    }

    /**
     * Resolves once the media last set has loaded, rejects if the browser
     * can't open it. A bulk export waits on it per file.
     */
    public whenMediaReady(): Promise<void> {
        return this.ready;
    }

    /**
     * Forget the screen that last worked. A new or reopened project must not
     * fall back to another project's file when its own can't be opened.
     */
    public forgetLastGoodMedia() {
        this.lastGood = null;
    }

    private reportMediaError() {
        const file = get(this.currentFile);
        const message = file
            ? `Your browser can't open "${file.name}". Try a PNG, JPG, MP4 or WebM file.`
            : "The screen content couldn't be loaded.";
        // Put back the screen that worked, rather than leave a black phone
        // that a save would then store. setMediaSource clears the error, so
        // it is set again once the old screen is back. Not during an export:
        // a bulk export would render the previous file under this one's name;
        // it counts the file as failed instead.
        const previous = this.lastGood;
        if (file && previous && previous.src !== file && !exportState.running) {
            void this.setMediaSource(previous.src, previous.isImage).finally(() => this.mediaError.set(message));
            return;
        }
        this.mediaError.set(message);
    }

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
}

// Singleton controller
export const videoController = readable(new VideoController());

// Derived stores
export const videoPlaying = derived(videoController, ($c, set) => {
    const unsub = $c.playing.subscribe(set);
    return () => unsub();
});

export const videoElement: Readable<HTMLVideoElement | null> = derived(
    videoController,
    ($c, set) => {
        const unsub = $c._video.subscribe(set);
        return () => unsub();
    }
);

export const imageElement: Readable<HTMLImageElement | null> = derived(
    videoController,
    ($c, set) => {
        const unsub = $c._image.subscribe(set);
        return () => unsub();
    }
);

/** Which of the two elements is on the screen now. Both outlive a change. */
export const mediaKind: Readable<MediaKind> = derived(
    videoController,
    ($c, set) => {
        const unsub = $c.mediaKind.subscribe(set);
        return () => unsub();
    }
);

export const currentPlayheadTime = writable<number>(0);