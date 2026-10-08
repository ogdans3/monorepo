import {v4 as uuid} from "uuid";
import {get} from "svelte/store";
import {currentPlayheadTime, videoController} from "$lib/stores/video.svelte";
import {type AnimationGroup, type Animation} from "../Animation";
import {tick} from "svelte";
import {project} from "$lib/stores/project.svelte";
import type {Track} from "$lib/components/mock-video/Project";

/** Clip times closer than this are the same instant. */
const EPSILON = 1e-6;

const byStart = (a: Animation, b: Animation) => a.start - b.start;

/**
 * Where a group added at `time` really starts. Inside a clip it goes after
 * the whole run of back-to-back clips that clip belongs to, so it never
 * splits a chain.
 */
export function resolveInsertionTime(track: Track, time: number): number {
    const sorted = [...track.animations].sort(byStart);
    const under = sorted.find((a) => a.start <= time && a.end >= time);
    if (!under) return time;

    let end = under.end;
    for (const clip of sorted) {
        if (clip.start < end - EPSILON) continue;
        if (clip.start > end + EPSILON) break;
        end = Math.max(end, clip.end);
    }
    return end;
}

/** The clip that ends last at or before `time`: what a clip placed there follows. */
export function clipEndingBefore(track: Track, time: number): Animation | undefined {
    let found: Animation | undefined;
    for (const clip of track.animations) {
        if (clip.end <= time + EPSILON && (!found || clip.end > found.end)) {
            found = clip;
        }
    }
    return found;
}

/**
 * Insert an animation group at `startTime` (default: the playhead).
 *
 * Later clips are pushed right just far enough that nothing overlaps, keeping
 * any gaps. The group picks up the pose of the clip before it, and the clip
 * after it is changed to start from where the group ends, so there is no jump
 * on either side. An empty animation instead holds that pose and ends where
 * the next clip starts.
 */
export async function addAnimationGroup(
    animationGroup: AnimationGroup,
    trackId?: string,
    track?: Track,
    isEmptyAnimation?: boolean,
    startTime?: number,
): Promise<AnimationGroup> {
    track = track ?? (trackId ? findTrackById(trackId) : undefined);
    if (!track) {
        throw new Error("No track specified");
    }

    const requested = startTime ?? get(currentPlayheadTime);
    const insertAt = resolveInsertionTime(track, requested);
    const firstStart = Math.min(...animationGroup.animations.map((a) => a.start));
    const newClips = animationGroup.animations.map((animation) =>
        cloneAnimationWithTimeOffset(animation, insertAt - firstStart)
    );
    const insertEnd = Math.max(...newClips.map((a) => a.end));

    const before = clipEndingBefore(track, insertAt);
    if (before) {
        newClips[0].startKeyframe = {...before.endKeyframe, id: uuid()};
    }

    // Ripple: push each later clip just past whatever now ends before it.
    let cursor = insertEnd;
    for (const clip of [...track.animations].sort(byStart)) {
        if (clip.end <= insertAt + EPSILON) continue;
        if (clip.start < cursor - EPSILON) {
            const shift = cursor - clip.start;
            clip.start += shift;
            clip.end += shift;
        }
        cursor = Math.max(cursor, clip.end);
    }

    const after = [...track.animations]
        .sort(byStart)
        .find((clip) => clip.start >= insertEnd - EPSILON);
    const lastNew = newClips[newClips.length - 1];
    if (isEmptyAnimation) {
        lastNew.endKeyframe = after
            ? {...after.startKeyframe, id: uuid()}
            : {...newClips[0].startKeyframe, id: uuid()};
    } else if (after) {
        after.startKeyframe = {...lastNew.endKeyframe, id: uuid()};
    }

    track.animations.push(...newClips);
    sortAnimationsInPlace(track);

    // Ensure timeline end accommodates the whole group
    extendTimelineForTrack(track);
    await tick();

    return {
        ...animationGroup,
        animations: newClips,
    };
}

export function findTrackById(id: string): Track | undefined {
    for (let i = 0; i < project.tracks.length; i++) {
        if (project.tracks[i].id === id) {
            return project.tracks[i];
        }
    }
    return undefined;
}

function sortAnimationsInPlace(track: Track): void {
    track.animations.sort(function (a, b) {
        return a.start - b.start;
    });
}

export function cloneAnimationWithTimeOffset(
    animDef: Animation,
    offset: number
): Animation {
    const start = animDef.start + offset;
    const end = animDef.end + offset;
    return {
        ...animDef,
        id: uuid(),
        start,
        end,
        startKeyframe: {...animDef.startKeyframe, id: uuid()},
        endKeyframe: {...animDef.endKeyframe, id: uuid()},
    };
}

function extendTimelineForTrack(track: Track): void {
    const currentEndTime = project.timeline.endTime;
    const lastEnd = computeLastEnd(track.animations);
    if (lastEnd > currentEndTime) {
        get(videoController).setEndTime(lastEnd);
    }
}

function computeLastEnd(animations: Animation[]): number {
    let maxEnd = 0;
    for (let i = 0; i < animations.length; i++) {
        if (animations[i].end > maxEnd) maxEnd = animations[i].end;
    }
    return maxEnd;
}

export function findAnimationToTheLeftAndRightOfTime(
    track: Track,
    time: number
): { left?: Animation; right?: Animation, closest?: Animation } | undefined {
    const animations = track.animations;

    if (animations.length === 0) {
        return undefined;
    }

    let left: Animation | undefined = undefined;
    let right: Animation | undefined = undefined;
    let closest: Animation | undefined = animations[0];

    for (const animation of animations) {
        if (animation.end <= time) {
            if (!left || animation.end > left.end) {
                left = animation;
            }
            closest = animation;
        }

        if (animation.start >= time || animation.end > time) {
            if (!right) {
                right = animation;
            } else if (right.end === animation.start) {
                right = animation;
            }
            if (!left || (Math.abs(animation.start - time) <= Math.abs(left.end - time) && left.end !== time)) {
                closest = animation;
            }
        }
    }
    return {left, right, closest};
}

export function snapToNearest360(v: number): number {
    const k = Math.floor((v + 180) / 360); // ties go downwards
    return k * 360;
}