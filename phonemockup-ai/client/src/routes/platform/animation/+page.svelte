<script lang="ts">
  import { ArrowUpRight } from "@lucide/svelte";
  import LibraryShell from "$lib/components/library/LibraryShell.svelte";
  import MotionLibrary from "$lib/components/library/MotionLibrary.svelte";
  import animationGroups from "$lib/animations/animations.svelte";
</script>

<svelte:head
  ><title>Motion library — PhoneMockup</title><meta
    name="description"
    content="Find your next move. Preview editable device animations, from quiet orbits to full spins and screen-switch flips."
  /></svelte:head
>
<LibraryShell active="motions">
  <div class="library-heading">
    <div>
      <p class="library-eyebrow">
        Motion library / {animationGroups.length} moves
      </p>
      <h1>Find your next move.</h1>
      <p class="library-subtitle">
        A quiet orbit. A full spin. A different perspective.<br />Pick a
        starting point and make it your own.
      </p>
    </div>
    <a class="library-button" href="/platform/animation/still"
      >Start with a blank canvas <ArrowUpRight size={17} /></a
    >
  </div>
  <MotionLibrary persistFilters />
</LibraryShell>
