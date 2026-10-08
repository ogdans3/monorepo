import {get} from "svelte/store";
import {currentPlayheadTime, videoController} from "$lib/stores/video.svelte";
import {transformControlPosition, transformControlRotation} from "$lib/stores/transform.svelte";

/**
 * Remember what an export disturbs and return a function that puts it back.
 *
 * The recorder poses the phone frame by frame through the same transform
 * stores the editor shows, and seeks the shared screen recording, so after an
 * export the editor would otherwise show the last frame's pose against a
 * playhead that says something else.
 */
export function saveEditorState(): () => void {
    const position = get(transformControlPosition);
    const rotation = get(transformControlRotation);
    const time = get(currentPlayheadTime);
    return () => {
        transformControlPosition.set({vector: {...position.vector}, origin: position.origin});
        transformControlRotation.set({vector: {...rotation.vector}, origin: rotation.origin});
        const controller = get(videoController);
        if (controller.isVideo && controller.video) controller.video.currentTime = time;
    };
}
