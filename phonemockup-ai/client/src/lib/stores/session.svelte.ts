// Starting and opening projects. The editor's state lives in module-level
// singletons, so a route that shows the editor has to say which project it
// is, or the last one's tracks, files and selection carry over.

import {get} from "svelte/store";
import {v4 as uuid} from "uuid";
import {toast} from "svelte-sonner";
import {project} from "$lib/stores/project.svelte";
import {currentPlayheadTime, videoController} from "$lib/stores/video.svelte";
import {
    animationDragMode,
    animationThatIsBeingDragged,
    maxAnimationDragDistanceAbs,
    selectedAnimationKeyframe,
    selectedAnimationStore
} from "$lib/stores/animation.svelte";
import {transformControlPosition, transformControlRotation, transformCurve} from "$lib/stores/transform.svelte";
import {AnimationCurve, ChangeOrigin, zeroVec, type AnimationGroup} from "$lib/components/mock-video/Animation";
import type {Project, ProjectFile} from "$lib/components/mock-video/Project";
import {loadProjectMedia} from "$lib/repo/media-store";
import {getModel} from "$lib/models/3d-models/3d-models-spec";
import {PresetName} from "$lib/models/models";
import {detectIsImage} from "$lib/repo/uploadFile.svelte";

/**
 * What's on the phone before the user drops anything in. The WebM is the
 * smaller file, but iOS plays WebM only from 17.4; older iPhones get the same
 * recording as MP4 instead of a black screen and an error.
 */
function demoMedia(): string {
    const webm = typeof document !== "undefined" &&
        document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";
    return webm ? "/iphone-recording.webm" : "/iphone-recording.mp4";
}

function resetEditorState() {
    const controller = get(videoController);
    controller.pause();
    controller.forgetLastGoodMedia();
    controller.startTime.set(0);
    controller.playheadAnimateFrom.set(0);
    currentPlayheadTime.set(0);

    selectedAnimationStore.set(null);
    selectedAnimationKeyframe.set(null);
    animationThatIsBeingDragged.set(null);
    animationDragMode.set(null);
    maxAnimationDragDistanceAbs.set(0);

    transformControlPosition.set({vector: zeroVec(), origin: ChangeOrigin.System});
    transformControlRotation.set({vector: zeroVec(), origin: ChangeOrigin.System});
    transformCurve.set(AnimationCurve.Linear);
}

/** Restore a built-in sample with the correct media element type. */
export function applyDemoMedia() {
    const id = project.demoMediaId;
    const image = id === "focus" || id === "workspace";
    get(videoController).setMediaSource(image ? `/media/studio/${id}.png` : demoMedia(), image);
}

/** A fresh project; the editor's timeline fills in the chosen animation. */
export function startNewProject(group?: AnimationGroup) {
    resetEditorState();
    unreadMedia = null;
    project.startNew();
    project.name = group?.name && group.id !== "still" ? group.name : "Untitled project";
    if (group?.previewModelId) {
        const model = getModel(group.previewModelId);
        if (model) project.model = {...model};
    }
    if (group?.previewBackground) {
        project.sceneSettings.backgroundColor = [...group.previewBackground];
        project.sceneSettings.glassReflections = false;
        project.sceneSettings.selectedPreset = PresetName.Portrait_4_5;
    }
    project.demoMediaId = group?.demoMediaId;
    applyDemoMedia();
}

/** Load a saved project, then bring back its screen media from IndexedDB. */
export function openSavedProject(saved: Project) {
    resetEditorState();
    unreadMedia = null;
    project.fromProject(saved);

    const controller = get(videoController);
    if (!saved.screenMedia) {
        applyDemoMedia();
    } else {
        // Blank until the stored file is read, rather than flashing the demo.
        controller.setMediaSource(null, false);
    }
    const reading = restoreMedia(saved).finally(() => {
        if (restoring === reading) restoring = null;
    });
    restoring = reading;
}

let restoring: Promise<void> | null = null;

/**
 * A saved project whose screen media couldn't be read when it opened. The
 * file may well still be in IndexedDB, so saving while the sample stands in
 * for it must not store "no screen" and delete the file.
 */
let unreadMedia: {projectId: string; screenMedia: Project["screenMedia"]} | null = null;

export function unreadMediaFor(projectId: string) {
    return unreadMedia?.projectId === projectId ? unreadMedia : null;
}

/**
 * Resolves once a just-opened project's screen media is back from IndexedDB.
 * Saving before that would store "no screen" and delete the stored file.
 */
export function whenMediaRestored(): Promise<void> {
    return restoring ?? Promise.resolve();
}

async function restoreMedia(saved: Project) {
    const hadMedia = !!saved.screenMedia || (saved.files?.length ?? 0) > 0;
    let media;
    let unreadable = false;
    try {
        media = await loadProjectMedia(saved.id);
    } catch (e) {
        unreadable = true;
        console.warn("Couldn't read the project's media", e);
    }
    // The user may have opened something else while we were reading.
    if (project.id !== saved.id) return;
    if (unreadable) {
        unreadMedia = {projectId: saved.id, screenMedia: saved.screenMedia ?? null};
        toast.warning("This project's screen image or video couldn't be read. Reload the page to try again, or upload it again if that doesn't help.");
        applyDemoMedia();
        return;
    }

    if (media?.damaged) {
        toast.warning("Some of this project's saved media is damaged and was left out. Upload it again to use it.");
    }

    const controller = get(videoController);
    if (media?.bulk.length) {
        project.files = media.bulk.map((file): ProjectFile => ({
            id: uuid(),
            projectId: saved.id,
            fileName: file.name,
            fileType: detectIsImage(file) ? "image" : "video",
            fileBlob: file,
            sizeBytes: file.size,
            storageProvider: "local"
        }));
        // The file that was on the phone when it was saved, not always the first.
        const same = (a: File, b: File | null) =>
            !!b && (a === b || (a.name === b.name && a.size === b.size && a.lastModified === b.lastModified));
        await controller.setMediaSource(media.bulk.find((file) => same(file, media.screen)) ?? media.bulk[0]);
        return;
    }
    if (media?.screen) {
        await controller.setMediaSource(media.screen);
        return;
    }
    if (media?.damaged) {
        applyDemoMedia();
        return;
    }
    if (hadMedia) {
        toast.warning("This project's screen image or video wasn't found in this browser.");
        applyDemoMedia();
    }
}
