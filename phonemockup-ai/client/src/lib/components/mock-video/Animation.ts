import type {Track} from "$lib/components/mock-video/Project";

export enum ChangeOrigin {
    User,
    System
}

export type TrackableVec3 = { vector: Vec3; origin: ChangeOrigin; };
export type Vec3 = { x: number; y: number; z: number };
export const zeroVec: () => Vec3 = () => ({x: 0, y: 0, z: 0});

export type Seconds = number;
export type Keyframe = {
    id: string;
    position: Vec3;
    rotation: Vec3;
    opacity: number;
};

export type AnimationGroup = {
    id: string;
    name: string;
    animations: Animation[];
    preview?: string;
    poster?: string;
    description?: string;
    loop?: boolean;
    framing?: "full" | "detail";
    previewModelId?: string;
    previewBackground?: [number, number, number, number];
    demoMediaId?: "focus" | "workspace";
    favorited?: boolean;
    isOfficial: boolean;
    isCommunity: boolean;
    priority: number;
    categories?: AnimationCategories[];
}

export type Animation = {
    id: string;
    name: string;
    start: Seconds;
    end: Seconds;
    startKeyframe: Keyframe;
    endKeyframe: Keyframe;
    curve: AnimationCurve;
};

export function getAnimation(track: Track, animationId: string): Animation | undefined {
    return track.animations.find(animation => animation.id === animationId);
}

export enum AnimationCategories {
    Cinematic = "Cinematic",
    Reveal = "Reveal",
    Detail = "Detail",
    Loop = "Loop",
    Zoom = "Zoom",
    Slow = "Slow",
    Fast = "Fast",
    Spin = "Spin",
    In = "In",
    Out = "Out",
    Fancy = "Fancy",
}

// Keep enum names human-friendly and stable for storage/UI
export enum AnimationCurve {
    Linear = "Linear",

    SineIn = "SineIn",
    SineOut = "SineOut",
    SineInOut = "SineInOut",

    QuadIn = "QuadIn",
    QuadOut = "QuadOut",
    QuadInOut = "QuadInOut",

    CubicIn = "CubicIn",
    CubicOut = "CubicOut",
    CubicInOut = "CubicInOut",

    QuartIn = "QuartIn",
    QuartOut = "QuartOut",
    QuartInOut = "QuartInOut",

    QuintIn = "QuintIn",
    QuintOut = "QuintOut",
    QuintInOut = "QuintInOut",

    ExpoIn = "ExpoIn",
    ExpoOut = "ExpoOut",
    ExpoInOut = "ExpoInOut",

    CircIn = "CircIn",
    CircOut = "CircOut",
    CircInOut = "CircInOut",

    BackIn = "BackIn",
    BackOut = "BackOut",
    BackInOut = "BackInOut",

    BounceIn = "BounceIn",
    BounceOut = "BounceOut",
    BounceInOut = "BounceInOut",

    ElasticIn = "ElasticIn",
    ElasticOut = "ElasticOut",
    ElasticInOut = "ElasticInOut"
}

export function vectorsAreEquals(vec1: Vec3, vec2: Vec3): boolean {
    if (vec1 === vec2) {
        return true;
    }
    if (vec1 == null && vec2 != null) {
        return false;
    }
    if (vec2 == null && vec1 != null) {
        return false;
    }
    return vec1!.x === vec2!.x && vec1!.y === vec2!.y && vec1!.z === vec2!.z;
}
