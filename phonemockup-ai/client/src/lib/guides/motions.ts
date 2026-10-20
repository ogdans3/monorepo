import animationGroups from "$lib/animations/animations.svelte";
import type { AnimationGroup } from "$lib/components/mock-video/Animation";

// Short names for the device each motion opens with (its previewModelId).
const deviceNames: Record<string, string> = {
  "iphone-16-pro": "iPhone 16 Pro",
  "pixel-9-pro": "Pixel 9 Pro",
  "galaxy-s24-ultra": "Galaxy S24 Ultra",
  "macbook-pro-14-m4": "MacBook Pro 14″",
};

/** The guide's motions, in its order. Only the sixteen offered presets. */
export function motionsFor(ids: string[]): AnimationGroup[] {
  return ids
    .map((id) => animationGroups.find((group) => group.id === id))
    .filter((group): group is AnimationGroup => !!group);
}

export function loopSeconds(group: AnimationGroup): number {
  return Math.max(...group.animations.map((a) => a.end));
}

/** "6" for a whole number of seconds and "5.4" otherwise, never rounded away. */
export function formatSeconds(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

export function deviceOf(group: AnimationGroup): string {
  return deviceNames[group.previewModelId ?? ""] ?? "iPhone 16 Pro";
}

export function background(group: AnimationGroup): string {
  return `rgb(${(group.previewBackground ?? [229, 228, 223]).slice(0, 3).join(",")})`;
}
