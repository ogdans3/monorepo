<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";
  import { Search, ArrowUpRight, Plus, Pause, Play } from "@lucide/svelte";
  import animationGroups from "$lib/animations/animations.svelte";
  import type { AnimationGroup } from "$lib/components/mock-video/Animation";
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";
  let {
    onchoose,
    compact = false,
    persistFilters = false,
  }: {
    onchoose?: (group: AnimationGroup) => void;
    compact?: boolean;
    persistFilters?: boolean;
  } = $props();
  let search = $state("");
  let category = $state("All");
  let paused = $state(false);
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
  const groups = [...animationGroups].sort((a, b) => b.priority - a.priority);
  const categories = [
    "All",
    "Zoom",
    "Spin",
    "Flip",
    "Cinematic",
    "Reveal",
    "Detail",
    "Loop",
    "Screen switch",
  ];
  $effect(() => {
    if (persistFilters) {
      // Shallow routing retains the original page.url for back navigation.
      // Keep the filters in that history entry as well as the visible URL.
      const saved = (
        page.state as {
          motionLibrary?: { query: string; category: string };
        }
      ).motionLibrary;
      search = saved?.query ?? page.url.searchParams.get("q") ?? "";
      const requested =
        saved?.category ?? page.url.searchParams.get("category") ?? "All";
      category = categories.includes(requested) ? requested : "All";
    }
  });
  function updateFilters(q: string, cat: string) {
    search = q;
    category = cat;
    if (persistFilters) {
      const url = new URL(page.url);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      if (cat !== "All") url.searchParams.set("category", cat);
      else url.searchParams.delete("category");
      replaceState(url, {
        ...page.state,
        motionLibrary: { query: q, category: cat },
      });
    }
  }
  const filtered = $derived(
    groups.filter((group) => {
      const text =
        `${group.name} ${group.description ?? ""} ${group.categories?.join(" ") ?? ""}`.toLowerCase();
      const matchesCategory =
        category === "All" ||
        (category === "Screen switch"
          ? !!group.screenCut
          : category === "Loop"
            ? !!group.loop
            : group.categories?.some((c) => c === category));
      return text.includes(search.trim().toLowerCase()) && matchesCategory;
    }),
  );
  const duration = (group: AnimationGroup) =>
    Math.max(0, ...group.animations.map((a) => a.end));
</script>

<section class="motion-library" class:compact aria-label="Animation library">
  <div class="motion-toolbar">
    <label class="motion-search"
      ><Search size={17} aria-hidden="true" /><span class="sr-only"
        >Search animations</span
      ><input
        type="search"
        disabled={!ready}
        placeholder="Search animations"
        value={search}
        oninput={(e) => updateFilters(e.currentTarget.value, category)}
      /></label
    >
    <button
      type="button"
      class="motion-pause"
      disabled={!ready}
      onclick={() => (paused = !paused)}
      aria-pressed={paused}
      aria-label={paused ? "Play previews" : "Pause previews"}
      >{#if paused}<Play size={14} />{:else}<Pause size={14} />{/if}<span
        >{paused ? "Play previews" : "Pause previews"}</span
      ></button
    >
  </div>
  <div class="motion-filters" aria-label="Filter animations">
    {#each categories as cat}<button
        type="button"
        disabled={!ready}
        aria-pressed={category === cat}
        onclick={() => updateFilters(search, cat)}>{cat}</button
      >{/each}
  </div>
  <div class="motion-summary">
    <span role="status" aria-live="polite"
      >{filtered.length}
      {filtered.length === 1 ? "animation" : "animations"}</span
    ><span
      >{onchoose ? "Add to your timeline" : "Every move is yours to edit"}</span
    >
  </div>
  <div class="motion-results">
    {#if filtered.length}
      <div class="motion-grid">
        {#each filtered as group (group.id)}
          <article class="motion-card" data-motion-id={group.id}>
            <div
              class="motion-media"
              style:background={`rgba(${(group.previewBackground ?? [235, 234, 227, 1]).join(",")})`}
            >
              {#if group.preview}<MotionPreview
                  src={`/previews/${group.preview}`}
                  poster={group.poster
                    ? `/previews/${group.poster}`
                    : undefined}
                  label={group.name}
                  {paused}
                />{/if}
              <span class="motion-duration">{duration(group).toFixed(1)}s</span>
            </div>
            {#if onchoose}<button
                type="button"
                class="motion-choice studio-motion-card"
                onclick={() => onchoose?.(group)}
                aria-label={`Add ${group.name}`}
                ><strong>{group.name}</strong><Plus
                  size={18}
                  aria-hidden="true"
                /></button
              >
            {:else}<a
                class="motion-choice"
                href={`/platform/animation/${encodeURIComponent(group.id)}`}
                aria-label={`Use ${group.name}`}
                ><strong>{group.name}</strong><ArrowUpRight
                  size={18}
                  aria-hidden="true"
                /></a
              >{/if}
            <p>{group.description}</p>
            {#if group.screenCut}<span class="motion-cut"
                >Screen switch at {group.screenCut.at.toFixed(2)}s</span
              >{/if}
          </article>
        {/each}
      </div>
    {:else}<div class="motion-empty">
        <h3>No matching motions.</h3>
        <p>Try another name or start with all animations.</p>
        <button type="button" onclick={() => updateFilters("", "All")}
          >Clear filters <span aria-hidden="true">↗</span></button
        >
      </div>{/if}
  </div>
</section>

<style>
  .motion-library {
    min-width: 0;
  }
  .motion-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    padding: 20px 0;
    border-top: 1px solid var(--border, #deded6);
  }
  .motion-search {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(340px, 100%);
    padding: 0 14px;
    min-height: 46px;
    border: 1px solid var(--input, #d9d9d1);
    border-radius: 5px;
    background: #fffefa;
  }
  .motion-search:focus-within {
    outline: 2px solid #a3442c;
    outline-offset: 2px;
  }
  input {
    width: 100%;
    min-width: 0;
    font-size: 14px;
    background: transparent;
    border: 0;
    outline: 0 !important;
  }
  .motion-pause {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 8px;
    font-size: 12px;
    white-space: nowrap;
  }
  button {
    cursor: pointer;
  }
  .motion-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--border, #deded6);
  }
  .motion-filters button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #64645b;
    font-size: 13px;
    transition: background-color 150ms ease;
  }
  .motion-filters button[aria-pressed="true"] {
    background: #e9e3da;
    color: #733922;
    border-color: #d8c6b7;
  }
  .motion-summary {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin: 20px 0;
    font-size: 12px;
    color: #6d6d63;
    font-variant-numeric: tabular-nums;
  }
  .motion-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 34px 24px;
  }
  .motion-card {
    min-width: 0;
  }
  .motion-media {
    aspect-ratio: 6/5;
    position: relative;
    border-radius: 5px;
    overflow: hidden;
  }
  .motion-media :global(video) {
    object-fit: contain;
  }
  .motion-duration {
    position: absolute;
    top: 12px;
    left: 12px;
    font-size: 11px;
    padding: 4px 7px;
    background: #fffefaeb;
    color: #36362e;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .motion-choice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    width: 100%;
    text-align: left;
  }
  .motion-choice strong {
    font-size: 17px;
    letter-spacing: -0.025em;
    font-weight: 500;
  }
  .motion-choice :global(svg) {
    color: #a3442c;
    flex-shrink: 0;
  }
  .motion-card p {
    color: #6d6d63;
    font-size: 12px;
    line-height: 1.6;
    margin-top: -2px;
  }
  .motion-cut {
    display: block;
    margin-top: 10px;
    font-size: 11px;
    color: #91402b;
  }
  .motion-empty {
    text-align: center;
    padding: 60px 20px;
  }
  .motion-empty h3 {
    font-size: 24px;
    letter-spacing: -0.03em;
  }
  .motion-empty p {
    margin: 12px 0 22px;
    color: #6d6d63;
    font-size: 14px;
  }
  .motion-empty button {
    min-height: 44px;
    padding: 0 16px;
    background: #a3442c;
    color: #fffefa;
    border-radius: 5px;
    font-size: 13px;
  }
  .compact {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .compact .motion-toolbar {
    padding: 0 0 14px;
    border-top: 0;
  }
  .compact .motion-results {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px;
    scrollbar-gutter: stable;
  }
  .compact .motion-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px 18px;
  }
  .compact .motion-summary {
    margin: 12px 0;
  }
  .compact .motion-filters {
    padding-bottom: 12px;
  }
  @media (hover: hover) and (pointer: fine) {
    .motion-choice:hover {
      color: #a3442c;
    }
    .motion-pause:hover,
    .motion-filters button:hover {
      background: #efeee7;
    }
  }
  @media (max-width: 1050px) {
    .motion-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 30px 20px;
    }
  }
  @media (max-width: 760px) {
    .motion-grid,
    .compact .motion-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 26px 16px;
    }
    .motion-toolbar {
      flex-wrap: wrap;
      gap: 8px;
    }
    .motion-search {
      width: 100%;
    }
    .motion-pause {
      margin-left: auto;
    }
    .motion-summary {
      font-size: 11px;
    }
    .motion-filters {
      gap: 4px;
    }
    .motion-filters button {
      padding-inline: 12px;
      font-size: 12px;
    }
    .motion-choice strong {
      font-size: 15px;
    }
    .motion-media {
      aspect-ratio: 4/5;
    }
    input {
      font-size: 16px;
    }
    .compact .motion-filters {
      flex-wrap: nowrap;
      overflow-x: auto;
      flex-shrink: 0;
      padding: 3px 2px 8px;
    }
    .compact .motion-filters button {
      flex-shrink: 0;
    }
    .compact .motion-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .compact .motion-pause {
      width: 44px;
    }
    .compact .motion-pause span {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .motion-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 44px;
      gap: 8px;
      padding-block: 12px;
    }
    .motion-pause {
      width: 44px;
    }
    .motion-pause span {
      display: none;
    }
    .motion-filters {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding: 3px 2px 10px;
    }
    .motion-filters button {
      flex-shrink: 0;
    }
    .motion-summary {
      margin-block: 14px;
    }
  }
</style>
