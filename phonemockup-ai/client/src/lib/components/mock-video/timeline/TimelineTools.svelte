<script lang="ts">
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import {Trash, Dot, Tally5, Magnet, FoldHorizontal} from "@lucide/svelte";
    import {Button} from "$lib/components/ui/button";
    import {videoController} from "$lib/stores/video.svelte";
    import {get} from "svelte/store";
    import {dev} from "$app/environment";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {project} from "$lib/stores/project.svelte";

    let {
        snapEnabled = $bindable(),
        createMp4ForAnimations,
        clearTimeline,
        addCenterAnimation,
    } = $props();
    // Tooltip state for magnet hint
    let shouldShowSnapHint = $state(false);
    let snapHintTimer: number | null = null;

    const snapTooltipText = $derived(snapEnabled ? "Disable timeline snapping" : "Enable timeline snapping");

    export function showSnapHint() {
        shouldShowSnapHint = true;
        if (snapHintTimer) clearTimeout(snapHintTimer);
        snapHintTimer = window.setTimeout(() => {
            shouldShowSnapHint = false;
            snapHintTimer = null;
        }, 2000);
    }

    function snugTimeline() {
        const allTracks = project.tracks ?? [];
        const allAnims = allTracks.flatMap((t) => t.animations ?? []);
        if (allAnims.length === 0) return;

        // Find earliest start and latest end
        let minStart = Infinity;
        let maxEnd = -Infinity;
        for (const a of allAnims) {
            if (Number.isFinite(a.start) && a.start < minStart) minStart = a.start;
            if (Number.isFinite(a.end) && a.end > maxEnd) maxEnd = a.end;
        }
        if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return;

        // If already starting at 0, just set timeline end and exit
        const offset = minStart;
        if (offset === 0) {
            const vc = get(videoController);
            vc.startTime.set(0);
            vc.setEndTime(maxEnd);
            return;
        }

        // Shift all animations by -offset
        for (const track of allTracks) {
            if (!track.animations) continue;
            for (const anim of track.animations) {
                if (!Number.isFinite(anim.start) || !Number.isFinite(anim.end)) continue;
                anim.start = anim.start - offset;
                anim.end = anim.end - offset;
                // Keyframes are already relative to animation start (time=0 at anim.start),
                // so we do NOT change keyframe.time.
            }
        }

        // Recompute new max end after shift
        let newMaxEnd = -Infinity;
        for (const a of allAnims) {
            if (a.end > newMaxEnd) newMaxEnd = a.end;
        }

        get(videoController).setEndTime(newMaxEnd);
    }
</script>

<!-- TODO Add some more tools, or remove this background -->
<div class="justify-self-center bg-card rounded-xl flex items-center justify-center gap-2 px-8">
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                <Button
                        data-testid="timeline-tool-add-center-animation"
                        variant="ghost"
                        size="icon"
                        onclick={() => {addCenterAnimation(project.tracks[0].id); unfocusElement();}}
                >
                    <Dot class="size-5"/>
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="center" sideOffset={8}>
                Add animation which moves and rotates model back to center
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>

    <Tooltip.Provider>
        <Tooltip.Root open={shouldShowSnapHint}>
            <Tooltip.Trigger>
                <Button
                        data-testid="timeline-tool-toggle-snapping"
                        variant="ghost"
                        size="icon"
                        class={snapEnabled ? "text-emerald-500" : "opacity-70"}
                        aria-pressed={snapEnabled}
                        aria-label={snapTooltipText}
                        title={snapTooltipText}
                        onclick={() => {snapEnabled = !snapEnabled; unfocusElement();}}
                >
                    <Magnet class="size-5"/>
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="center" sideOffset={8}>
                {snapTooltipText}
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>

    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                <Button
                        data-testid="timeline-tool-snug-timeline"
                        variant="ghost"
                        size="icon"
                        onclick={() => {snugTimeline(); unfocusElement()}}
                >
                    <FoldHorizontal class="size-5"/>
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="center" sideOffset={8}>
                Set timeline start to the first animation’s start and end to the last animation’s end.
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>

    {#if dev}
        <Tooltip.Provider>
            <Tooltip.Root>
                <Tooltip.Trigger>
                    <Button
                            data-testid="timeline-tool-create-mp4-for-animations"
                            variant="ghost"
                            size="icon"
                            onclick={createMp4ForAnimations}
                    >
                        <Tally5 class="size-5"/>
                    </Button>
                </Tooltip.Trigger>
                <Tooltip.Content side="top" align="center" sideOffset={8}>
                    Loop over all animations and create mp4 files
                </Tooltip.Content>
            </Tooltip.Root>
        </Tooltip.Provider>
    {/if}

    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                <Button
                        data-testid="timeline-tool-clear-timeline"
                        variant="ghost"
                        size="icon"
                        class="text-red-500 hover:text-white hover:bg-red-500 dark:hover:bg-red-500"
                        onclick={clearTimeline}
                >
                    <Trash class="size-5"/>
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" align="center" sideOffset={8}>
                Remove all animations
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>
</div>
