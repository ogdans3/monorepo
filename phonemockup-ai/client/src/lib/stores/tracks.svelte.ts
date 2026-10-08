import {ChangeOrigin} from "../components/mock-video/Animation";
import {transformControlPosition, transformControlRotation} from "$lib/stores/transform.svelte";
import {currentPlayheadTime} from "./video.svelte";
import {get} from "svelte/store";
import {getInterpolatedTransform} from "$lib/components/mock-video/canvas/3dModelUtil.svelte";
import {project} from "$lib/stores/project.svelte";

export function setTransformControlsFromPlayhead(time?: number) {
    const playhead = time ?? get(currentPlayheadTime);
    if (playhead == null) {
        console.info("No playhead or time position found when setting transform controls based on the playhead");
        return;
    }

    const {pos, rot} = getInterpolatedTransform(project.tracks[0], playhead!);
    transformControlPosition.set({vector: {...pos}, origin: ChangeOrigin.System});
    transformControlRotation.set({vector: {...rot}, origin: ChangeOrigin.System});
    return;
}