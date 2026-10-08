import {writable} from 'svelte/store';
import {AnimationCurve, ChangeOrigin, type TrackableVec3, zeroVec} from "../components/mock-video/Animation";

export const transformControlPosition = writable<TrackableVec3>({vector: zeroVec(), origin: ChangeOrigin.System});
export const transformControlRotation = writable<TrackableVec3>({vector: zeroVec(), origin: ChangeOrigin.System});

export const transformCurve = writable<AnimationCurve>(AnimationCurve.Linear);
