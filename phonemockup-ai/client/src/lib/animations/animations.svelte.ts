import {type AnimationGroup, AnimationCategories, AnimationCurve, zeroVec} from "$lib/components/mock-video/Animation";
import {v4 as uuid} from "uuid";
import defaultAnimationGroup from "./Still.json";

const modules = import.meta.glob("$lib/animations/presets/*.json", {eager: true});

const animationGroups: AnimationGroup[] = Object.values(modules).map(
    (mod: any) => mod.default
).sort((a, b) => b.priority - a.priority);

// Saved projects contain their own keyframes. Keep old links/API IDs readable,
// but only the new collection is offered in the gallery and preset picker.
const legacyModules = import.meta.glob("$lib/animations/*.json", {eager: true});
const legacyGroups: AnimationGroup[] = Object.values(legacyModules).map((mod: any) => mod.default);

export default animationGroups;
export const defaultAnimation = defaultAnimationGroup as unknown as AnimationGroup;

export function findAnimationGroupById(id: string) {
    return animationGroups.find(group => group.id === id) ?? legacyGroups.find(group => group.id === id);
}

export function createEmptyAnimationGroup(animationName?: string) {
    return {
        id: uuid(),
        name: "Animation group",
        isOfficial: true,
        categories: [],
        favorited: false,
        isCommunity: false,
        preview: undefined,
        priority: 0,
        animations: [{
            id: uuid(),
            name: animationName ?? `Animation`,
            start: 0,
            end: 2,
            curve: AnimationCurve.Linear,
            startKeyframe: {id: uuid(), position: zeroVec(), rotation: zeroVec(), opacity: 1},
            endKeyframe: {id: uuid(), position: zeroVec(), rotation: zeroVec(), opacity: 1}
        }],
    };
};

