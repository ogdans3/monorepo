import type {PageLoad} from "./$types";
import {defaultAnimation, findAnimationGroupById} from "$lib/animations/animations.svelte";

// The editor is WebGL, localStorage and module-level state; rendering it on
// the server only produced markup the client then threw away.
export const ssr = false;

export const load: PageLoad = ({params}) => {
    // An unknown id (an old link, a typo) opens the default animation.
    const animationGroup = findAnimationGroupById(params.id) ?? defaultAnimation;
    return {animationGroup};
};
