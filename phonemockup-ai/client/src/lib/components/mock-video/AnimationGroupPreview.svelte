<script lang="ts">
    // Presentational card (parent handles outer click/navigation)
    import {
        Card,
        CardHeader,
        CardTitle,
        CardDescription,
        CardContent,
    } from "$lib/components/ui/card";
    import {Badge} from "$lib/components/ui/badge";
    import {Button} from "$lib/components/ui/button";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import {Video, Image as ImageIcon, Star} from "@lucide/svelte";
    import type {AnimationGroup} from "$lib/components/mock-video/Animation";

    type AnimationCategories = "Zoom" | "Slow" | "Fast" | "In" | "Out" | "Fancy";
    let {animationGroup} = $props<{ animationGroup: AnimationGroup | null }>();

    // Build preview URL (served from /previews/* via static/)
    let previewSrc = $derived(
        animationGroup?.preview ? `/previews/${animationGroup.preview}` : null
    );
    const keyframeCount = $derived(animationGroup?.keyframes?.length ?? 0);
    const ext = $derived(animationGroup?.preview?.split(".").pop()?.toLowerCase() ?? "");
    const isVideo = $derived(/^(mp4|webm|mov|m4v)$/i.test(ext));
    const isImage = $derived(/^(png|jpe?g|gif|webp|avif)$/i.test(ext));

    function onToggleFavorite(e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        // emit event in parent; don't mutate props here
    }

    function categoryVariant(cat: AnimationCategories) {
        switch (cat) {
            case "Zoom":
                return "default";
            case "Slow":
                return "secondary";
            case "Fast":
                return "destructive";
            case "Fancy":
                return "green";
            case "In":
            case "Out":
                return "outline";
            case "Fancy":
                return "default";
            default:
                return "secondary";
        }
    }

    // Smooth progress (looping on hover)
    let videoEl: HTMLVideoElement | null = $state(null);
    let duration = $state(0);
    let pct = $state(0);
    let raf = $state(0);

    function setDuration() {
        if (!videoEl) return;
        const d = videoEl.duration;
        duration = Number.isFinite(d) && d > 0 ? d : 0;
    }

    function tick() {
        if (!videoEl) return;
        if (!duration || !Number.isFinite(duration)) setDuration();
        const c = videoEl.currentTime || 0;
        const p = duration > 0 ? (c / duration) * 100 : 0;
        pct = Math.max(0, Math.min(100, p));
        if (!videoEl.paused && !videoEl.ended) {
            raf = requestAnimationFrame(tick);
        }
    }

    function onEnter() {
        if (!videoEl) return;
        videoEl.loop = true; // loop while hovered
        // ensure duration is known
        if (videoEl.readyState >= 1) setDuration();
        videoEl.play().catch(() => {
        });
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    }

    function onLeave() {
        if (!videoEl) return;
        videoEl.pause();
        cancelAnimationFrame(raf);
        videoEl.currentTime = 0;
        pct = 0;
    }

    $effect(() => {
        if (!videoEl) return;
        const onMeta = () => {
            setDuration();
            pct = 0;
        };
        videoEl.addEventListener("loadedmetadata", onMeta);
        if (videoEl.readyState >= 1) onMeta();
        return () => {
            videoEl?.removeEventListener("loadedmetadata", onMeta);
        };
    });
</script>

{#if animationGroup}
    <!-- Small card so many can fit in a row; parent handles outer clicks -->
    <Card class="w-xs overflow-hidden border-border/60 shadow-sm transition hover:shadow-md">
        <CardHeader>
            <CardTitle class="text-left block w-full truncate whitespace-nowrap p-0 m-0"
                       title={animationGroup.name}
            >
                {animationGroup.name}
            </CardTitle>
            <div class="flex justify-between p-3">
                <div class="flex flex-col gap-2">
                    <div class="mt-1 flex items-center justify-between gap-2">
                        <CardDescription class="flex items-center gap-1.5 text-[10px]">
                            {#if previewSrc}
                                {#if isVideo}
                                    <Video class="h-3.5 w-3.5 opacity-70"/>
                                {:else if isImage}
                                    <ImageIcon class="h-3.5 w-3.5 opacity-70"/>
                                {/if}
                                <span class="uppercase opacity-70">{ext || "preview"}</span>
                            {:else}
                                <span class="opacity-70">No preview</span>
                            {/if}
                        </CardDescription>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    {#if animationGroup.isOfficial}
                        <span class="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            Official
                        </span>
                    {:else if animationGroup.isCommunity}
                        <span class="text-[10px] font-medium text-indigo-700 dark:text-indigo-400">
                            Community
                        </span>
                    {:else}
                        <span class="text-[10px] text-muted-foreground">Uncategorized</span>
                    {/if}

                    {#if animationGroup.categories?.length}
                        <div class="flex flex-wrap gap-1">
                            {#each animationGroup.categories as cat (cat)}
                                <Badge variant={categoryVariant(cat)} class="h-5 rounded px-1.5 text-[10px]">
                                    {cat}
                                </Badge>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </CardHeader>

        <CardContent class="p-0">
            <div class="group relative overflow-hidden border-t border-border/50 bg-muted/40">
                {#if previewSrc}
                    {#if isVideo}
                        <video
                                bind:this={videoEl}
                                class="w-full object-cover group-hover:scale-[1.015]"
                                src={previewSrc}
                                preload="metadata"
                                playsinline
                                muted
                                loop
                                onmouseenter={onEnter}
                                onmouseleave={onLeave}
                        ></video>
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                            <div
                                    class="h-full w-full origin-left bg-primary"
                                    style={`transform:scaleX(${pct / 100});`}
                            ></div>
                        </div>
                    {:else if isImage}
                        <img
                                class="w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                                src={previewSrc}
                                alt={`${animationGroup.name} preview`}
                                loading="lazy"
                        />
                    {:else}
                        <div class="p-6 text-center text-xs text-muted-foreground">
                            Unsupported preview type
                        </div>
                    {/if}
                {:else}
                    <div class="p-6 text-center text-xs text-muted-foreground">
                        No preview available
                    </div>
                {/if}
            </div>
            {#if isVideo && previewSrc}
                <div class="flex justify-between py-2">
                    <span class="rounded-md bg-muted px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground/80">
                        {(pct * duration / 100).toFixed(1)}s
                    </span>
                    <span class="rounded-md bg-muted px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground/80">
                        {#if duration}
                            {duration < 10 ? duration.toFixed(1) : Math.round(duration)}s
                        {/if}
                    </span>
                </div>
            {/if}
        </CardContent>
    </Card>
{:else}
    <div class="w-xs">
    </div>
{/if}
