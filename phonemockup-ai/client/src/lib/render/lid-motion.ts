import type {Model} from "$lib/models/3d-models/3d-models-spec";

/** Shared by stills, scrubbing and exports. Opening starts at timeline zero. */
export function lidAngleAt(model: Model, time: number): number | null {
    const hinge = model.hinge;
    if (!hinge) return null;
    const picked = Number.isFinite(model.lidAngle) ? model.lidAngle! : hinge.defaultAngle;
    const target = Math.max(hinge.minAngle, Math.min(hinge.maxAngle, picked));
    const duration = model.lidOpenDuration;
    if (!duration || !Number.isFinite(duration) || duration <= 0) return target;
    const progress = Math.max(0, Math.min(1, (Number.isFinite(time) ? time : 0) / duration));
    const eased = .5 - .5 * Math.cos(Math.PI * progress);
    return hinge.minAngle + (target - hinge.minAngle) * eased;
}
