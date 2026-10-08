<script lang="ts">
    import {Button} from "$lib/components/ui/button";
    import {Input} from "$lib/components/ui/input";
    import {Badge} from "$lib/components/ui/badge";
    import {
        type AnimationGroup,
        AnimationCategories,
    } from "$lib/components/mock-video/Animation";
    import animationGroups from "$lib/animations/animations.svelte";
    import AnimationGroupPreview from "$lib/components/mock-video/AnimationGroupPreview.svelte";

    // Local UI state (no query params)
    let search = $state("");
    let selectedCats = $state<Set<AnimationCategories>>(new Set());

    const allCategories = [...new Set(animationGroups.flatMap(group => group.categories ?? []))];

    // Pre-sort by priority (desc), official first; use slice().sort for compatibility
    const sorted: AnimationGroup[] = (animationGroups ?? [])
        .slice()
        .sort((a, b) => {
            const o = Number(!!b.isOfficial) - Number(!!a.isOfficial);
            if (o) return o;
            return (b.priority ?? 0) - (a.priority ?? 0);
        });

    function toggleCat(cat: AnimationCategories) {
        const next = new Set(selectedCats);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        selectedCats = next; // reassign so Svelte 5 detects change
    }

    function clearFilters() {
        selectedCats = new Set();
        search = "";
    }

    // Safe, reactive filtering
    const filtered = $derived.by(() => {
        const q = search.trim().toLowerCase();
        const hasCats = selectedCats.size > 0;

        return sorted.filter((g) => {
            // text filter (name or categories)
            const matchesText =
                !q ||
                g.name.toLowerCase().includes(q) ||
                ((g.categories ?? []).some((c) =>
                    String(c).toLowerCase().includes(q)
                ));

            // category filter (only if any selected)
            const matchesCats =
                !hasCats ||
                (g.categories ?? []).some((c) => selectedCats.has(c as AnimationCategories));

            return matchesText && matchesCats;
        });
    });
</script>

<svelte:head>
    <title>Browse animations — PhoneMockup.app</title>
    <meta
            name="description"
            content="Browse all premade animation groups. Filter by category, search by name, and start creating."
    />
</svelte:head>

<div class="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-8">
    <header class="text-center space-y-3">
        <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">
            Browse animations
        </h1>
        <p class="text-muted-foreground">
            Pick a premade animation. Tweak timing, curves, and layers to fit your scene.
        </p>
    </header>

    <!-- Controls -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-2 flex-wrap">
            {#each allCategories as cat}
                <button
                        type="button"
                        class="rounded-full border px-3 py-1 text-sm transition
                 hover:bg-accent hover:text-accent-foreground
                 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                        data-active={selectedCats.has(cat)}
                        aria-pressed={selectedCats.has(cat)}
                        onclick={() => toggleCat(cat)}
                        title={cat}
                >
                    {cat}
                </button>
            {/each}
            {#if selectedCats.size > 0 || search}
                <Button variant="ghost" size="sm" class="text-xs" onclick={clearFilters}>
                    Clear
                </Button>
            {/if}
        </div>

        <div class="w-full md:w-80">
            <Input
                    placeholder="Search animations"
                    bind:value={search}
                    class="w-full"
                    aria-label="Search animations"
            />
        </div>
    </div>

    <!-- Stats -->
    <div class="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
        {#if selectedCats.size > 0}
            · filtered by
            {#each Array.from(selectedCats) as c}
                <Badge variant="secondary" class="mx-1">{c}</Badge>
            {/each}
        {/if}
        {#if search} · “{search}”{/if}
    </div>

    <!-- Grid -->
    {#if filtered.length > 0}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each filtered as group (group.id)}
                <a
                        href={`/platform/animation/${encodeURIComponent(group.id)}`}
                        class=""
                        title={(group.categories?.join(", ")) || group.name}
                >
                    <AnimationGroupPreview animationGroup={group}/>
                </a>
            {/each}
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center py-20 text-center gap-3">
            <p class="text-muted-foreground">No animations match your filters.</p>
            <Button variant="outline" onclick={clearFilters}>Reset filters</Button>
        </div>
    {/if}

    <!-- Bottom CTA -->
    <div class="flex justify-center pt-4">
        <a href="/platform/animation/still" class="inline-flex">
            <Button size="lg" class="h-11 px-6 text-base">Start creating</Button>
        </a>
    </div>
</div>