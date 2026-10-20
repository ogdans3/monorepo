<script lang="ts">
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";
  import type { AnimationGroup } from "$lib/components/mock-video/Animation";
  import {
    background,
    deviceOf,
    formatSeconds,
    loopSeconds,
  } from "$lib/guides/motions";

  let {
    motions,
    selected,
    onselect = () => {},
    compact = false,
  }: {
    motions: AnimationGroup[];
    selected: AnimationGroup;
    onselect?: (id: string) => void;
    compact?: boolean;
  } = $props();
</script>

<div class="g-stage" class:compact style:background={background(selected)}>
  <div class="g-stage-label">
    <span>{selected.name} <span class="muted">/ {deviceOf(selected)}</span></span
    ><span class="mono">{formatSeconds(loopSeconds(selected))}s loop</span>
  </div>
  <div class="g-stage-media">
    {#key selected.id}<MotionPreview
        src={`/previews/${selected.preview}`}
        poster={`/previews/${selected.poster}`}
        label={`${selected.name} on the ${deviceOf(selected)}`}
        priority
      />{/key}
  </div>
  <div class="g-stage-bar">
    {#if motions.length > 1}
      <div class="g-selector" role="group" aria-label="Preview a motion">
        {#each motions as motion}<button
            type="button"
            aria-pressed={motion.id === selected.id}
            onclick={() => onselect(motion.id)}>{motion.name}</button
          >{/each}
      </div>
    {:else}
      <p>{selected.description}</p>
    {/if}
  </div>
</div>
