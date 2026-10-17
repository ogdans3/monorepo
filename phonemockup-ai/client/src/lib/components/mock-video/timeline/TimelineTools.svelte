<script lang="ts">
  import { Trash, Dot, Tally5, Magnet, FoldHorizontal } from "@lucide/svelte";
  import { videoController } from "$lib/stores/video.svelte";
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { dev } from "$app/environment";
  import { unfocusElement } from "$lib/components/mock-video/unfocus";
  import { project } from "$lib/stores/project.svelte";

  let {
    snapEnabled = $bindable(),
    createMp4ForAnimations,
    clearTimeline,
    addCenterAnimation,
  } = $props();
  // Tooltip state for magnet hint
  let shouldShowSnapHint = $state(false);
  let snapHintTimer: number | null = null;

  const snapTooltipText = $derived(
    snapEnabled ? "Disable timeline snapping" : "Enable timeline snapping",
  );

  export function showSnapHint() {
    shouldShowSnapHint = true;
    if (snapHintTimer) clearTimeout(snapHintTimer);
    snapHintTimer = window.setTimeout(() => {
      shouldShowSnapHint = false;
      snapHintTimer = null;
    }, 2000);
  }

  onDestroy(() => {
    if (snapHintTimer) clearTimeout(snapHintTimer);
  });

  function snugTimeline() {
    const allTracks = project.tracks ?? [];
    const allAnims = allTracks.flatMap((t) => t.animations ?? []);
    if (allAnims.length === 0) return;

    // Find earliest start and latest end
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const a of allAnims) {
      if (Number.isFinite(a.start) && a.start < minStart) minStart = a.start;
      if (Number.isFinite(a.end) && a.end > maxEnd) maxEnd = a.end;
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return;

    // If already starting at 0, just set timeline end and exit
    const offset = minStart;
    if (offset === 0) {
      const vc = get(videoController);
      vc.startTime.set(0);
      vc.setEndTime(maxEnd);
      return;
    }

    // Shift all animations by -offset
    for (const track of allTracks) {
      if (!track.animations) continue;
      for (const anim of track.animations) {
        if (!Number.isFinite(anim.start) || !Number.isFinite(anim.end))
          continue;
        anim.start = anim.start - offset;
        anim.end = anim.end - offset;
        // Keyframes are already relative to animation start (time=0 at anim.start),
        // so we do NOT change keyframe.time.
      }
    }

    // Recompute new max end after shift
    let newMaxEnd = -Infinity;
    for (const a of allAnims) {
      if (a.end > newMaxEnd) newMaxEnd = a.end;
    }

    get(videoController).setEndTime(newMaxEnd);
  }
</script>

<div class="studio-timeline-tools" role="group" aria-label="Timeline tools">
  <button
    class="studio-tool"
    data-testid="timeline-tool-add-center-animation"
    aria-label="Add animation back to center"
    title="Add animation back to center"
    onclick={() => {
      addCenterAnimation(project.tracks[0].id);
      unfocusElement();
    }}><Dot size={22} /></button
  >
  <button
    class="studio-tool"
    data-testid="timeline-tool-toggle-snapping"
    class:studio-tool-active={snapEnabled}
    aria-pressed={snapEnabled}
    aria-label={snapTooltipText}
    title={snapTooltipText}
    onclick={() => {
      snapEnabled = !snapEnabled;
      unfocusElement();
    }}><Magnet size={16} /></button
  >
  <button
    class="studio-tool"
    data-testid="timeline-tool-snug-timeline"
    aria-label="Fit timeline to animations"
    title="Fit timeline to animations"
    onclick={() => {
      snugTimeline();
      unfocusElement();
    }}><FoldHorizontal size={16} /></button
  >
  {#if dev}<button
      class="studio-tool"
      data-testid="timeline-tool-create-mp4-for-animations"
      aria-label="Render all animation previews"
      title="Render all animation previews"
      onclick={createMp4ForAnimations}><Tally5 size={16} /></button
    >{/if}
  <button
    class="studio-tool studio-tool-delete"
    data-testid="timeline-tool-clear-timeline"
    aria-label="Remove all animations"
    title="Remove all animations"
    onclick={clearTimeline}><Trash size={16} /></button
  >
  {#if shouldShowSnapHint}<span role="status" class="studio-snap-hint"
      >Turn off snapping to move freely.</span
    >{/if}
</div>
