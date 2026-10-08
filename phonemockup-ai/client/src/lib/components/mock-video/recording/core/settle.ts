import type {ScenePair} from "./types";

export async function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export async function nextRAF() {
    return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export async function waitForVideoSeek(
    video: HTMLVideoElement | null | undefined,
    tSec: number
) {
    if (!video) return;
    if (Number.isFinite(tSec)) {
        try {
            video.currentTime = tSec;
        } catch {
            // Ignore, some browsers throw when not ready
        }
    }

    if (video.readyState >= 2) {
        await nextRAF();
        return;
    }

    await Promise.race([
        new Promise<void>((resolve) => {
            const on = () => {
                video.removeEventListener("loadeddata", on);
                video.removeEventListener("seeked", on);
                resolve();
            };
            video.addEventListener("loadeddata", on, {once: true});
            video.addEventListener("seeked", on, {once: true});
        }),
        sleep(250),
    ]);

    await nextRAF();
}

export async function renderAtTime(
    tSec: number,
    scenes: ScenePair,
    videoEl: HTMLVideoElement | null
) {
    if (videoEl) {
        await waitForVideoSeek(videoEl, tSec);
    } else {
        await nextRAF();
    }

    // First pass to bind textures and uniforms
    scenes.renderer.animateFrame(tSec);
    scenes.preview.animateFrame(tSec);
    await nextRAF();

    // Second pass to ensure final state is visible
    scenes.renderer.animateFrame(tSec);
    scenes.preview.animateFrame(tSec);
    await nextRAF();
}

export async function renderControls(
    tSec: number,
    scenes: ScenePair,
    videoEl: HTMLVideoElement | null
) {
    if (videoEl) {
        await waitForVideoSeek(videoEl, tSec);
    } else {
        await nextRAF();
    }

    // First pass to bind textures and uniforms
    scenes.renderer.animateControls();
    scenes.preview.animateControls();
    await nextRAF();

    // Second pass to ensure final state is visible
    scenes.renderer.animateControls();
    scenes.preview.animateControls();
    await nextRAF();
}