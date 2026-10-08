<script lang="ts">
  import type { AnimationGroup } from "$lib/components/mock-video/Animation";
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";
  let { animationGroup }: { animationGroup: AnimationGroup | null } = $props();
  const duration = $derived(
    animationGroup
      ? Math.max(...animationGroup.animations.map((a) => a.end))
      : 0,
  );
</script>

{#if animationGroup}
  <div class="preset-preview">
    <div class="media">
      {#if animationGroup.preview}
        <MotionPreview
          src={`/previews/${animationGroup.preview}`}
          poster={animationGroup.poster
            ? `/previews/${animationGroup.poster}`
            : undefined}
          label={animationGroup.name}
          controls={false}
        />
      {/if}
    </div>
    <div class="caption">
      <strong>{animationGroup.name}</strong><span>{duration.toFixed(1)}s</span>
    </div>
    {#if animationGroup.description}<p>{animationGroup.description}</p>{/if}
    {#if animationGroup.screenCut}<p>
        <strong
          >Screen switch · {animationGroup.screenCut.at.toFixed(2)}s</strong
        >
      </p>{/if}
  </div>
{:else}
  <div class="preset-preview empty">Your next move.</div>
{/if}

<style>
  .preset-preview {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #dddcd5;
    border-radius: 16px;
    background: #f8f8f2;
    color: #20281f;
    text-align: left;
  }
  .media {
    aspect-ratio: 4/5;
    overflow: hidden;
    background: #e4e9df;
  }
  .caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 4px;
    font-size: 14px;
  }
  .caption span {
    color: #717a70;
    font-size: 11px;
    white-space: nowrap;
  }
  p {
    padding: 0 16px 16px;
    font-size: 12px;
    line-height: 1.5;
    color: #697166;
  }
  .empty {
    min-height: 240px;
    display: grid;
    place-items: center;
    color: #72796e;
  }
</style>
