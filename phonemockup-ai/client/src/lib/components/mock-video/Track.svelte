<script lang="ts">
    import {get} from "svelte/store";
    import {
        type Animation,
        AnimationCurve,
        ChangeOrigin,
        getAnimation,
        type TrackableVec3,
    } from "./Animation";
    import {
        animationDragMode,
        animationThatIsBeingDragged,
        maxAnimationDragDistanceAbs,
        selectedAnimationKeyframe,
        selectedAnimationStore
    } from "../../stores/animation.svelte";
    import {transformControlPosition, transformControlRotation, transformCurve} from "../../stores/transform.svelte";
    import {videoController} from "../../stores/video.svelte";
    import {toast} from "svelte-sonner";
    import * as ContextMenu from "$lib/components/ui/context-menu";
    import {onMount, tick} from "svelte";
    import {project} from "$lib/stores/project.svelte";
    import type {Track} from "$lib/components/mock-video/Project";

    let {
        track = $bindable(),
        snapEnabled,
        pxPerSecond,
        onSnapFrustration
    }: {
        track: Track;
        snapEnabled: boolean;
        pxPerSecond: number;
        onSnapFrustration?: () => void;
    } = $props();

    const startTime = get(videoController).startTime;

    /** The shortest a clip can be, in seconds. */
    const MIN_CLIP_SECONDS = 0.1;

    // Drag visuals control to prevent hover flicker
    let isDragging = $state(false);

    function leftFor(t: number) {
        return (t - $startTime) * pxPerSecond;
    }

    function widthFor(animation: Animation) {
        return Math.max(0, (animation.end - animation.start) * pxPerSecond);
    }

    // Magnetic hold types/state
    type HoldState = {
        targetTime: number;
        bandStartPx: number;
        bandEndPx: number;
    } | null;

    let holdStart: HoldState = null;
    let holdEnd: HoldState = null;
    let lastFreeStart = 0;
    let lastFreeEnd = 0;

    const HOLD_TOLERANCE_PX = 8; // symmetric band around snap point
    const SNAP_STEP = 0.5; // grid seconds

    function timeToX(t: number) {
        return (t - $startTime) * pxPerSecond;
    }

    function generateSnapPoints(anim: Animation) {
        if (!snapEnabled) {
            return [];
        }
        const points = new Set<number>();

        // Grid
        const start = Math.floor($startTime / SNAP_STEP) * SNAP_STEP;
        const end = Math.ceil(project.timeline.endTime / SNAP_STEP) * SNAP_STEP;
        for (let t = start; t <= end + 1e-6; t += SNAP_STEP) points.add(+t.toFixed(3));

        // Every other clip's edges. The array isn't re-sorted until the drop,
        // so index neighbours go stale once a clip is dragged past another.
        for (const other of track.animations) {
            if (other.id === anim.id) continue;
            points.add(other.start);
            points.add(other.end);
        }

        // Bounds
        points.add($startTime);
        points.add(project.timeline.endTime);

        return Array.from(points.values()).sort((a, b) => a - b);
    }

    function crossed(a: number, b: number, s: number) {
        // Did the [a -> b] segment cross s?
        return (a < s && b >= s) || (a > s && b <= s);
    }

    function engageHold(snapTime: number): HoldState {
        const x = timeToX(snapTime);
        return {
            targetTime: snapTime,
            bandStartPx: x - HOLD_TOLERANCE_PX,
            bandEndPx: x + HOLD_TOLERANCE_PX
        };
    }

    // "Furious small jitter" detector: someone fighting the snapping.
    type Sample = { t: number; x: number };

    let samples: Sample[] = [];
    let dirFlips: number[] = []; // timestamps of direction changes
    const SPEED_WINDOW_MS = 350; // short window for twitch detection
    const FIRE_COOLDOWN_MS = 1200;

    // thresholds (tweak to taste)
    const MAX_NET_DISPLACEMENT_PX = 18; // must end near where started
    const MAX_AVG_STEP_PX = 10; // average per-sample displacement small
    const MIN_DIR_FLIPS = 3; // frequent flips within window
    const MIN_PEAK_SPEED_PX_PER_S = 1000; // fast flick

    let lastFrustrationEmittedAt = 0;
    let lastDir: number | null = null;

    function now() {
        return performance.now();
    }

    function pushMouseSample(clientX: number) {
        const t = now();
        const previous = samples[samples.length - 1];
        samples.push({t, x: clientX});

        if (previous) {
            const dx = clientX - previous.x;
            const dir = dx === 0 ? lastDir : Math.sign(dx);
            if (lastDir !== null && dir !== null && dir !== 0 && dir !== lastDir) {
                dirFlips.push(t);
            }
            lastDir = dir;
        }

        // Keep both to the rolling window, so old flips stop counting.
        const cutoff = t - SPEED_WINDOW_MS;
        while (samples.length && samples[0].t < cutoff) samples.shift();
        while (dirFlips.length && dirFlips[0] < cutoff) dirFlips.shift();
    }

    function evaluateFuriousSmallJitter(): boolean {
        if (samples.length < 2) return false;

        // total and peak speed
        let total = 0;
        let peakSpeed = 0;
        for (let i = 1; i < samples.length; i++) {
            const a = samples[i - 1];
            const b = samples[i];
            const dx = Math.abs(b.x - a.x);
            const dt = b.t - a.t || 1;
            total += dx;
            peakSpeed = Math.max(peakSpeed, (dx / dt) * 1000); // px/sec
        }

        const net = Math.abs(samples[samples.length - 1].x - samples[0].x);
        const avgStep = total / (samples.length - 1);

        // Furious small jitter means:
        // - small net displacement (ends near where started)
        // - small average step (not traveling far)
        // - frequent direction changes
        // - but still fast flicks (peak speed high)
        const smallRegion = net <= MAX_NET_DISPLACEMENT_PX && avgStep <= MAX_AVG_STEP_PX;
        const twitchy = dirFlips.length >= MIN_DIR_FLIPS;
        const fast = peakSpeed >= MIN_PEAK_SPEED_PX_PER_S;

        return smallRegion && twitchy && fast;
    }

    function resetJitter() {
        samples = [];
        dirFlips = [];
        lastDir = null;
    }

    type DragMode = "move" | "resize-left" | "resize-right";

    let dragged: Animation | null = null;
    let dragMode: DragMode | null = null;
    let dragStartX = 0;
    let originalStart = 0;
    let originalEnd = 0;
    const DRAG_ACTIVATION_THRESHOLD_PX = 7;
    let dragActivated = false;

    function startDrag(
        e: MouseEvent,
        animationId: string,
        mode: DragMode
    ) {
        // Only the main button drags; a right click opens the clip's menu.
        if (e.button !== 0) return;
        const animation = getAnimation(track, animationId);
        if (!animation) {
            console.warn("No animation was found: ", {animationId, track});
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        animationThatIsBeingDragged.set(animation);
        maxAnimationDragDistanceAbs.set(0);
        dragged = animation;
        dragMode = mode;
        animationDragMode.set(dragMode);
        dragStartX = e.clientX;
        originalStart = animation.start;
        originalEnd = animation.end;

        // Reset hold state
        holdStart = null;
        holdEnd = null;
        lastFreeStart = originalStart;
        lastFreeEnd = originalEnd;
        dragActivated = false;
        lastFrustrationEmittedAt = 0;
        resetJitter();

        window.addEventListener("mousemove", onDrag);
        window.addEventListener("mouseup", stopDrag);
    }

    function onDrag(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const animation = dragged;
        if (!animation || !dragMode) return;

        // Track twitchy motion; only worth a hint when snapping is what's in the way.
        pushMouseSample(e.clientX);
        const tNow = now();
        if (
            snapEnabled &&
            evaluateFuriousSmallJitter() &&
            tNow - lastFrustrationEmittedAt >= FIRE_COOLDOWN_MS
        ) {
            lastFrustrationEmittedAt = tNow;
            onSnapFrustration?.();
        }

        const deltaPx = e.clientX - dragStartX;
        maxAnimationDragDistanceAbs.set(Math.max(Math.abs(deltaPx), $maxAnimationDragDistanceAbs));

        // A few pixels of wobble on a click shouldn't move anything. Past
        // that the clip follows the cursor exactly.
        if (!dragActivated) {
            if (Math.abs(deltaPx) < DRAG_ACTIVATION_THRESHOLD_PX) return;
            dragActivated = true;
            // Only now cover the page: a plain click must still reach the
            // timeline underneath, which moves the playhead.
            isDragging = true;
        }

        const deltaSec = (e.clientX - dragStartX) / pxPerSecond;
        const timelineEnd = project.timeline.endTime;

        // 1) compute free (unsnapped) times
        let freeStart = originalStart;
        let freeEnd = originalEnd;

        if (dragMode === "move") {
            const duration = originalEnd - originalStart;
            freeStart = Math.max(
                $startTime,
                Math.min(timelineEnd - duration, originalStart + deltaSec)
            );
            freeEnd = freeStart + duration;
        } else if (dragMode === "resize-left") {
            freeStart = Math.max(
                $startTime,
                Math.min(originalEnd - MIN_CLIP_SECONDS, originalStart + deltaSec)
            );
            freeEnd = originalEnd;
        } else if (dragMode === "resize-right") {
            freeEnd = Math.min(
                timelineEnd,
                Math.max(originalStart + MIN_CLIP_SECONDS, originalEnd + deltaSec)
            );
            freeStart = originalStart;
        }

        const snapPoints = generateSnapPoints(animation);
        let newStart = freeStart;
        let newEnd = freeEnd;

        // 2) magnetic HOLD logic per edge (true hold only after crossing)
        const xStart = timeToX(freeStart);
        const xEnd = timeToX(freeEnd);

        // START edge
        if (dragMode === "move" || dragMode === "resize-left") {
            if (holdStart) {
                const insideBand =
                    xStart >= holdStart.bandStartPx && xStart <= holdStart.bandEndPx;
                if (insideBand) {
                    newStart = holdStart.targetTime;
                } else {
                    holdStart = null;
                    newStart = freeStart;
                }
            }
            if (!holdStart) {
                for (const s of snapPoints) {
                    if (crossed(lastFreeStart, freeStart, s)) {
                        holdStart = engageHold(s);
                        newStart = s;
                        break;
                    }
                }
            }
        }

        // END edge
        if (dragMode === "move" || dragMode === "resize-right") {
            if (holdEnd) {
                const insideBand =
                    xEnd >= holdEnd.bandStartPx && xEnd <= holdEnd.bandEndPx;
                if (insideBand) {
                    newEnd = holdEnd.targetTime;
                } else {
                    holdEnd = null;
                    newEnd = freeEnd;
                }
            }
            if (!holdEnd) {
                for (const s of snapPoints) {
                    if (crossed(lastFreeEnd, freeEnd, s)) {
                        holdEnd = engageHold(s);
                        newEnd = s;
                        break;
                    }
                }
            }
        }

        // A moved clip keeps its length: at most one edge is held, and the
        // other follows. With both held at different points the start wins.
        if (dragMode === "move") {
            const duration = originalEnd - originalStart;
            if (holdStart) {
                newEnd = newStart + duration;
            } else if (holdEnd) {
                newStart = newEnd - duration;
            } else {
                newStart = freeStart;
                newEnd = freeEnd;
            }
        }

        // Bounds and min duration. The start bound is applied last, so a clip
        // longer than the timeline sticks out at the end, never before zero.
        if (dragMode === "move") {
            const duration = newEnd - newStart;
            if (newEnd > timelineEnd) {
                newEnd = timelineEnd;
                newStart = newEnd - duration;
            }
            if (newStart < $startTime) {
                newStart = $startTime;
                newEnd = newStart + duration;
            }
        } else {
            newStart = Math.max($startTime, Math.min(newStart, newEnd - MIN_CLIP_SECONDS));
            newEnd = Math.min(timelineEnd, Math.max(newEnd, newStart + MIN_CLIP_SECONDS));
        }

        // 3) commit, in place, so anything holding this clip (the selection,
        // the drag markers) keeps seeing the live object
        animation.start = newStart;
        animation.end = newEnd;

        // 4) update last free times (for next crossing detection)
        lastFreeStart = freeStart;
        lastFreeEnd = freeEnd;

        animationThatIsBeingDragged.set(animation);
        get(videoController).refreshPose();
    }

    function stopDrag(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener("mousemove", onDrag);
        window.removeEventListener("mouseup", stopDrag);

        const anim = dragged;
        if (anim) {
            track.animations.sort((a, b) => a.start - b.start);
            const index = track.animations.findIndex((a) => a.id === anim.id);
            const prevAnim = track.animations[index - 1];
            const nextAnim = track.animations[index + 1];

            // A clip dropped over a neighbour is trimmed to the gap it landed
            // in. If no usable gap is left, it goes back where it came from.
            let start = anim.start;
            let end = anim.end;
            if (prevAnim && start < prevAnim.end) start = prevAnim.end;
            if (nextAnim && end > nextAnim.start) end = nextAnim.start;
            if (end - start < MIN_CLIP_SECONDS - 1e-9) {
                start = originalStart;
                end = originalEnd;
            }
            anim.start = start;
            anim.end = end;
            track.animations.sort((a, b) => a.start - b.start);
        }

        dragged = null;
        dragMode = null;
        holdStart = null;
        holdEnd = null;
        dragActivated = false;
        resetJitter();
        animationDragMode.set(null);
        maxAnimationDragDistanceAbs.set(0);

        get(videoController).refreshPose();
        animationThatIsBeingDragged.set(null);
        isDragging = false;
    }

    async function toggleKeyframe(
        e: MouseEvent,
        animationId: string,
        firstOrLastKeyframe: 0 | 1,
    ) {
        e.preventDefault();
        e.stopPropagation();
        const animation = getAnimation(track, animationId);
        if (!animation) {
            console.warn("No animation found: ", {animationId, track});
            return;
        }
        const keyframe = firstOrLastKeyframe === 0 ? animation.startKeyframe : animation.endKeyframe;

        if (
            get(selectedAnimationStore)?.id === animation.id &&
            get(selectedAnimationKeyframe)?.id === keyframe.id
        ) {
            selectedAnimationStore.set(null);
            selectedAnimationKeyframe.set(null);
            return;
        }

        await get(videoController).setPlayheadPosition(firstOrLastKeyframe === 0 ? animation.start : animation.end);
        await tick();

        selectedAnimationStore.set(animation);
        selectedAnimationKeyframe.set(keyframe);

        transformControlPosition.set({vector: {...keyframe.position}, origin: ChangeOrigin.System});
        transformControlRotation.set({vector: {...keyframe.rotation}, origin: ChangeOrigin.System});
        transformCurve.set(animation.curve);
    }

    /**
     * The selected keyframe, if it is in this track, looked up by id each
     * time: clips and keyframes get replaced (inserting, rippling), and a
     * reference captured at selection time would go stale.
     */
    function selectedKeyframeHere() {
        const selectedAnimation = get(selectedAnimationStore);
        const selectedKeyframe = get(selectedAnimationKeyframe);
        if (!selectedAnimation || !selectedKeyframe) return null;
        const index = track.animations.findIndex((a) => a.id === selectedAnimation.id);
        if (index < 0) return null;
        const animation = track.animations[index];
        const role = animation.startKeyframe.id === selectedKeyframe.id ? "start"
            : animation.endKeyframe.id === selectedKeyframe.id ? "end"
            : null;
        if (!role) return null;
        return {index, animation, role};
    }

    // Edits in the sidebar go into the selected keyframe, and into the
    // neighbouring clip's touching keyframe so the two stay joined.
    onMount(() => {
        const writeVector = (field: "position" | "rotation", change: TrackableVec3) => {
            if (change.origin !== ChangeOrigin.User) return;
            if (get(videoController).isPlaying) return;
            const selected = selectedKeyframeHere();
            if (!selected) return;
            const {index, animation, role} = selected;
            const value = {...change.vector};
            if (role === "start") {
                animation.startKeyframe[field] = value;
                const prev = track.animations[index - 1];
                if (prev) prev.endKeyframe[field] = {...value};
            } else {
                animation.endKeyframe[field] = value;
                const next = track.animations[index + 1];
                if (next) next.startKeyframe[field] = {...value};
            }
        };

        const unsubscribePosition = transformControlPosition.subscribe((change) => writeVector("position", change));
        const unsubscribeRotation = transformControlRotation.subscribe((change) => writeVector("rotation", change));
        const unsubscribeCurve = transformCurve.subscribe((curve: AnimationCurve) => {
            if (get(videoController).isPlaying) return;
            const selected = selectedKeyframeHere();
            if (selected && selected.animation.curve !== curve) selected.animation.curve = curve;
        });

        return () => {
            unsubscribePosition();
            unsubscribeRotation();
            unsubscribeCurve();
            window.removeEventListener("mousemove", onDrag);
            window.removeEventListener("mouseup", stopDrag);
        };
    });

    function downloadAnimation(anim: Animation, e: Event) {
        const blob = new Blob([JSON.stringify(anim, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${anim.name || "animation"}.json`;
        a.click();
        // Revoking straight away can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }

    async function copyAnimationJson(anim: Animation, e: Event) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(anim, null, 2));
            toast.success("Animation JSON copied to clipboard");
        } catch (err) {
            console.error("Failed to copy JSON", err);
            toast.error("Failed to copy animation JSON");
        }
    }

    function deleteAnimation(anim: Animation, e: Event) {
        const del = confirm("Delete this animation?");
        if (del) {
            if (get(selectedAnimationStore)?.id === anim.id) {
                selectedAnimationStore.set(null);
                selectedAnimationKeyframe.set(null);
            }
            track.animations = track.animations.filter((a) => a.id !== anim.id);
            get(videoController).refreshPose();
        }
    }
</script>

<div
        class="relative h-10 bg-card dark:border-gray-700 rounded-md transition-colors track"
        class:dragging={isDragging}
>
    {#if isDragging}
        <!-- Overlay swallows hover so underlying elements don't flicker -->
        <div class="drag-overlay" onmouseup={stopDrag}></div>
    {/if}
    {#each track.animations as anim (anim.id)}
        <div
                class="absolute top-0 h-full"
                style={`left:${leftFor(anim.start)}px;width:${widthFor(anim)}px;`}
        >
            <ContextMenu.Root>
                <ContextMenu.Trigger class="w-full h-full absolute top-0">
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- TODO: Instead of using a min-w here we should figure out a way to have small width animations.
                        My suggestion is to reduce the height of the controls for the animation and place it at the top
                        Showing only the length of the animation on the track.
                     -->
                    <div
                            role="button"
                            class="overflow-hidden h-full w-full
                   flex items-stretch bg-emerald-700 hover:bg-emerald-500/75
                   border rounded-md transition-colors min-w-[70px] animation"
                    >
                        <div
                                role="button"
                                tabindex="0"
                                aria-label="Click and drag to extend"
                                class="marked-area-left w-2 cursor-ew-resize"
                                onmousedown={(e) => startDrag(e, anim.id, "resize-left")}
                        ></div>

                        <button
                                class="w-6 h-full flex items-center justify-center"
                                aria-label="Set start keyframe"
                                title="Set start keyframe"
                                onclick={(e) => toggleKeyframe(e, anim.id, 0)}
                        >
                            <span
                                    class="w-4 h-4 rounded-full transition-colors duration-100 ring-1"
                                    class:bg-white={$selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.startKeyframe.id}
                                    class:ring-white={$selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.startKeyframe.id}
                                    class:bg-emerald-600={!($selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.startKeyframe.id)}
                                    class:active:bg-emerald-600={!($selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.startKeyframe.id)}
                            ></span>
                        </button>

                        <div
                                tabindex="0"
                                aria-label="Click and drag to move"
                                role="button"
                                class="flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing select-none text-xs text-surface-100 overflow-hidden"
                                onmousedown={(e) => startDrag(e, anim.id, "move")}
                        >
                            <span class="whitespace-nowrap truncate px-1">{anim.name}</span>
                        </div>

                        <button
                                class="w-6 h-full flex items-center justify-center"
                                aria-label="Set end keyframe"
                                title="Set end keyframe"
                                onclick={(e) => toggleKeyframe(e, anim.id, 1)}
                        >
                            <span
                                    class="w-4 h-4 rounded-full transition-colors duration-100 ring-1 "
                                    class:bg-white={$selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.endKeyframe.id}
                                    class:ring-white={$selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.endKeyframe.id}
                                    class:bg-emerald-600={!($selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.endKeyframe.id)}
                                    class:active:bg-emerald-600={!($selectedAnimationStore?.id === anim.id && $selectedAnimationKeyframe?.id === anim.endKeyframe.id)}
                            ></span>
                        </button>

                        <div
                                tabindex="0"
                                aria-label="Click and drag to extend"
                                role="button"
                                class="marked-area-right w-2 cursor-ew-resize transition-colors"
                                onmousedown={(e) => startDrag(e, anim.id, "resize-right")}
                        ></div>
                    </div>
                </ContextMenu.Trigger>
                <!-- TODO: Fix an issue if the padding is removed then it auto selects whatever is under the mouse when opened -->
                <ContextMenu.Content
                        class="border-muted px-2 rounded-xl border outline-none focus-visible:outline-none"
                >
                    <ContextMenu.Item
                            onSelect={(e) => copyAnimationJson(anim, e)}
                    >
                        Copy JSON
                    </ContextMenu.Item>
                    <ContextMenu.Item
                            onSelect={(e) => downloadAnimation(anim, e)}
                    >
                        Download animation
                    </ContextMenu.Item>
                    <ContextMenu.Separator>
                    </ContextMenu.Separator>
                    <ContextMenu.Item
                            class="data-highlighted:bg-red-600 data-highlighted:text-white"
                            onSelect={(e) => deleteAnimation(anim, e) }
                    >
                        Delete
                    </ContextMenu.Item>
                </ContextMenu.Content>
            </ContextMenu.Root>
        </div>
    {/each}
</div>

<style>
    :root {
        --stripe-a: 0.30;
        --stripe-b: 0.10;
        --stripe-a-hover: 0.40;
        --stripe-b-hover: 0.18;
        --stripe-size: 4px;
    }

    .marked-area-left {
        background: repeating-linear-gradient(
                225deg,
                rgba(255, 255, 255, var(--stripe-a)) 0px,
                rgba(255, 255, 255, var(--stripe-a)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) var(--stripe-size)
        );
        will-change: background;
        transition: filter 150ms ease-out, opacity 150ms ease-out;
        --stripe-angle: 315deg;
    }

    .marked-area-right {
        background: repeating-linear-gradient(
                135deg,
                rgba(255, 255, 255, var(--stripe-a)) 0px,
                rgba(255, 255, 255, var(--stripe-a)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) var(--stripe-size)
        );
        will-change: background;
        transition: filter 150ms ease-out, opacity 150ms ease-out;
        --stripe-angle: 135deg;
    }

    .marked-area-left:hover,
    .marked-area-right:hover {
        background: repeating-linear-gradient(
                var(--stripe-angle, 135deg),
                rgba(255, 255, 255, var(--stripe-a-hover)) 0px,
                rgba(255, 255, 255, var(--stripe-a-hover)) 2px,
                rgba(255, 255, 255, var(--stripe-b-hover)) 2px,
                rgba(255, 255, 255, var(--stripe-b-hover)) var(--stripe-size)
        );
        filter: brightness(1.03);
    }

    .marked-area-left:active,
    .marked-area-right:active {
        filter: brightness(0.95);
    }

    /* Overlay to capture pointer during drag and prevent hover flicker */
    .drag-overlay {
        position: fixed;
        inset: 0;
        pointer-events: auto;
        cursor: grabbing;
        background: transparent;
        z-index: 9999;
    }

    /* While dragging: disable transitions/hover color swaps to avoid blinks */
    .track.dragging * {
        transition: none !important;
    }
    .track.dragging {
        cursor: grabbing;
        user-select: none;
    }
    /* Lock base background during drag so hover doesn't swap colors */
    .track.dragging .animation,
    .track.dragging .animation:hover {
        background: rgb(4 120 87); /* tailwind emerald-700 */
    }
    /* Keep non-hover stripes to avoid repaint flicker */
    .track.dragging .marked-area-left:hover,
    .track.dragging .marked-area-right:hover {
        filter: none;
        background: repeating-linear-gradient(
                var(--stripe-angle, 135deg),
                rgba(255, 255, 255, var(--stripe-a)) 0px,
                rgba(255, 255, 255, var(--stripe-a)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) 2px,
                rgba(255, 255, 255, var(--stripe-b)) var(--stripe-size)
        );
    }
</style>