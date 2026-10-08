import {AnimationCurve, type Vec3} from "$lib/components/mock-video/Animation";

export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t),
    };
}

import {
    backIn, backInOut, backOut, bounceIn, bounceInOut, bounceOut,
    circIn, circInOut, circOut,
    cubicIn,
    cubicInOut,
    cubicOut, elasticIn, elasticInOut, elasticOut, expoIn, expoInOut, expoOut,
    linear,
    quadIn,
    quadInOut,
    quadOut, quartIn, quartInOut, quartOut, quintIn, quintInOut, quintOut,
    sineIn,
    sineInOut,
    sineOut
} from "svelte/easing"; // adjust path
export type EasingFunction = (t: number) => number;

export const AnimationCurveFn: Record<AnimationCurve, EasingFunction> = {
    [AnimationCurve.Linear]: linear,

    [AnimationCurve.SineIn]: sineIn,
    [AnimationCurve.SineOut]: sineOut,
    [AnimationCurve.SineInOut]: sineInOut,

    [AnimationCurve.QuadIn]: quadIn,
    [AnimationCurve.QuadOut]: quadOut,
    [AnimationCurve.QuadInOut]: quadInOut,

    [AnimationCurve.CubicIn]: cubicIn,
    [AnimationCurve.CubicOut]: cubicOut,
    [AnimationCurve.CubicInOut]: cubicInOut,

    [AnimationCurve.QuartIn]: quartIn,
    [AnimationCurve.QuartOut]: quartOut,
    [AnimationCurve.QuartInOut]: quartInOut,

    [AnimationCurve.QuintIn]: quintIn,
    [AnimationCurve.QuintOut]: quintOut,
    [AnimationCurve.QuintInOut]: quintInOut,

    [AnimationCurve.ExpoIn]: expoIn,
    [AnimationCurve.ExpoOut]: expoOut,
    [AnimationCurve.ExpoInOut]: expoInOut,

    [AnimationCurve.CircIn]: circIn,
    [AnimationCurve.CircOut]: circOut,
    [AnimationCurve.CircInOut]: circInOut,

    [AnimationCurve.BackIn]: backIn,
    [AnimationCurve.BackOut]: backOut,
    [AnimationCurve.BackInOut]: backInOut,

    [AnimationCurve.BounceIn]: bounceIn,
    [AnimationCurve.BounceOut]: bounceOut,
    [AnimationCurve.BounceInOut]: bounceInOut,

    [AnimationCurve.ElasticIn]: elasticIn,
    [AnimationCurve.ElasticOut]: elasticOut,
    [AnimationCurve.ElasticInOut]: elasticInOut
};

export const AnimationCurveOptions: Array<{
    value: AnimationCurve;
    label: string
}> = Object.values(AnimationCurve).map((v) => ({value: v, label: v}));

// Helper to evaluate eased t in [0..1]
export function evalCurve(curve: AnimationCurve, t: number): number {
    const fn = AnimationCurveFn[curve] ?? linear;
    // Clamp to [0,1] defensively
    const tt = t <= 0 ? 0 : t >= 1 ? 1 : t;
    return fn(tt);
}
