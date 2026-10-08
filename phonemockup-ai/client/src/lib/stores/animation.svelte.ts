import type {Animation, Keyframe} from "../components/mock-video/Animation";
import {writable} from 'svelte/store';

export const animationDragMode = writable<string | null>(null);
export const animationThatIsBeingDragged = writable<Animation | null>(null);
export const maxAnimationDragDistanceAbs = writable<number>(0);
export const selectedAnimationStore = writable<Animation | null>(null);
export const selectedAnimationKeyframe = writable<Keyframe | null>(null);
