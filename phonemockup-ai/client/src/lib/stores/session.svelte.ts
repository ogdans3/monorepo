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
import {AnimationCurve, ChangeOrigin, zeroVec} from "$lib/components/mock-video/Animation";
import type {Project, ProjectFile} from "$lib/components/mock-video/Project";
import {loadProjectMedia} from "$lib/repo/media-store";
import {detectIsImage} from "$lib/repo/uploadFile.svelte";

/** What's on the phone before the user drops anything in. */
export const DEMO_MEDIA = "/iphone-recording.webm";

function resetEditorState() {
    const controller = get(videoController);
    controller.pause();
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

/** A fresh project; the editor's timeline fills in the chosen animation. */
export function startNewProject() {
    resetEditorState();
    project.startNew();
    get(videoController).setMediaSource(DEMO_MEDIA, false);
}

/** Load a saved project, then bring back its screen media from IndexedDB. */
export function openSavedProject(saved: Project) {
    resetEditorState();
    project.fromProject(saved);

    const controller = get(videoController);
    if (!saved.screenMedia) {
        controller.setMediaSource(DEMO_MEDIA, false);
    } else {
        // Blank until the stored file is read, rather than flashing the demo.
        controller.setMediaSource(null, false);
    }
    restoreMedia(saved);
}

async function restoreMedia(saved: Project) {
    const hadMedia = !!saved.screenMedia || (saved.files?.length ?? 0) > 0;
    let media;
    try {
        media = await loadProjectMedia(saved.id);
    } catch (e) {
        console.warn("Couldn't read the project's media", e);
    }
    // The user may have opened something else while we were reading.
    if (project.id !== saved.id) return;

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
        await controller.setMediaSource(media.bulk[0]);
        return;
    }
    if (media?.screen) {
        await controller.setMediaSource(media.screen);
        return;
    }
    if (hadMedia) {
        toast.warning("This project's screen image or video wasn't found in this browser.");
        controller.setMediaSource(DEMO_MEDIA, false);
    }
}
