<script lang="ts">
    import {Plus, Magnet, Pause, Play} from "@lucide/svelte";
    import {v4 as uuid} from "uuid";
    import {
        type AnimationGroup,
    } from "../Animation";
    import {derived, get} from "svelte/store";
    import {currentPlayheadTime, videoController, videoPlaying} from "../../../stores/video.svelte";
    import {setTransformControlsFromPlayhead} from "../../../stores/tracks.svelte";
    import TrackComponent from "../Track.svelte";
    import PlayheadComponent from "./Playhead.svelte";
    import testAnimation from "$lib/animations/test/test.json";
    import {createEmptyAnimationGroup, defaultAnimation} from "$lib/animations/animations.svelte";
    import {Button} from "$lib/components/ui/button";
    import {Input} from "$lib/components/ui/input";
    import {
        maxAnimationDragDistanceAbs,
        animationThatIsBeingDragged,
        animationDragMode,
        selectedAnimationKeyframe,
        selectedAnimationStore
    } from "$lib/stores/animation.svelte";
    import {onMount} from "svelte";
    import TimelineTools from "$lib/components/mock-video/timeline/TimelineTools.svelte";
    import AnimationPreviewDialog from "$lib/components/mock-video/timeline/AnimationPreviewDialog.svelte";
    import {
        addAnimationGroup, clipEndingBefore, resolveInsertionTime, snapToNearest360
    } from "$lib/components/mock-video/timeline/animation-placement.svelte";
    import {findTrackById} from "$lib/components/mock-video/timeline/animation-placement.svelte.js";
    import {Skeleton} from "$lib/components/ui/skeleton";
    import {dev} from "$app/environment";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import type {Track} from "$lib/components/mock-video/Project";
    import {project} from "$lib/stores/project.svelte";

    let {createMp4ForAnimations, animationGroup} = $props();
    let timelineTools: TimelineTools;
    let selectedTrackId: string | null = null;
    let snapEnabled = $state<boolean>(true);
    let showAnimationDialog = $state(false);

    const FRAME = $derived(1 / project.settings.fps);

    let startTime = 0;
    let mouseHoverPosition = $state<number | null>(null);
    let timelineElementContainer: HTMLElement | null = $state(null);

    function createAnimationForTrack(track: Track, index: number): AnimationGroup {
        return animationGroup ?? defaultAnimation;
    }

    const endTime = $derived(project.timeline.endTime);

    async function addPhone() {
        const id = uuid();
        const track: Track = {
            id,
            phoneName: `Phone ${project.tracks.length + 1}`,
            animations: []
        };

        const first = createAnimationForTrack(track, 0);
        await _addAnimationGroup(first, undefined, track)
        project.tracks.push(track);

        setTransformControlsFromPlayhead();
    }

    function openAnimationDialog(trackId: string) {
        selectedTrackId = trackId;
        showAnimationDialog = true;
    }

    export function clear() {
        selectedAnimationStore.set(null);
        selectedAnimationKeyframe.set(null);
        project.tracks.forEach(track => (track.animations.splice(0, track.animations.length)));
        get(videoController).refreshPose();
    }

    // The sidebar edits a selected keyframe through the pose shown at the
    // playhead, so a keyframe stays selected only while the playhead is on
    // it. Otherwise edits would write the in-between pose into it.
    $effect(() => {
        const animation = $selectedAnimationStore;
        const keyframe = $selectedAnimationKeyframe;
        const time = $currentPlayheadTime;
        if (!animation || !keyframe) return;
        const keyTime = keyframe.id === animation.startKeyframe?.id ? animation.start
            : keyframe.id === animation.endKeyframe?.id ? animation.end
            : null;
        if (keyTime === null || Math.abs(keyTime - time) > 1e-3) {
            selectedAnimationStore.set(null);
            selectedAnimationKeyframe.set(null);
        }
    });

    function clearWithPrompt() {
        const confirmed = confirm("This will remove all animations from your timeline");
        if (confirmed) {
            clear();
        }
    }

    export async function chooseAnimation(animationGroup: AnimationGroup, trackId?: string) {
        let group;
        if (selectedTrackId ?? trackId) {
            group = await _addAnimationGroup(animationGroup, selectedTrackId ?? trackId!);
        }
        showAnimationDialog = false;
        selectedTrackId = null;
        return group;
    }

    async function addEmptyAnimation(trackId: string) {
        return await addAnimationGroup(createEmptyAnimationGroup(), trackId, undefined, true, get(currentPlayheadTime));
    }

    async function addCenterAnimation(trackId: string) {
        const track = findTrackById(trackId);
        if (!track) return;
        const time = get(currentPlayheadTime);
        const animationGroup = createEmptyAnimationGroup("Back to center");
        // Unwind to the whole turn nearest the pose it starts from, so it
        // never spins the long way round.
        const before = clipEndingBefore(track, resolveInsertionTime(track, time));
        if (before) {
            animationGroup.animations[0].endKeyframe.rotation = {
                x: snapToNearest360(before.endKeyframe.rotation.x),
                y: snapToNearest360(before.endKeyframe.rotation.y),
                z: snapToNearest360(before.endKeyframe.rotation.z),
            };
        }

        return await addAnimationGroup(animationGroup, trackId, undefined, undefined, time);
    }

    async function _addAnimationGroup(animationGroup: AnimationGroup, trackId?: string, track?: Track) {
        return await addAnimationGroup(animationGroup, trackId, track, undefined, get(currentPlayheadTime));
    }

    let rulerContainerWidth = $state(0);
    const totalSeconds = $derived(Math.max(0, endTime - startTime));
    // Half-second ticks, widening on long timelines so labels don't pile up.
    const step = $derived([0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => totalSeconds / s <= 40) ?? 60);
    const totalTicks = $derived(Math.ceil(totalSeconds / step));

    // width per tick (fills container)
    const tickWidth = $derived(totalTicks > 0 ? rulerContainerWidth / totalTicks : 0);
    const pxPerSecond = $derived(
        endTime - startTime > 0 ? rulerContainerWidth / (endTime - startTime) : 0
    );

    const ticks = $derived.by(() => {
        const out: Array<{ time: number; major: boolean }> = [];
        if (endTime <= startTime) return out;

        // Always include start
        out.push({time: startTime, major: Math.abs(startTime - Math.round(startTime)) < 1e-9});

        // Middle ticks
        // Use a counter to avoid cumulative float error
        const totalSteps = Math.floor((endTime - startTime) / step);
        for (let k = 1; k <= totalSteps; k++) {
            const t = startTime + k * step;
            const major = Math.abs(t - Math.round(t)) < 1e-9;
            out.push({time: t, major});
        }

        // Always include end
        if (out.length === 0 || Math.abs(out[out.length - 1].time - endTime) > 1e-9) {
            out.push({time: endTime, major: Math.abs(endTime - Math.round(endTime)) < 1e-9});
        }

        return out;
    });

    let currentTimeField = $state(get(currentPlayheadTime).toFixed(2));
    let endTimeField = $state(endTime.toFixed(2));

    $effect(() => {
        currentTimeField = $currentPlayheadTime.toFixed(2);
    });
    $effect(() => {
        endTimeField = endTime.toFixed(2);
    });

    function handleCurrentTimeInput(e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (!Number.isFinite(val)) {
            // Not a number: put back the time the playhead is at.
            currentTimeField = get(currentPlayheadTime).toFixed(2);
            return;
        }
        const time = Math.min(endTime, Math.max(0, val));
        get(videoController).setPlayheadPosition(time);
        currentTimeField = time.toFixed(2);
    }

    function handleEndInput(e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (Number.isFinite(val)) {
            // setEndTime clamps to the lengths the timeline can draw.
            get(videoController).setEndTime(val);
        }
        endTimeField = project.timeline.endTime.toFixed(2);
    }

    function commitOnEnter(e: KeyboardEvent) {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
    }

    function handleMouseMove(e: MouseEvent) {
        if (!timelineElementContainer) return;

        // Get mouse position relative to the timeline container
        const rect = timelineElementContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Clamp to [0, rulerContainerWidth]
        const clampedX = Math.max(0, Math.min(rulerContainerWidth, x));
        if (!(pxPerSecond > 0)) return;

        // Convert to time based on pixels-per-second
        const time = startTime + clampedX / pxPerSecond;
        mouseHoverPosition = time;

        // If left mouse button and not dragging an animation, move playhead
        if ((e.buttons & 1) === 1 && get(animationThatIsBeingDragged) === null) {
            get(videoController).setPlayheadPosition(time);
        }
    }

    function handleMouseMove2(e: MouseEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clampedX = Math.max(0, Math.min(rulerContainerWidth, x));
        const time = startTime + clampedX / pxPerSecond;
        mouseHoverPosition = time;

        //Mouse 1 (left click)
        if ((e.buttons & 1) === 1 && get(animationThatIsBeingDragged) === null) {
            get(videoController).setPlayheadPosition(time);
        }
    }

    function handleMouseLeave() {
        mouseHoverPosition = null;
    }

    function clickTimeline() {
        //The user actually dragged the animation a little, so we dont want to change the playhead
        if ($maxAnimationDragDistanceAbs > 10) {
            return;
        }
        if (mouseHoverPosition == null) {
            return;
        }
        get(videoController).setPlayheadPosition(mouseHoverPosition);
    }

    function onKeyDown(e: KeyboardEvent) {
        // Ignore when typing in inputs or contenteditable
        const target = e.target as HTMLElement | null;
        const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as any).isContentEditable);
        if (isTyping) {
            return;
        }
        // Keys in a dialog belong to it; an export in progress especially
        // must not have its playhead moved underneath it.
        if (document.querySelector('[role="dialog"][data-state="open"]')) {
            return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();

            const base = FRAME;
            const multiplier = e.shiftKey ? 5 : e.altKey ? 0.5 : 1;
            const delta = (e.key === "ArrowRight" ? 1 : -1) * base * multiplier;

            const current = get(currentPlayheadTime);
            const next = Math.min(
                endTime,
                Math.max(0, current + delta)
            );

            get(videoController).setPlayheadPosition(next);
        }
    }

    onMount(() => {
        if (project.tracks.length === 0) {
            addPhone();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    });

    function hintSnap() {
        timelineTools.showSnapHint();
    }
</script>

<div class="timeline flex flex-col border-t" data-testid="timeline">
    <!-- Controls row -->
    <div class="px-4 pt-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <div class="justify-self-start flex gap-2">
            <Button
                    class="size-12 group rounded-xl transition-all duration-150
         hover:bg-white/6 dark:hover:bg-white/8
         hover:ring-1 hover:ring-white/15
         hover:-translate-y-[1px] hover:scale-[1.02]"
                    variant="ghost"
                    size="icon"
                    aria-label={$videoPlaying ? "Pause" : "Play"}
                    onclick={() => {$videoController.toggle(); unfocusElement()}}
                    title={$videoPlaying ? "Pause" : "Play"}
            >
                {#if $videoPlaying}
                    <Pause
                            class="size-9 text-white"
                            fill="currentColor"
                    />
                {:else}
                    <Play
                            class="size-9 text-white"
                            fill="currentColor"
                    />
                {/if}
            </Button>

            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <Button
                            size="sm"
                            variant="secondary"
                            class="text-xs"
                            onclick={() => {addEmptyAnimation(project.tracks[0].id); unfocusElement();}}
                    >
                        Add empty animation
                    </Button>
                    <Button
                            size="sm"
                            variant="secondary"
                            class="text-xs"
                            onclick={() => {openAnimationDialog(project.tracks[0].id); unfocusElement();}}
                    >
                        Add animation
                    </Button>
                </div>
            </div>
        </div>
        <TimelineTools bind:this={timelineTools} bind:snapEnabled createMp4ForAnimations={createMp4ForAnimations}
                       addCenterAnimation={addCenterAnimation}
                       clearTimeline={clearWithPrompt}
        />

        <div class="justify-self-end flex items-center gap-2">
            <div class="relative">
                <Input
                        id="start-time"
                        type="text"
                        bind:value={currentTimeField}
                        onblur={handleCurrentTimeInput}
                        onkeydown={commitOnEnter}
                        class="w-20 pr-5 text-right text-xs"
                        aria-label="Start time in seconds"
                />
                <span
                        class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-70"
                >
                    s
                </span>
            </div>

            <span class="opacity-70">of</span>

            <div class="relative">
                <Input
                        id="end-time"
                        type="text"
                        bind:value={endTimeField}
                        onblur={handleEndInput}
                        onkeydown={commitOnEnter}
                        class="w-20 pr-5 text-right text-xs"
                        aria-label="End time in seconds"
                />
                <span
                        class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-70"
                >
                    s
                </span>
            </div>
        </div>
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="px-8 pb-10 pt-8"
         onmouseup={clickTimeline}
         onmousemove={handleMouseMove}
         onmouseleave={handleMouseLeave}
         role="button"
    >
        <!-- Ruler / ticks -->
        <div class="relative pb-4" bind:this={timelineElementContainer}>
            <div>
                <div class="flex items-stretch">
                    <div class="w-full" bind:clientWidth={rulerContainerWidth} data-testid="timeline-ruler">
                        {#if rulerContainerWidth}
                            <div class="relative h-8 w-full">
                                <div class="relative h-full w-full">
                                    {#each ticks as tick}
                                        <div
                                                class="h-full absolute top-0 flex select-none flex-col items-start"
                                                style={`left: ${Math.round((tick.time - startTime) * pxPerSecond)}px`}
                                        >
                                            <!-- TODO: Should we do h-1/4 border-l when not major ticks? -->
                                            <div class="h-full border-l"></div>
                                            {#if tick.time != null}
                                                <div
                                                        class="mt-0.5 self-start text-xs opacity-70"
                                                        style="left: 0; transform: translateX(-50%);"
                                                >
                                                    {tick.time.toFixed(1)}
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <Skeleton class="bg-neutral-800 h-16 w-full rounded-lg"/>
                        {/if}
                    </div>
                </div>

                <!-- Tracks -->
                {#if rulerContainerWidth}
                    <div class="pt-2 w-full flex">
                        <div class="w-full">
                            {#each project.tracks as track, i (track.id)}
                                <TrackComponent
                                        bind:track={project.tracks[i]}
                                        {pxPerSecond}
                                        {snapEnabled}
                                        onSnapFrustration={hintSnap}
                                />
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Hover and playhead indicators -->
            {#if rulerContainerWidth}
                {#if $animationDragMode === "move" || $animationDragMode == null}
                    <PlayheadComponent
                            showTime={true}
                            time={mouseHoverPosition}
                            color="bg-blue-500"
                            {rulerContainerWidth}
                    />
                {/if}
                <PlayheadComponent showTime={false} {rulerContainerWidth}/>

                <!-- Playheads for showing animation start and end -->
                <PlayheadComponent
                        enabled={!!$animationThatIsBeingDragged}
                        time={$animationThatIsBeingDragged?.start ?? null}
                        showTime={true}
                        color="bg-pink-400"
                        {rulerContainerWidth}
                />
                <PlayheadComponent
                        enabled={!!$animationThatIsBeingDragged}
                        time={$animationThatIsBeingDragged?.end ?? null}
                        showTime={true}
                        color="bg-pink-400"
                        {rulerContainerWidth}
                />
            {/if}
        </div>
    </div>
</div>
<AnimationPreviewDialog bind:showAnimationDialog chooseAnimation={chooseAnimation}/>

<style>
    /* Keep your spinner reset if needed for number inputs */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>