<script lang="ts">
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
  } from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import type { AnimationGroup } from "$lib/components/mock-video/Animation";
  import MotionLibrary from "$lib/components/library/MotionLibrary.svelte";
  let {
    chooseAnimation,
    showAnimationDialog = $bindable(false),
  }: {
    chooseAnimation: (group: AnimationGroup) => void;
    showAnimationDialog: boolean;
  } = $props();
  let dialog = $state<HTMLDivElement | null>(null);
</script>

<Dialog bind:open={showAnimationDialog}>
  <DialogContent
    bind:ref={dialog}
    class="studio-motion-dialog app-dialog"
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      dialog?.focus();
    }}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (
        document.querySelector(
          "[data-motion-chooser-trigger]",
        ) as HTMLElement | null
      )?.focus();
    }}
  >
    <DialogHeader
      ><DialogTitle>Choose an animation</DialogTitle><DialogDescription
        >Preview a move, then add it at the playhead.</DialogDescription
      ></DialogHeader
    >
    <MotionLibrary compact onchoose={chooseAnimation} />
    <DialogFooter
      ><DialogClose
        >{#snippet child({ props })}<Button {...props} variant="outline"
            >Cancel</Button
          >{/snippet}</DialogClose
      ></DialogFooter
    >
  </DialogContent>
</Dialog>
