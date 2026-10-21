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
    /** Whether the field was typed in since it got focus. */
    let typed = false;
    let committedValue = $state<number>(value);
    // iPhone's decimal keypad has no minus key, so a field that takes
    // negative numbers asks for the full keyboard (its number row has one).

    /** The value as shown; a damaged save can hold null instead of a number. */
    const format = (v: number) => (Number.isFinite(v) ? v.toFixed(precision) : "");
    let inputText = $state<string>(format(value));

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
        scrubTo(snap(startVal + delta));
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
        // Only a focused field scrubs with the wheel. Otherwise the wheel
        // scrolls the panel, rather than quietly moving the phone or the
        // selected keyframe as the pointer passes over the field.
        if (!wheel || disabled || !isFocused) return;
        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        let mult = 1;
        if (e.shiftKey) mult = 10;
        else if (e.altKey || e.ctrlKey) mult = 0.1;
        scrubTo(snap(value - dir * step * mult));
    }

    function syncDisplayFromValue() {
        inputText = format(value);
        if (inputElement) inputElement.value = inputText;
    }

    $effect(() => {
        if (!isFocused) {
            // Only push formatted value to the input when not focused
            syncDisplayFromValue();
        }
    });

    function setVal(v: number) {
        const next = roundTo(clamp(v), precision);
        // Rounding a huge number can overflow; keep the last good value.
        if (!Number.isFinite(next)) {
            syncDisplayFromValue();
            return;
        }
        value = next;
        if (!isFocused) syncDisplayFromValue();
    }

    /**
     * A wheel or drag change. It replaces whatever the field showed, even
     * while it has focus, so the text never trails the phone and Enter or
     * leaving the field doesn't put the old number back.
     */
    function scrubTo(v: number) {
        const next = roundTo(clamp(v), precision);
        if (Number.isFinite(next)) value = next;
        typed = false;
        syncDisplayFromValue();
    }

    function onFocus() {
        isFocused = true;
        typed = false;
        committedValue = value;
        // Show raw current text; do not reformat
    }

    function onBlur() {
        isFocused = false;
        // Finalize what was typed: snap/round/clamp and format. Tabbing
        // through a field changes nothing, so it must not rewrite the value.
        if (typed) setVal(snap(value));
        committedValue = value;
        syncDisplayFromValue();
    }

    /** A comma is a decimal point too: iOS keypads in Norwegian only offer ",". */
    function parse(raw: string): number {
        return Number(raw.trim().replace(",", "."));
    }

    function onInput(e: Event) {
        get(videoController).pause();
        const t = e.target as HTMLInputElement;
        const raw = t.value;
        inputText = raw; // keep what the user typed
        typed = true;

        // Allow transient states like "-", ".", "-.", "," and "-,"
        const transient = /^-?[.,]?$/.test(raw);
        if (transient) return;

        const v = parse(raw);
        if (Number.isFinite(v)) {
            // Update the numeric model, but DO NOT reformat the field while focused
            value = clamp(v);
        }
        // If not finite, do nothing; user can keep editing
    }

    function onKeyDown(e: KeyboardEvent) {
        if (disabled) return;

        if (e.key === "Enter") {
            if (!typed) {
                // Nothing typed (perhaps scrubbed): what's shown is the value.
                committedValue = value;
                e.preventDefault();
                return;
            }
            const v = parse(inputText);
            if (Number.isFinite(v)) {
                setVal(snap(v));
                committedValue = value; // update snapshot on commit
                typed = false;
                syncDisplayFromValue();
            } else {
                // revert to snapshot
                value = committedValue;
                typed = false;
                syncDisplayFromValue();
            }
            e.preventDefault();
            return;
        } else if (e.key === "Escape") {
            // revert to snapshot; leaving the field then changes nothing
            value = committedValue;
            typed = false;
            syncDisplayFromValue();
            e.preventDefault();
            return;
        }
    }
</script>

<div
        class="relative select-none flex flex-col items-center gap-1 w-full"
        onwheel={onWheel}
        aria-label={label}
        role="spinbutton"
        aria-valuemin={minAttr}
        aria-valuemax={maxAttr}
        aria-valuenow={value}
        aria-valuetext={`${format(value)}${units ? " " + units : ""}`}
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
                inputmode={min < 0 ? "text" : "decimal"}
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
                class="w-full h-6 flex items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase cursor-ew-resize select-none touch-pan-y hover:bg-muted/80 active:bg-muted/60 transition-colors"
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
            {format(value)}{units}
        </div>
    {/if}
</div>