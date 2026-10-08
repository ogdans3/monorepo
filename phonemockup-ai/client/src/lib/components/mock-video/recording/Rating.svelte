<script lang="ts">
    import {Card, CardContent, CardHeader, CardTitle} from "$lib/components/ui/card";
    import {Label} from "$lib/components/ui/label";
    import {RadioGroup, RadioGroupItem} from "$lib/components/ui/radio-group";
    import {Star} from "@lucide/svelte";

    let rating = "0";
    let hover = 0;

    const toNum = (v: string) => parseInt(v || "0", 10) || 0;
    const isActive = (s: number) => toNum(rating) >= s;
    const isHover = (s: number) => hover >= s && !isActive(s);
    const valueText = (v: number) => (v === 0 ? "No rating" : v === 1 ? "1 star" : `${v} stars`);
</script>

<Card class="gap-2 h-full">
    <CardHeader class="m-0">
        <CardTitle class="text-sm font-medium">Rate this export</CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
        <p id="rating-caption" class="text-xs text-muted-foreground">
            How satisfied are you with the video quality and export speed?
        </p>

        <RadioGroup
                class="flex items-center gap-2 m-0"
                bind:value={rating}
                aria-labelledby="rating-caption"
                aria-valuenow={toNum(rating)}
                aria-valuetext={valueText(toNum(rating))}
        >
            {#each ["1", "2", "3", "4", "5"] as s}
                <div class="flex items-center">
                    <RadioGroupItem
                            id={`rating-${s}`}
                            value={s}
                            class="sr-only"
                            aria-label={`${s} star${s !== "1" ? "s" : ""}`}
                    />
                    <Label
                            for={`rating-${s}`}
                            class="group inline-flex cursor-pointer select-none items-center"
                            onmouseenter={() => (hover = parseInt(s, 10))}
                            onmouseleave={() => (hover = 0)}
                    >
                        <Star
                                class={`h-6 w-6 transition-colors ${
                isActive(parseInt(s, 10))
                  ? "text-yellow-500"
                  : isHover(parseInt(s, 10))
                  ? "text-yellow-500"
                  : "text-muted-foreground/40"
              }`}
                                fill={isActive(parseInt(s, 10)) ? "currentColor" : "none"}
                                stroke="currentColor"
                                stroke-width="2"
                                aria-hidden="true"
                        />
                    </Label>
                </div>
            {/each}
        </RadioGroup>

        {#if toNum(rating) > 0}
            <div class="text-xs text-muted-foreground">
                Thanks! You rated this export {toNum(rating)}/5.
            </div>
        {/if}
    </CardContent>
</Card>