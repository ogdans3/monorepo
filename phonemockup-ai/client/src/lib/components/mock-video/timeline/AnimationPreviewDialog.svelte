<script lang="ts">
  import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogDescription,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Separator } from "$lib/components/ui/separator";
  import { Button } from "$lib/components/ui/button";
  import {
    type Animation,
    AnimationCategories,
    type AnimationGroup,
  } from "$lib/components/mock-video/Animation";
  import animationGroups from "$lib/animations/animations.svelte";
  import AnimationGroupPreview from "$lib/components/mock-video/AnimationGroupPreview.svelte";

  let { chooseAnimation, showAnimationDialog = $bindable() } = $props();
  let selectedCategories = $state<AnimationCategories[]>([]);

  // All enum values, stable order
  const allCategories = $derived(
    Object.values(AnimationCategories) as AnimationCategories[],
  );

  // Filtered animations (show all if none selected), keep your priority sort
  let filteredAnimationGroups: AnimationGroup[] = $derived.by(() => {
    const base = [...animationGroups].toSorted(
      (a, b) => b.priority - a.priority,
    );
    if (selectedCategories.length === 0) return base;

    return base.filter((animationGroup) => {
      const categories = animationGroup.categories ?? [];
      return categories.some((c) => selectedCategories.includes(c));
    });
  });

  function toggleCat(c: AnimationCategories) {
    selectedCategories = selectedCategories.includes(c)
      ? selectedCategories.filter((x) => x !== c)
      : [...selectedCategories, c];
  }

  function clearSelectedCategories() {
    selectedCategories = [];
  }
</script>

<!-- Animation chooser dialog -->
<Dialog
  open={showAnimationDialog}
  onOpenChange={(v) => (showAnimationDialog = v)}
>
  <DialogContent class="studio-motion-dialog">
    <DialogHeader>
      <DialogTitle>
        <div>Choose an animation</div>
      </DialogTitle>
      <DialogDescription
        >Find a move, then make it yours. Add it at the playhead.</DialogDescription
      >
    </DialogHeader>

    <div class="studio-motion-scroll">
      <div class="studio-motion-filters">
        {#each allCategories as cat}
          <button
            type="button"
            class="rounded-md border px-3 py-1 text-sm transition
             hover:bg-accent hover:text-accent-foreground hover:cursor-pointer
             data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            data-active={selectedCategories.includes(cat)}
            aria-pressed={selectedCategories.includes(cat)}
            onclick={() => toggleCat(cat)}
            title={cat}
          >
            {cat}
          </button>
        {/each}

        <Button
          variant="ghost"
          size="sm"
          class="ml-auto text-xs"
          onclick={clearSelectedCategories}
          disabled={selectedCategories.length === 0}
        >
          Clear
        </Button>
      </div>

      <div class="studio-motion-results">
        <div class="studio-motion-grid">
          {#each filteredAnimationGroups as animationGroup}
            <button
              class="studio-motion-card"
              onclick={() => chooseAnimation(animationGroup)}
              title={animationGroup.categories?.join(", ") || ""}
            >
              <AnimationGroupPreview {animationGroup} />
            </button>
          {/each}
        </div>
      </div>
    </div>

    <Separator />

    <DialogFooter class="gap-2">
      <DialogClose>
        {#snippet child({ props })}
          <Button {...props} variant="secondary">Cancel</Button>
        {/snippet}
      </DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
