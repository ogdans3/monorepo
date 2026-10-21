<script lang="ts">
    // Ids for the selects' labels: the value shown stays part of the name.
    const uid = $props.id();
    import ScrubNumber from "$lib/components/mock-video/ScrubNumber.svelte";
    import {
        transformControlPosition,
        transformControlRotation,
        transformCurve
    } from "$lib/stores/transform.svelte.js";
    import {selectedAnimationStore} from "$lib/stores/animation.svelte.js";
    import {
        ChangeOrigin,
        vectorsAreEquals,
        zeroVec
    } from "$lib/components/mock-video/Animation";
    import {Button} from "$lib/components/ui/button";
    import {RotateCcw} from "@lucide/svelte";
    import * as Select from "$lib/components/ui/select";
    import {AnimationCurveOptions} from "$lib/utils/curves";
    import {get} from "svelte/store";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";

    const axes: readonly ("x" | "y" | "z")[] = ["x", "y", "z"];
    // Far past any real pose (positions are fractions of the frame, presets
    // turn up to two full turns), but short of where the maths overflows:
    // 1e308 became Infinity, then NaN, and froze the page.
    const POSITION_LIMIT = 1000;
    const ROTATION_LIMIT = 36000;
    const curveTriggerText = $derived($transformCurve || "Select curve");
    const isDisabled = $derived($selectedAnimationStore === null);

    let pos = $state({...$transformControlPosition.vector});
    let rot = $state({...$transformControlRotation.vector});

    // Sync from external store -> local
    $effect(() => {
        const {vector} = $transformControlPosition;
        if (vector && !vectorsAreEquals(vector, pos)) {
            pos = {...vector};
        }
    });
    $effect(() => {
        const {vector} = $transformControlRotation;
        if (vector && !vectorsAreEquals(vector, rot)) {
            rot = {...vector};
        }
    });

    function setPos(axis: "x" | "y" | "z", v: number) {
        pos = {...pos, [axis]: v};
        transformControlPosition.set({
            vector: {...pos},
            origin: ChangeOrigin.User
        });
    }

    function setRot(axis: "x" | "y" | "z", v: number) {
        rot = {...rot, [axis]: v};
        transformControlRotation.set({
            vector: {...rot},
            origin: ChangeOrigin.User
        });
    }

    function resetTransforms() {
        pos = zeroVec();
        rot = zeroVec();
        transformControlPosition.set({
            vector: zeroVec(),
            origin: ChangeOrigin.User
        });
        transformControlRotation.set({
            vector: zeroVec(),
            origin: ChangeOrigin.User
        });
        unfocusElement();
    }
</script>

<section class="px-2 py-2 space-y-3" aria-label="Transform controls">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Transform</h3>
        <Button
                variant="secondary"
                size="sm"
                class="h-7 px-2 gap-1 ml-auto"
                onclick={resetTransforms}
                aria-label="Center model (reset position and rotation)"
                title="Center model"
        >
            <RotateCcw class="h-4 w-4"/>
            <span class="text-xs">Center</span>
        </Button>
    </div>

    <!-- Position -->
    <fieldset class="space-y-1">
        <legend class="text-xs text-muted-foreground">Position</legend>
        <div class="grid grid-cols-3 gap-2">
            {#each axes as axis}
                <ScrubNumber
                        bind:value={
                            () => pos[axis],
                            (v) => setPos(axis, v)
                        }
                        step={0.01}
                        precision={2}
                        min={-POSITION_LIMIT}
                        max={POSITION_LIMIT}
                        pixelsPerStep={8}
                        label={axis}
                />
            {/each}
        </div>
    </fieldset>

    <!-- Rotation -->
    <fieldset class="space-y-1">
        <legend class="text-xs text-muted-foreground">Rotation (deg)</legend>
        <div class="grid grid-cols-3 gap-2">
            {#each axes as axis}
                <ScrubNumber
                        bind:value={
                            () => rot[axis],
                            (v) => setRot(axis, v)
                        }
                        step={0.01}
                        precision={2}
                        min={-ROTATION_LIMIT}
                        max={ROTATION_LIMIT}
                        pixelsPerStep={4}
                        label={axis}
                        units="°"
                />
            {/each}
        </div>
    </fieldset>

    <!-- Curve picker -->
    <!-- A legend inside the row's div doesn't name the fieldset; the id does. -->
    <fieldset
            class="space-y-1"
            class:opacity-60={isDisabled}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            aria-labelledby={`${uid}-curve-legend`}
    >
        <div class="flex items-center justify-between">
            <span id={`${uid}-curve-legend`} class="text-xs text-muted-foreground m-0">Animation curve</span>
            {#if isDisabled}
                <span class="text-[11px] text-muted-foreground">Select a keyframe</span>
            {/if}
        </div>

        <span id={`${uid}-curve-label`} class="sr-only">Select animation curve</span>
        <Select.Root type="single" name="animationCurve" bind:value={$transformCurve} onValueChange={unfocusElement}>
            <Select.Trigger
                    class="h-8 w-full rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                    id={`${uid}-curve`}
                    aria-labelledby={`${uid}-curve-label ${uid}-curve-value`}
                    disabled={isDisabled}
            >
                <span id={`${uid}-curve-value`}>{curveTriggerText}</span>
            </Select.Trigger>

            {#if !isDisabled}
                <Select.Content aria-label="Animation curves" class="min-w-[14rem]">
                    <Select.Group>
                        <Select.Label class="px-2 py-1 text-xs text-muted-foreground">
                            Curves
                        </Select.Label>
                        {#each AnimationCurveOptions as opt (opt.value)}
                            <Select.Item
                                    value={opt.value}
                                    label={opt.label}
                                    class="text-sm px-2 py-1.5"
                            >
                                {opt.label}
                            </Select.Item>
                        {/each}
                    </Select.Group>
                </Select.Content>
            {/if}
        </Select.Root>
    </fieldset>
</section>