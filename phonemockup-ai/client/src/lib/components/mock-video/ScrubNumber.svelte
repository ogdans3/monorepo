<script lang="ts">
    import {get} from "svelte/store";
    import {videoController} from "$lib/stores/video.svelte";
    import {Input} from "$lib/components/ui/input";
    import {Label} from "$lib/components/ui/label";

    let {
        value = $bindable(0),
        min = Number.NEGATIVE_INFINITY,
        max = Number.POSITIVE_INFINITY,
        step = 0.01,
        precision = 2,
        pixelsPerStep = 8,
        label = "",
        units = "",
        disabled = false,
        wheel = true,
        id = `scrub-${Math.random().toString(36).slice(2)}`
    } = $props();

    let dragging = $state(false);
    let startX = $state(0);
    let startVal = $state(0);
    let inputElement: HTMLInputElement | null = $state(null);
    let isFocused = $state(false);
    let committedValue = $state<number>(value);
    let inputText = $state<string>(String(value.toFixed(precision)));

    const minAttr = $derived(Number.isFinite(min) ? min : undefined);
    const maxAttr = $derived(Number.isFinite(max) ? max : undefined);

    function clamp(v: number) {
        return Math.min(max, Math.max(min, v));
    }

    function roundTo(v: number, p: number) {
        const f = Math.pow(10, p);
        return Math.round(v * f) / f;
    };
    const snap = (v: number) => {
        if (!Number.isFinite(step) || step <= 0) return v;
        return Math.round(v / step) * step;
    };

    $effect(() => {
        if (inputElement) {
            inputElement.value = value.toFixed(precision);
        }
    });

    function onPointerDown(e: PointerEvent) {
        if (disabled || e.button !== 0) return;
        get(videoController).pause();
        dragging = true;
        startX = e.clientX;
        startVal = value ?? 0;
        (e.target as HTMLElement)?.setPointerCapture(e.pointerId);
        document.body.style.cursor = "ew-resize";
        e.preventDefault();
    }

    function onPointerMove(e: PointerEvent) {
        if (!dragging) return;
        committedValue = value;
        const dx = e.clientX - startX;
        let mult = 10;
        if (e.shiftKey) mult = 1;
        else if (e.altKey || e.ctrlKey) mult = 0.1;
        const delta = (dx / pixelsPerStep) * step * mult;
        setVal(snap(startVal + delta));
    }

    function endDrag(e: PointerEvent) {
        if (!dragging) return;
        dragging = false;
        try {
            (e.target as HTMLElement)?.releasePointerCapture(e.pointerId);
        } catch {
        }
        committedValue = value;
        document.body.style.cursor = "";
    }

    function onWheel(e: WheelEvent) {
        if (!wheel || disabled) return;
        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        let mult = 1;
        if (e.shiftKey) mult = 10;
        else if (e.altKey || e.ctrlKey) mult = 0.1;
        setVal(snap(value - dir * step * mult));
    }

    function syncDisplayFromValue() {
        inputText = value.toFixed(precision);
        if (inputElement) inputElement.value = inputText;
    }

    $effect(() => {
        if (!isFocused) {
            // Only push formatted value to the input when not focused
            syncDisplayFromValue();
        }
    });

    function setVal(v: number) {
        value = roundTo(clamp(v), precision);
        if (!isFocused) syncDisplayFromValue();
    }

    function onFocus() {
        isFocused = true;
        committedValue = value;
        // Show raw current text; do not reformat
    }

    function onBlur() {
        isFocused = false;
        committedValue = value;
        // Finalize: snap/round/clamp and format
        setVal(snap(value));
        syncDisplayFromValue();
    }

    function onInput(e: Event) {
        get(videoController).pause();
        const t = e.target as HTMLInputElement;
        const raw = t.value;
        inputText = raw; // keep what the user typed

        // Allow transient states like "-", ".", "-."
        const transient = raw === "" || raw === "-" || raw === "." || raw === "-.";
        if (transient) return;

        const v = Number(raw);
        if (Number.isFinite(v)) {
            // Update the numeric model, but DO NOT reformat the field while focused
            value = clamp(v);
        }
        // If not finite, do nothing; user can keep editing
    }

    function onKeyDown(e: KeyboardEvent) {
        if (disabled) return;

        if (e.key === "Enter") {
            const v = Number(inputText);
            if (Number.isFinite(v)) {
                setVal(snap(v));
                committedValue = value; // update snapshot on commit
            } else {
                // revert to snapshot
                value = committedValue;
                syncDisplayFromValue();
            }
            e.preventDefault();
            return;
        } else if (e.key === "Escape") {
            // revert to snapshot
            value = committedValue;
            syncDisplayFromValue();
            e.preventDefault();
            return;
        }
    }
</script>

<div
        class="relative select-none touch-none flex flex-col items-center gap-1 w-full"
        onwheel={(e) => {
    e.preventDefault();
    onWheel(e);
  }}
        aria-label={label}
        role="spinbutton"
        aria-valuemin={minAttr}
        aria-valuemax={maxAttr}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(precision)}${units ? " " + units : ""}`}
        aria-disabled={disabled}
>
    {#if label}
        <Label for={id} class="sr-only">{label}</Label>
    {/if}

    <div class="relative w-full">
        <Input
                bind:ref={inputElement}
                id={id}
                type="text"
                inputmode="decimal"
                class="removeInner w-full text-right tabular-nums appearance-none"
                min={minAttr}
                max={maxAttr}
                step={step}
                disabled={disabled}
                oninput={onInput}
                onblur={onBlur}
                onfocus={onFocus}
                onkeydown={onKeyDown}
                style="caret-color: var(--primary);"
                value={inputText}
        />
    </div>

    {#if label}
        <div
                class="w-full h-6 flex items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase cursor-ew-resize select-none hover:bg-muted/80 active:bg-muted/60 transition-colors"
                onpointerdown={onPointerDown}
                onpointermove={onPointerMove}
                onpointerup={endDrag}
                onpointercancel={endDrag}
                title={`${label} — drag left/right`}
        >
            {label}
        </div>
    {/if}

    {#if dragging}
        <div class="absolute -top-8 right-2.5 px-2 py-1 rounded bg-popover text-popover-foreground text-xs shadow">
            {value.toFixed(precision)}{units}
        </div>
    {/if}
</div>