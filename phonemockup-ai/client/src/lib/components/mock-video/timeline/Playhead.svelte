<script lang="ts">
    import {tweened} from "svelte/motion";
    import {onDestroy, untrack} from "svelte";
    import {get, derived} from "svelte/store";
    import {videoController, currentPlayheadTime as globalPlayheadTime} from "../../../stores/video.svelte";
    import {cn} from "../../../utils/cn";
    import {linear} from "svelte/easing";
    import {project} from "$lib/stores/project.svelte";

    const {
        color = "bg-red-500",
        class: className = "",
        rulerContainerWidth,
        time = undefined,
        enabled = true,
        showTime,
    }: {
        color?: string;
        class?: string;
        rulerContainerWidth: number;
        time?: number | null;
        enabled?: boolean;
        showTime: boolean;
    } = $props();

    const startTime = derived(get(videoController).startTime, (time) => time);
    const endTime = $derived(project.timeline.endTime);

    // tweened store for playhead position
    let showPlayhead = $state(time === undefined || time !== null);
    const playheadX = tweened(0, {
        duration: 0,
        easing: linear
    });
    let currentPlayheadTime = $state(0);

    function calculateX(t: number | null) {
        if (t == null) {
            return null;
        }
        return (
            Math.max(0, Math.min(1, (t - $startTime) / (endTime - $startTime))) *
            rulerContainerWidth
        );
    }

    function calculateTime(x: number) {
        return $startTime + (x / rulerContainerWidth) * (endTime - $startTime);
    }

    function animatePlayhead(currentTime: number) {
        const currentX = calculateX(currentTime)!;
        const remaining = Math.max(0, (endTime - currentTime) * 1000);

        // jump to current position instantly
        playheadX.set(currentX, {duration: 0});

        // then animate to the end; a newer run supersedes this one
        const run = ++playbackRun;
        playheadX.set(rulerContainerWidth, {
            duration: remaining,
            easing: linear
        }).then(() => {
            if (run === playbackRun && get(videoController).isPlaying) animationFinished();
        });
    }

    let playbackRun = 0;
    const unsubscribers: Array<() => void> = [];

    if (time === undefined) {
        unsubscribers.push(get(videoController).playing.subscribe(async (playing) => {
            if (!playing) {
                playbackRun++;
                const time = calculateTime($playheadX);
                if (isNaN(time)) {
                    return;
                }
                get(videoController)?.setPlayheadPosition(time);
            } else {
                animatePlayhead(get(get(videoController).playheadAnimateFrom));
            }
        }));

        unsubscribers.push(get(videoController).playheadAnimateFrom.subscribe((currentTime) => {
            if (!get(videoController).isPlaying) {
                playheadX.set(calculateX(currentTime)!, {duration: 0});
                return;
            }
            if (endTime > $startTime && rulerContainerWidth > 0) {
                animatePlayhead(currentTime);
            }
        }));

        // The ruler resized or the timeline changed length: put the line back
        // over the time it stands for, and re-aim a running playback.
        $effect(() => {
            const width = rulerContainerWidth;
            const length = endTime;
            if (!(width > 0) || !(length > 0)) return;
            const time = untrack(() => currentPlayheadTime);
            if (untrack(() => get(videoController).isPlaying)) {
                animatePlayhead(time);
            } else {
                playheadX.set(calculateX(time)!, {duration: 0});
            }
        });
    } else {
        // Static playhead (e.g. hover)
        $effect(() => {
            const x = calculateX(time);
            if (x === null) {
                showPlayhead = false;
                return;
            }
            showPlayhead = true;
            playheadX.set(x, {duration: 0});
        });
    }
    unsubscribers.push(playheadX.subscribe((val) => {
        const _time = calculateTime(val);
        if (isNaN(_time)) {
            return;
        }
        if (time === undefined) {
            globalPlayheadTime.set(_time);
        }
        currentPlayheadTime = _time;
    }));

    onDestroy(() => {
        playbackRun++;
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    });

    function animationFinished() {
        get(videoController).playbackEnded();
    }
</script>

{#if enabled && showPlayhead}
    <div
            class={cn(
            "absolute left-0 right-0 top-0 bottom-0 pointer-events-none",
            className
        )}
    >
        {#if showTime}
            <!-- Time label above playhead -->
            <div
                    class="absolute -top-5 text-[10px] text-surface-200 bg-surface-800/90 px-1 rounded pointer-events-none"
                    style:transform={`translateX(${$playheadX}px) translateX(-50%)`}
            >
                {currentPlayheadTime.toFixed(2)}s
            </div>
        {/if}

        <!-- Playhead line -->
        <div
                class={cn("absolute top-0 bottom-0 w-[1px] pointer-events-none", color)}
                style:transform={`translateX(${$playheadX}px)`}
        ></div>
    </div>
{/if}