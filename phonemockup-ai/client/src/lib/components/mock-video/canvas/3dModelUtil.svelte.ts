import {evalCurve} from "$lib/utils/curves";
import type {Animation, Vec3} from "$lib/components/mock-video/Animation";
import {zeroVec, AnimationCurve} from "$lib/components/mock-video/Animation";
import type {Track} from "$lib/components/mock-video/Project";

/**
 * The phone's pose on `track` at `time`. Inside a clip it eases between the
 * clip's keyframes; between clips, and after the last one, it holds the pose
 * the previous clip ended on; before the first clip it holds that clip's
 * start. An empty track is the rest pose.
 *
 * Clips are found by time rather than by position in the array, which is
 * out of order while a clip is being dragged past another.
 */
export function getInterpolatedTransform(track: Track, time: number): { pos: Vec3; rot: Vec3 } {
    const animations = track?.animations ?? [];
    if (animations.length === 0 || !Number.isFinite(time)) {
        return {pos: zeroVec(), rot: zeroVec()};
    }

    let anim: Animation | undefined;
    let before: Animation | undefined;
    let first: Animation = animations[0];
    for (const a of animations) {
        if (!anim && time >= a.start && time <= a.end) anim = a;
        if (a.end < time && (!before || a.end > before.end)) before = a;
        if (a.start < first.start) first = a;
    }

    if (!anim) {
        const kf = before ? before.endKeyframe : first.startKeyframe;
        return {pos: kf.position, rot: kf.rotation};
    }

    const firstKf = anim.startKeyframe;
    const lastKf = anim.endKeyframe;

    if (time <= anim.start) {
        return {pos: firstKf.position, rot: firstKf.rotation};
    }
    if (time >= anim.end) {
        return {pos: lastKf.position, rot: lastKf.rotation};
    }

    const span = anim.end - anim.start;
    const t = span > 0 ? (time - anim.start) / span : 0;

    const curve = anim.curve ?? AnimationCurve.Linear;
    const te = evalCurve(curve, t);

    // Inline component-wise interpolation using eased t
    const pos: Vec3 = {
        x: firstKf.position.x + (lastKf.position.x - firstKf.position.x) * te,
        y: firstKf.position.y + (lastKf.position.y - firstKf.position.y) * te,
        z: firstKf.position.z + (lastKf.position.z - firstKf.position.z) * te
    };

    const rot: Vec3 = {
        x: firstKf.rotation.x + (lastKf.rotation.x - firstKf.rotation.x) * te,
        y: firstKf.rotation.y + (lastKf.rotation.y - firstKf.rotation.y) * te,
        z: firstKf.rotation.z + (lastKf.rotation.z - firstKf.rotation.z) * te
    };

    return {pos, rot};
}
